import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import {
  jobs,
  jobRevisions,
  orderActivityEntries,
  orders,
  outboxEvents,
  quoteLifecycleEvents,
  quoteLines,
  quoteResponses,
  quoteRevisions,
  quoteThreads,
} from "@/db/schema";
import {
  allocateQuoteAdjustment,
  hasExactQuoteCoverage,
  withBlocker,
  withoutBlocker,
} from "@/modules/orders/model";

const issueQuoteSchema = z
  .object({
    shopId: z.uuid(),
    orderId: z.uuid(),
    expectedOrderVersion: z.int().positive(),
    actorSnapshotId: z.uuid(),
    activeGrantId: z.uuid(),
    validUntil: z.date(),
    adjustmentPaisa: z.bigint(),
    customerMessage: z.string(),
    internalNote: z.string().optional(),
    terms: z.record(z.string(), z.unknown()),
    jobs: z
      .array(
        z
          .object({
            jobId: z.uuid(),
            jobRevisionId: z.uuid(),
            lineNumber: z.int().positive(),
            description: z.string().min(1),
            subtotalPaisa: z.bigint().nonnegative(),
            taxPaisa: z.bigint().nonnegative(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export async function issueQuote(rawInput: z.input<typeof issueQuoteSchema>) {
  const input = issueQuoteSchema.parse(rawInput);
  const { db } = getDatabase();

  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order) throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion)
      throw new Error("stale_version");
    const [{ now: databaseNow }] = await transaction.execute<{ now: string }>(
      sql`select now() as now`,
    );
    const now = new Date(databaseNow);
    if (order.terminalState !== "active" || input.validUntil <= now) {
      throw new Error("invalid_transition");
    }

    const quotedJobs = await transaction
      .select({
        jobId: jobs.id,
        jobRevisionId: jobRevisions.id,
        pricingMode: jobRevisions.pricingMode,
      })
      .from(jobs)
      .innerJoin(
        jobRevisions,
        and(
          eq(jobRevisions.shopId, jobs.shopId),
          eq(jobRevisions.id, jobs.currentRevisionId),
        ),
      )
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          sql`${jobs.workflowState} <> 'canceled'`,
          eq(jobRevisions.pricingMode, "quote_required"),
        ),
      );
    if (
      !hasExactQuoteCoverage(
        quotedJobs.map((job) => job.jobRevisionId),
        input.jobs.map((job) => job.jobRevisionId),
      ) ||
      input.jobs.some(
        (candidate) =>
          !quotedJobs.some(
            (job) =>
              job.jobId === candidate.jobId &&
              job.jobRevisionId === candidate.jobRevisionId,
          ),
      )
    ) {
      throw new Error("validation_failed");
    }

    let thread = await transaction.query.quoteThreads.findFirst({
      where: and(
        eq(quoteThreads.shopId, input.shopId),
        eq(quoteThreads.orderId, input.orderId),
      ),
    });
    if (!thread) {
      [thread] = await transaction
        .insert(quoteThreads)
        .values({ shopId: input.shopId, orderId: input.orderId })
        .returning();
    }

    const previous = thread.currentRevisionId
      ? await transaction.query.quoteRevisions.findFirst({
          where: eq(quoteRevisions.id, thread.currentRevisionId),
        })
      : undefined;
    const allocation = allocateQuoteAdjustment(
      input.jobs.map((job) => ({
        jobRevisionId: job.jobRevisionId,
        lineNumber: job.lineNumber,
        subtotal: job.subtotalPaisa,
        tax: job.taxPaisa,
      })),
      input.adjustmentPaisa,
    );
    const subtotal = allocation.reduce((sum, job) => sum + job.subtotal, 0n);
    const tax = allocation.reduce((sum, job) => sum + job.tax, 0n);
    const total = allocation.reduce((sum, job) => sum + job.roundedTotal, 0n);
    const revisionId = randomUUID();
    const revisionNumber = (previous?.revisionNumber ?? 0) + 1;

    if (previous && previous.lifecycle !== "superseded") {
      await transaction
        .update(quoteRevisions)
        .set({ lifecycle: "superseded" })
        .where(eq(quoteRevisions.id, previous.id));
      await transaction.insert(quoteLifecycleEvents).values({
        shopId: input.shopId,
        quoteRevisionId: previous.id,
        eventType: "superseded",
        actorSnapshotId: input.actorSnapshotId,
        occurredAt: now,
      });
    }

    await transaction.insert(quoteRevisions).values({
      id: revisionId,
      shopId: input.shopId,
      quoteThreadId: thread.id,
      revisionNumber,
      lifecycle: "sent",
      issuedAt: now,
      validUntil: input.validUntil,
      subtotal,
      adjustment: input.adjustmentPaisa,
      tax,
      roundingDelta: total - subtotal - input.adjustmentPaisa - tax,
      total,
      customerMessage: input.customerMessage,
      termsSnapshot: { schema_version: "quote_terms.v1", ...input.terms },
      internalNote: input.internalNote,
    });
    await transaction.insert(quoteLines).values(
      allocation.map((job, index) => ({
        shopId: input.shopId,
        quoteRevisionId: revisionId,
        jobRevisionId: job.jobRevisionId,
        description: input.jobs.find(
          (candidate) => candidate.jobRevisionId === job.jobRevisionId,
        )!.description,
        quantity: "1",
        unitAmount: job.subtotal,
        subtotal: job.subtotal,
        allocatedAdjustment: job.allocatedAdjustment,
        tax: job.tax,
        unroundedTotal: job.subtotal + job.allocatedAdjustment + job.tax,
        roundedTotal: job.roundedTotal,
        sortOrder: index + 1,
      })),
    );
    await transaction.insert(quoteLifecycleEvents).values({
      shopId: input.shopId,
      quoteRevisionId: revisionId,
      eventType: "sent",
      actorSnapshotId: input.actorSnapshotId,
      occurredAt: now,
    });
    await transaction
      .update(quoteThreads)
      .set({ currentRevisionId: revisionId })
      .where(eq(quoteThreads.id, thread.id));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(eq(orders.id, input.orderId));
    const activityId = randomUUID();
    await transaction.insert(orderActivityEntries).values({
      id: activityId,
      shopId: input.shopId,
      orderId: input.orderId,
      actionType: "quote.sent",
      actorSnapshotId: input.actorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        quote_revision_id: revisionId,
      },
      correlationId: randomUUID(),
    });
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "quote.delivery_requested.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        quote_revision_id: revisionId,
        active_grant_id: input.activeGrantId,
        template_version: "quote_delivery.v1",
      },
    });

    return { quoteRevisionId: revisionId, total };
  });
}

