import { sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { assertEventPayload, type EventType } from "@/jobs/events";
import { recordOperationalSignal } from "@/observability/operations";

export const outboxRetryMinutes = [0, 1, 5, 15, 60, 180, 480, 1440] as const;

export type ClaimedOutboxEvent = {
  id: string;
  shopId: string;
  eventType: EventType;
  payload: unknown;
  leaseFence: bigint;
  attemptCount: number;
  occurredAt: Date;
};

export function nextAttemptAt(
  firstAttemptAt: Date,
  attemptCount: number,
): Date | null {
  const minutes = outboxRetryMinutes[attemptCount];
  return minutes === undefined
    ? null
    : new Date(firstAttemptAt.getTime() + minutes * 60 * 1000);
}

export async function claimOutboxBatch(input: {
  workerId: string;
  limit?: number;
}): Promise<ClaimedOutboxEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  const { db } = getDatabase();

  const rows = await db.transaction(async (transaction) =>
    transaction.execute<{
      id: string;
      shop_id: string;
      event_type: string;
      payload: unknown;
      lease_fence: bigint;
      attempt_count: number;
      occurred_at: Date;
      recovered_lease: boolean;
    }>(sql`
      with claimable as (
        select id, state = 'leased' as recovered_lease
        from app.outbox_events
        where state in ('pending', 'retryable', 'leased')
          and next_attempt_at <= now()
          and (lease_expires_at is null or lease_expires_at <= now())
        order by next_attempt_at, id
        for update skip locked
        limit ${limit}
      )
      update app.outbox_events event
      set state = 'leased',
          claim_owner = ${input.workerId},
          lease_expires_at = now() + interval '5 minutes',
          lease_fence = event.lease_fence + 1,
          updated_at = now()
      from claimable
      where event.id = claimable.id
      returning event.id,
                event.shop_id,
                event.event_type,
                event.payload,
                event.lease_fence,
                event.attempt_count,
                event.occurred_at,
                claimable.recovered_lease
    `),
  );

  return rows.map((row) => {
    const eventType = assertEventPayload(row.event_type, row.payload);
    const occurredAt = new Date(row.occurred_at);
    const lagSeconds = Math.max(
      0,
      Math.floor((Date.now() - occurredAt.getTime()) / 1000),
    );

    recordOperationalSignal({
      name: "outbox_lag",
      operation: "claim_outbox_batch",
      shopId: row.shop_id,
      eventId: row.id,
      value: lagSeconds,
    });
    if (row.recovered_lease) {
      recordOperationalSignal({
        name: "outbox_lease_recovered",
        operation: "claim_outbox_batch",
        shopId: row.shop_id,
        eventId: row.id,
      });
    }

    return {
      id: row.id,
      shopId: row.shop_id,
      eventType,
      payload: row.payload,
      leaseFence: BigInt(row.lease_fence),
      attemptCount: row.attempt_count,
      occurredAt,
    };
  });
}

export async function beginExternalEffectAttempt(input: {
  eventId: string;
  workerId: string;
  leaseFence: bigint;
  provider: string;
  effectType: string;
  requestFingerprint: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const result = await transaction.execute<{
      id: string;
      shop_id: string;
      attempt_number: number;
    }>(sql`
      with locked_event as (
        select id, shop_id, attempt_count
        from app.outbox_events
        where id = ${input.eventId}
          and claim_owner = ${input.workerId}
          and lease_fence = ${input.leaseFence}
          and state = 'leased'
        for update
      ), allowed_event as (
        select locked_event.*
        from locked_event
        where not exists (
          select 1
          from app.external_effect_attempts attempt
          where attempt.outbox_event_id = locked_event.id
            and attempt.state = 'uncertain'
            and attempt.reconciliation_result is null
        )
      ), inserted as (
        insert into app.external_effect_attempts (
          shop_id,
          outbox_event_id,
          attempt_number,
          lease_fence,
          provider,
          effect_type,
          request_fingerprint,
          state,
          started_at
        )
        select shop_id,
               id,
               attempt_count + 1,
               ${input.leaseFence},
               ${input.provider},
               ${input.effectType},
               ${input.requestFingerprint},
               'leased',
               now()
        from allowed_event
        returning id, shop_id, attempt_number
      )
      update app.outbox_events event
      set attempt_count = inserted.attempt_number,
          first_attempt_at = coalesce(event.first_attempt_at, now()),
          updated_at = now()
      from inserted
      where event.id = ${input.eventId}
      returning inserted.id, inserted.shop_id, inserted.attempt_number
    `);

    if (result.length !== 1) {
      throw new Error("stale_lease_or_reconciliation_required");
    }

    return {
      attemptId: result[0].id,
      effectId: input.eventId,
      shopId: result[0].shop_id,
      attemptNumber: result[0].attempt_number,
    };
  });
}

type OutboxResult =
  | {
      state: "completed";
      providerIdentifier?: string;
      responseSummary?: { schema_version: string; [key: string]: unknown };
    }
  | { state: "retryable"; error: string }
  | { state: "uncertain"; error: string; providerIdentifier?: string }
  | { state: "dead"; error: string };

