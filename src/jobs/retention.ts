import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";

const dayMilliseconds = 24 * 60 * 60 * 1000;

export type RetentionObjectStore = {
  deleteObjects(keys: readonly string[]): Promise<void>;
};

export function fileBytesCutoff(now = new Date()): Date {
  return new Date(now.getTime() - 90 * dayMilliseconds);
}

export function privateDetailsCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  return cutoff;
}

export async function findFileBytesEligibleForDeletion(
  now = new Date(),
  limit = 100,
) {
  const cutoff = fileBytesCutoff(now);
  const cutoffValue = cutoff.toISOString();
  const boundedLimit = Math.min(Math.max(limit, 1), 1000);
  const { db } = getDatabase();

  return db.execute<{
    id: string;
    shop_id: string;
    order_id: string;
    object_key: string;
  }>(sql`
    select object.id, object.shop_id, session.order_id, object.object_key
    from app.stored_objects object
    join app.upload_intents intent on intent.id = object.upload_intent_id
    join app.upload_sessions session on session.id = intent.upload_session_id
    join app.orders orders on orders.id = session.order_id
    where object.bytes_deleted_at is null
      and orders.terminal_state in ('collected', 'canceled')
      and coalesce(orders.collected_at, orders.canceled_at) <= ${cutoffValue}
    order by coalesce(orders.collected_at, orders.canceled_at), object.id
    limit ${boundedLimit}
  `);
}

export async function deleteEligibleFileBytes(input: {
  objectStore: RetentionObjectStore;
  now?: Date;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const candidates = await findFileBytesEligibleForDeletion(now, input.limit);
  if (candidates.length === 0) {
    return { deleted: 0 };
  }

  await input.objectStore.deleteObjects(
    candidates.map((candidate) => candidate.object_key),
  );

  const cutoff = fileBytesCutoff(now);
  const cutoffValue = cutoff.toISOString();
  const nowValue = now.toISOString();
  const { db } = getDatabase();
  const deleted = await db.transaction(async (transaction) => {
    let count = 0;
    for (const candidate of candidates) {
      const updated = await transaction.execute<{ id: string }>(sql`
        update app.stored_objects object
        set bytes_deleted_at = ${nowValue}
        from app.upload_intents intent,
             app.upload_sessions session,
             app.orders orders
        where object.id = ${candidate.id}
          and object.bytes_deleted_at is null
          and intent.id = object.upload_intent_id
          and session.id = intent.upload_session_id
          and orders.id = session.order_id
          and orders.terminal_state in ('collected', 'canceled')
          and coalesce(orders.collected_at, orders.canceled_at) <= ${cutoffValue}
        returning object.id
      `);
      if (updated.length === 0) {
        continue;
      }

      const [actor] = await transaction.execute<{ id: string }>(sql`
        insert into app.actor_snapshots (shop_id, type, display_label)
        values (${candidate.shop_id}, 'system', 'System')
        returning id
      `);
      await transaction.execute(sql`
        insert into app.order_activity_entries (
          shop_id,
          order_id,
          action_type,
          actor_snapshot_id,
          details,
          correlation_id
        ) values (
          ${candidate.shop_id},
          ${candidate.order_id},
          'file.bytes_deleted',
          ${actor.id},
          ${JSON.stringify({
            schema_version: "order_activity.v1",
            stored_object_id: candidate.id,
          })}::jsonb,
          ${randomUUID()}
        )
      `);
      count += 1;
    }
    return count;
  });

  return { deleted };
}

export async function eraseEligiblePrivateDetails(
  now = new Date(),
  limit = 100,
) {
  const cutoff = privateDetailsCutoff(now);
  const cutoffValue = cutoff.toISOString();
  const nowValue = now.toISOString();
  const boundedLimit = Math.min(Math.max(limit, 1), 1000);
  const { db } = getDatabase();

  return db.transaction(async (transaction) => {
    const eligibleOrders = await transaction.execute<{
      id: string;
      shop_id: string;
    }>(sql`
      select id, shop_id
      from app.orders
      where contact_erased_at is null
        and terminal_state in ('collected', 'canceled')
        and coalesce(collected_at, canceled_at) <= ${cutoffValue}
      order by coalesce(collected_at, canceled_at), id
      for update skip locked
      limit ${boundedLimit}
    `);

    let filenamesErased = 0;
    for (const order of eligibleOrders) {
      const [actor] = await transaction.execute<{ id: string }>(sql`
        insert into app.actor_snapshots (shop_id, type, display_label)
        values (${order.shop_id}, 'system', 'System')
        returning id
      `);
      await transaction.execute(sql`
        update app.orders
        set contact_name = null,
            contact_phone_display = null,
            contact_phone_search = null,
            contact_email_display = null,
            contact_email_search = null,
            contact_erased_at = ${nowValue},
            updated_at = ${nowValue}
        where id = ${order.id}
      `);
      const filenames = await transaction.execute<{ id: string }>(sql`
        update app.stored_objects object
        set original_filename = null,
            filename_erased_at = ${nowValue}
        from app.upload_intents intent,
             app.upload_sessions session
        where session.order_id = ${order.id}
          and intent.upload_session_id = session.id
          and object.upload_intent_id = intent.id
          and object.filename_erased_at is null
        returning object.id
      `);
      filenamesErased += filenames.length;
      await transaction.execute(sql`
        update app.actor_snapshots actor
        set display_label = 'Erased customer',
            stable_identity = null,
            display_erased_at = ${nowValue}
        where actor.type in ('guest', 'assisted_customer')
          and actor.display_erased_at is null
          and exists (
            select 1
            from app.order_activity_entries activity
            where activity.order_id = ${order.id}
              and activity.actor_snapshot_id = actor.id
          )
      `);
      await transaction.execute(sql`
        insert into app.order_activity_entries (
          shop_id,
          order_id,
          action_type,
          actor_snapshot_id,
          details,
          correlation_id
        ) values (
          ${order.shop_id},
          ${order.id},
          'privacy.private_details_erased',
          ${actor.id},
          ${JSON.stringify({ schema_version: "order_activity.v1" })}::jsonb,
          ${randomUUID()}
        )
      `);
    }

    return {
      ordersErased: eligibleOrders.length,
      filenamesErased,
    };
  });
}

export async function purgeExpiredOperationalData(now = new Date()) {
  const nowValue = now.toISOString();
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const deliveries = await transaction.execute<{ id: string }>(sql`
      update app.capability_deliveries
      set encrypted_capability = null,
          erased_at = ${nowValue}
      where encrypted_capability is not null
        and expires_at <= ${nowValue}
      returning id
    `);
    const idempotency = await transaction.execute<{ id: string }>(sql`
      delete from app.idempotency_records
      where retention_expires_at <= ${nowValue}
        and state <> 'leased'
      returning id
    `);
    const security = await transaction.execute<{ id: string }>(sql`
      delete from app.security_events
      where retention_expires_at <= ${nowValue}
      returning id
    `);
    const rateLimits = await transaction.execute<{ id: string }>(sql`
      delete from app.rate_limit_counters
      where expires_at <= ${nowValue}
      returning id
    `);

    return {
      capabilityDeliveriesErased: deliveries.length,
      idempotencyRecordsDeleted: idempotency.length,
      securityEventsDeleted: security.length,
      rateLimitCountersDeleted: rateLimits.length,
    };
  });
}

export const eraseEligibleContactDetails = eraseEligiblePrivateDetails;