export async function recordQuoteResponse(input: {
  shopId: string;
  orderId: string;
  expectedOrderVersion: number;
  quoteRevisionId: string;
  decision: "accepted" | "declined";
  reason?: string;
  customerActorSnapshotId: string;
  channel: string;
  recordedByMembershipId?: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order) throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion)
      throw new Error("stale_version");
    if (order.terminalState !== "active") throw new Error("invalid_transition");

    const [revision] = await transaction
      .select()
      .from(quoteRevisions)
      .where(
        and(
          eq(quoteRevisions.shopId, input.shopId),
          eq(quoteRevisions.id, input.quoteRevisionId),
        ),
      )
      .for("update");
    const thread = revision
      ? await transaction.query.quoteThreads.findFirst({
          where: and(
            eq(quoteThreads.id, revision.quoteThreadId),
            eq(quoteThreads.orderId, input.orderId),
            eq(quoteThreads.currentRevisionId, revision.id),
          ),
        })
      : undefined;

    if (!revision || !thread) throw new Error("superseded");
    if (revision.lifecycle !== "sent") throw new Error("conflict");
    const [{ now: databaseNow }] = await transaction.execute<{ now: string }>(
      sql`select now() as now`,
    );
    const now = new Date(databaseNow);
    if (revision.validUntil <= now) throw new Error("expired");

    const responseId = randomUUID();
    await transaction.insert(quoteResponses).values({
      id: responseId,
      shopId: input.shopId,
      quoteRevisionId: revision.id,
      sequenceNumber: 1,
      decision: input.decision,
      reason: input.reason,
      customerActorSnapshotId: input.customerActorSnapshotId,
      channel: input.channel,
      recordedByMembershipId: input.recordedByMembershipId,
      respondedAt: now,
    });
    await transaction
      .update(quoteRevisions)
      .set({ lifecycle: input.decision })
      .where(eq(quoteRevisions.id, revision.id));
    await transaction.insert(quoteLifecycleEvents).values({
      shopId: input.shopId,
      quoteRevisionId: revision.id,
      eventType: input.decision,
      actorSnapshotId: input.customerActorSnapshotId,
      occurredAt: now,
    });

    const lines = await transaction.query.quoteLines.findMany({
      where: eq(quoteLines.quoteRevisionId, revision.id),
    });
    const coveredRevisionIds = [
      ...new Set(lines.map((line) => line.jobRevisionId)),
    ];
    const coveredJobs = coveredRevisionIds.length
      ? await transaction.query.jobs.findMany({
          where: and(
            eq(jobs.shopId, input.shopId),
            eq(jobs.orderId, input.orderId),
            inArray(jobs.currentRevisionId, coveredRevisionIds),
          ),
        })
      : [];

    if (coveredJobs.length !== coveredRevisionIds.length) {
      throw new Error("superseded");
    }

    if (input.decision === "accepted") {
      for (const job of coveredJobs) {
        await transaction
          .update(jobs)
          .set({
            blockerProjection: withoutBlocker(
              job.blockerProjection,
              "quote_response",
            ),
            version: sql`${jobs.version} + 1`,
            updatedAt: now,
          })
          .where(eq(jobs.id, job.id));
      }
    }

    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      actionType: `quote.${input.decision}`,
      actorSnapshotId: input.customerActorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        quote_revision_id: revision.id,
        quote_response_id: responseId,
      },
      correlationId: randomUUID(),
    });
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "quote.response_recorded.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        quote_response_id: responseId,
        template_version: "quote_response.v1",
      },
    });

    return { responseId, decision: input.decision };
  });
}