export async function completeOutboxEvent(input: {
  eventId: string;
  attemptId?: string;
  workerId: string;
  leaseFence: bigint;
  result?: OutboxResult;
}) {
  const outcome = input.result ?? { state: "completed" as const };
  const { db } = getDatabase();

  const saved = await db.transaction(async (transaction) => {
    const rows = await transaction.execute<{
      id: string;
      shop_id: string;
      attempt_count: number;
      first_attempt_at: Date | null;
    }>(sql`
      select id, shop_id, attempt_count, first_attempt_at
      from app.outbox_events
      where id = ${input.eventId}
        and claim_owner = ${input.workerId}
        and lease_fence = ${input.leaseFence}
        and state = 'leased'
      for update
    `);

    if (rows.length !== 1) {
      recordOperationalSignal({
        name: "command_failure",
        operation: "complete_outbox_event",
        eventId: input.eventId,
      });
      throw new Error("stale_lease");
    }

    const event = rows[0];
    const firstAttemptAt = event.first_attempt_at
      ? new Date(event.first_attempt_at)
      : new Date();
    const scheduledAt = nextAttemptAt(firstAttemptAt, event.attempt_count);
    const scheduledAtValue = (scheduledAt ?? firstAttemptAt).toISOString();
    const finalState =
      outcome.state === "retryable" && scheduledAt === null
        ? "dead"
        : outcome.state;

    if (input.attemptId) {
      await transaction.execute(sql`
        update app.external_effect_attempts
        set state = ${finalState},
            provider_identifier = ${
              "providerIdentifier" in outcome
                ? (outcome.providerIdentifier ?? null)
                : null
            },
            response_summary = ${
              outcome.state === "completed"
                ? (outcome.responseSummary ?? null)
                : null
            },
            uncertain_at = case when ${finalState} = 'uncertain' then now() else uncertain_at end,
            completed_at = case when ${finalState} = 'completed' then now() else completed_at end
        where id = ${input.attemptId}
          and outbox_event_id = ${input.eventId}
          and lease_fence = ${input.leaseFence}
          and state = 'leased'
      `);
    }

    const updated = await transaction.execute<{ id: string; shop_id: string }>(
      sql`
        update app.outbox_events
        set state = ${finalState},
            next_attempt_at = ${scheduledAtValue},
            lease_expires_at = null,
            claim_owner = null,
            completed_at = case when ${finalState} = 'completed' then now() else completed_at end,
            last_error = ${
              "error" in outcome ? outcome.error.slice(0, 1000) : null
            },
            updated_at = now()
        where id = ${input.eventId}
          and lease_fence = ${input.leaseFence}
        returning id, shop_id
      `,
    );

    return {
      ...updated[0],
      state: finalState,
      nextAttemptAt: finalState === "retryable" ? scheduledAt : null,
    };
  });

  if (saved.state === "dead") {
    recordOperationalSignal({
      name: "outbox_dead",
      operation: "complete_outbox_event",
      shopId: saved.shop_id,
      eventId: saved.id,
    });
  }

  return saved;
}

export async function reconcileUncertainEffect(input: {
  eventId: string;
  attemptId: string;
  accepted: boolean;
  providerIdentifier?: string;
  reconciliationResult: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const attempts = await transaction.execute<{
      shop_id: string;
      attempt_number: number;
      first_attempt_at: Date;
    }>(sql`
      select attempt.shop_id, attempt.attempt_number, event.first_attempt_at
      from app.external_effect_attempts attempt
      join app.outbox_events event on event.id = attempt.outbox_event_id
      where attempt.id = ${input.attemptId}
        and attempt.outbox_event_id = ${input.eventId}
        and attempt.state = 'uncertain'
        and attempt.reconciliation_result is null
      for update of attempt, event
    `);
    if (attempts.length !== 1) {
      throw new Error("conflict");
    }

    const attempt = attempts[0];
    const scheduledAt = nextAttemptAt(
      new Date(attempt.first_attempt_at),
      attempt.attempt_number,
    );
    const scheduledAtValue = (scheduledAt ?? new Date()).toISOString();
    const nextState = input.accepted
      ? "completed"
      : scheduledAt
        ? "retryable"
        : "dead";

    await transaction.execute(sql`
      update app.external_effect_attempts
      set state = ${nextState},
          provider_identifier = coalesce(${input.providerIdentifier ?? null}, provider_identifier),
          reconciliation_result = ${input.reconciliationResult},
          completed_at = case when ${input.accepted} then now() else completed_at end
      where id = ${input.attemptId}
    `);
    await transaction.execute(sql`
      update app.outbox_events
      set state = ${nextState},
          next_attempt_at = ${scheduledAtValue},
          completed_at = case when ${input.accepted} then now() else completed_at end,
          updated_at = now()
      where id = ${input.eventId}
    `);

    if (nextState === "dead") {
      recordOperationalSignal({
        name: "outbox_dead",
        operation: "reconcile_uncertain_effect",
        shopId: attempt.shop_id,
        eventId: input.eventId,
      });
    }

    return { state: nextState, nextAttemptAt: scheduledAt };
  });
}