export async function correctQuoteResponse(input: {
  shopId: string;
  orderId: string;
  expectedOrderVersion: number;
  quoteRevisionId: string;
  correctsResponseId: string;
  decision: "accepted" | "declined";
  reason: string;
  adminActorSnapshotId: string;
  recordedByMembershipId: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order) throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion)
      throw new Error("stale_version");

    const [revision] = await transaction
      .select()
      .from(quoteRevisions)
      .where(
        and(
          eq(quoteRevisions.shopId, input.shopId),
          eq(quoteRevisions.id, input.quoteRevisionId),
        ),
      )
      .for("update");
    const thread = revision
      ? await transaction.query.quoteThreads.findFirst({
          where: and(
            eq(quoteThreads.id, revision.quoteThreadId),
            eq(quoteThreads.orderId, input.orderId),
            eq(quoteThreads.currentRevisionId, revision.id),
          ),
        })
      : undefined;
    if (!revision || !thread) throw new Error("superseded");

    const effective = await transaction.query.quoteResponses.findFirst({
      where: eq(quoteResponses.quoteRevisionId, revision.id),
      orderBy: [desc(quoteResponses.sequenceNumber)],
    });
    if (!effective || effective.id !== input.correctsResponseId) {
      throw new Error("conflict");
    }

    const responseId = randomUUID();
    const now = new Date();
    await transaction.insert(quoteResponses).values({
      id: responseId,
      shopId: input.shopId,
      quoteRevisionId: revision.id,
      sequenceNumber: effective.sequenceNumber + 1,
      decision: input.decision,
      reason: input.reason,
      customerActorSnapshotId: effective.customerActorSnapshotId,
      channel: effective.channel,
      recordedByMembershipId: input.recordedByMembershipId,
      correctsResponseId: effective.id,
      respondedAt: now,
    });
    await transaction
      .update(quoteRevisions)
      .set({ lifecycle: input.decision })
      .where(eq(quoteRevisions.id, revision.id));
    await transaction.insert(quoteLifecycleEvents).values({
      shopId: input.shopId,
      quoteRevisionId: revision.id,
      eventType: "corrected",
      actorSnapshotId: input.adminActorSnapshotId,
      occurredAt: now,
    });

    const lines = await transaction.query.quoteLines.findMany({
      where: eq(quoteLines.quoteRevisionId, revision.id),
    });
    const revisionIds = [...new Set(lines.map((line) => line.jobRevisionId))];
    const coveredJobs = revisionIds.length
      ? await transaction.query.jobs.findMany({
          where: and(
            eq(jobs.shopId, input.shopId),
            eq(jobs.orderId, input.orderId),
            inArray(jobs.currentRevisionId, revisionIds),
            sql`${jobs.workflowState} <> 'canceled'`,
          ),
        })
      : [];
    if (coveredJobs.length !== revisionIds.length)
      throw new Error("superseded");

    for (const job of coveredJobs) {
      await transaction
        .update(jobs)
        .set({
          blockerProjection:
            input.decision === "accepted"
              ? withoutBlocker(job.blockerProjection, "quote_response")
              : withBlocker(job.blockerProjection, "quote_response"),
          version: sql`${jobs.version} + 1`,
          updatedAt: now,
        })
        .where(eq(jobs.id, job.id));
    }
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      actionType: "quote.response_corrected",
      actorSnapshotId: input.adminActorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        quote_revision_id: revision.id,
        quote_response_id: responseId,
        corrects_response_id: effective.id,
        decision: input.decision,
        reason: input.reason,
      },
      correlationId: randomUUID(),
    });

    return { responseId, decision: input.decision };
  });
}
