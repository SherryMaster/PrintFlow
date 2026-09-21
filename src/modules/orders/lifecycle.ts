import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import {
  internalNotes,
  jobRevisions,
  jobs,
  orderActivityEntries,
  orders,
  outboxEvents,
  priceAcceptances,
  productionExceptions,
  quoteLifecycleEvents,
  quoteLines,
  quoteRevisions,
  quoteThreads,
  priceRuleVersions,
  serviceVersions,
} from "@/db/schema";
import {
  blockerTypes,
  canTransitionJob,
  deriveJobBlockers,
  isOrderReady,
  withBlocker,
  type JobWorkflowState,
} from "@/modules/orders/model";
import {
  type OrderAuthority,
  requireAdminAuthority,
} from "@/modules/orders/authorization";

const transitionInputSchema = z
  .object({
    shopId: z.uuid(),
    orderId: z.uuid(),
    jobId: z.uuid(),
    expectedOrderVersion: z.int().positive(),
    expectedJobVersion: z.int().positive(),
    targetState: z.enum([
      "received",
      "under_review",
      "ready_for_production",
      "in_production",
      "ready",
      "canceled",
    ]),
    reason: z.string().trim().min(1).optional(),
    actorSnapshotId: z.uuid(),
  })
  .strict();

function blockerCount(projection: { [key: string]: unknown }): number {
  return Array.isArray(projection.blockers) ? projection.blockers.length : 0;
}

export async function transitionJob(
  rawInput: z.input<typeof transitionInputSchema>,
) {
  const input = transitionInputSchema.parse(rawInput);
  const { db } = getDatabase();

  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    const [job] = await transaction
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          eq(jobs.id, input.jobId),
        ),
      )
      .for("update");

    if (!order || !job) {
      throw new Error("not_found");
    }
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    ) {
      throw new Error("stale_version");
    }
    if (order.terminalState !== "active") {
      throw new Error("invalid_transition");
    }
    if (
      !canTransitionJob(
        job.workflowState as JobWorkflowState,
        input.targetState,
        Boolean(input.reason),
      )
    ) {
      throw new Error("invalid_transition");
    }
    if (
      ["ready_for_production", "in_production", "ready"].includes(
        input.targetState,
      ) &&
      (job.productionHold || blockerCount(job.blockerProjection) > 0)
    ) {
      throw new Error("invalid_transition");
    }

    const now = new Date();
    const [updatedJob] = await transaction
      .update(jobs)
      .set({
        workflowState: input.targetState,
        version: sql`${jobs.version} + 1`,
        canceledAt: input.targetState === "canceled" ? now : job.canceledAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(jobs.id, input.jobId),
          eq(jobs.version, input.expectedJobVersion),
        ),
      )
      .returning();
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.version, input.expectedOrderVersion),
        ),
      );

    let orderBecameCanceled = false;
    if (input.targetState === "canceled") {
      const remaining = await transaction.query.jobs.findMany({
        where: and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          sql`${jobs.id} <> ${input.jobId}`,
          sql`${jobs.workflowState} <> 'canceled'`,
        ),
      });
      if (remaining.length === 0) {
        orderBecameCanceled = true;
        await transaction
          .update(orders)
          .set({
            terminalState: "canceled",
            canceledAt: now,
            cancellationReason: input.reason,
            updatedAt: now,
          })
          .where(eq(orders.id, input.orderId));
      }

      const quoteThread = await transaction.query.quoteThreads.findFirst({
        where: and(
          eq(quoteThreads.shopId, input.shopId),
          eq(quoteThreads.orderId, input.orderId),
        ),
      });
      const currentQuote = quoteThread?.currentRevisionId
        ? await transaction.query.quoteRevisions.findFirst({
            where: and(
              eq(quoteRevisions.shopId, input.shopId),
              eq(quoteRevisions.id, quoteThread.currentRevisionId),
            ),
          })
        : undefined;
      const currentQuoteLines = currentQuote
        ? await transaction.query.quoteLines.findMany({
            where: eq(quoteLines.quoteRevisionId, currentQuote.id),
          })
        : [];
      const canceledRevisionWasCovered = currentQuoteLines.some(
        (line) => line.jobRevisionId === job.currentRevisionId,
      );

      if (
        currentQuote &&
        currentQuote.lifecycle !== "superseded" &&
        canceledRevisionWasCovered
      ) {
        await transaction
          .update(quoteRevisions)
          .set({ lifecycle: "superseded" })
          .where(eq(quoteRevisions.id, currentQuote.id));
        await transaction.insert(quoteLifecycleEvents).values({
          shopId: input.shopId,
          quoteRevisionId: currentQuote.id,
          eventType: "superseded",
          actorSnapshotId: input.actorSnapshotId,
          occurredAt: now,
        });

        const remainingCoveredRevisionIds = currentQuoteLines
          .map((line) => line.jobRevisionId)
          .filter((revisionId) => revisionId !== job.currentRevisionId);
        const remainingCoveredJobs = remainingCoveredRevisionIds.length
          ? await transaction.query.jobs.findMany({
              where: and(
                eq(jobs.shopId, input.shopId),
                eq(jobs.orderId, input.orderId),
                inArray(jobs.currentRevisionId, remainingCoveredRevisionIds),
                sql`${jobs.workflowState} <> 'canceled'`,
              ),
            })
          : [];
        for (const coveredJob of remainingCoveredJobs) {
          await transaction
            .update(jobs)
            .set({
              blockerProjection: withBlocker(
                coveredJob.blockerProjection,
                "quote_response",
              ),
              version: sql`${jobs.version} + 1`,
              updatedAt: now,
            })
            .where(eq(jobs.id, coveredJob.id));
        }
      }
    }

    const activityId = randomUUID();
    await transaction.insert(orderActivityEntries).values({
      id: activityId,
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "job.state_changed",
      actorSnapshotId: input.actorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        from: job.workflowState,
        to: input.targetState,
        reason: input.reason,
      },
      correlationId: randomUUID(),
    });

    if (orderBecameCanceled) {
      const cancellationActivityId = randomUUID();
      await transaction.insert(orderActivityEntries).values({
        id: cancellationActivityId,
        shopId: input.shopId,
        orderId: input.orderId,
        actionType: "order.canceled",
        actorSnapshotId: input.actorSnapshotId,
        details: {
          schema_version: "order_activity.v1",
          reason: input.reason,
          job_id: input.jobId,
        },
        correlationId: randomUUID(),
      });
      await transaction.insert(outboxEvents).values({
        shopId: input.shopId,
        aggregateType: "order",
        aggregateId: input.orderId,
        eventType: "order.terminal.v1",
        payload: {
          schema_version: "1",
          order_id: input.orderId,
          activity_entry_id: cancellationActivityId,
          template_version: "order_canceled.v1",
        },
      });
    } else if (
      ["in_production", "ready", "canceled"].includes(input.targetState)
    ) {
      await transaction.insert(outboxEvents).values({
        shopId: input.shopId,
        aggregateType: "order",
        aggregateId: input.orderId,
        eventType: "order.visible_status_changed.v1",
        payload: {
          schema_version: "1",
          order_id: input.orderId,
          job_id: input.jobId,
          activity_entry_id: activityId,
          template_version: "order_status.v1",
        },
      });
    }

    return updatedJob;
  });
}

export async function reviseJob(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  expectedOrderVersion: number;
  expectedJobVersion: number;
  serviceVersionId: string;
  priceRuleVersionId: string;
  configuration: { schema_version: string; [key: string]: unknown };
  measurements: { schema_version: string; [key: string]: unknown };
  requirements: { schema_version: string; [key: string]: unknown };
  pricingMode: "standard" | "quote_required";
  calculationSnapshot?: { schema_version: string; [key: string]: unknown };
  subtotal?: bigint;
  adjustment?: bigint;
  tax?: bigint;
  roundedTotal?: bigint;
  actorSnapshotId: string;
  reason: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    const [job] = await transaction
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          eq(jobs.id, input.jobId),
        ),
      )
      .for("update");
    if (!order || !job) throw new Error("not_found");
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    ) {
      throw new Error("stale_version");
    }
    if (order.terminalState !== "active") throw new Error("invalid_transition");
    const [serviceVersion, priceRuleVersion] = await Promise.all([
      transaction.query.serviceVersions.findFirst({
        where: and(
          eq(serviceVersions.shopId, input.shopId),
          eq(serviceVersions.id, input.serviceVersionId),
          eq(serviceVersions.lifecycle, "published"),
        ),
      }),
      transaction.query.priceRuleVersions.findFirst({
        where: and(
          eq(priceRuleVersions.shopId, input.shopId),
          eq(priceRuleVersions.id, input.priceRuleVersionId),
          eq(priceRuleVersions.lifecycle, "published"),
        ),
      }),
    ]);
    if (
      !serviceVersion ||
      !priceRuleVersion ||
      serviceVersion.serviceId !== priceRuleVersion.serviceId
    ) {
      throw new Error("validation_failed");
    }
    const revisions = await transaction.query.jobRevisions.findMany({
      where: eq(jobRevisions.jobId, input.jobId),
    });
    const revisionId = randomUUID();
    await transaction.insert(jobRevisions).values({
      id: revisionId,
      shopId: input.shopId,
      jobId: input.jobId,
      revisionNumber: revisions.length + 1,
      serviceVersionId: input.serviceVersionId,
      priceRuleVersionId: input.priceRuleVersionId,
      configuration: input.configuration,
      measurements: input.measurements,
      requirements: input.requirements,
      pricingMode: input.pricingMode,
      calculationSnapshot: input.calculationSnapshot,
      subtotal: input.subtotal,
      adjustment: input.adjustment,
      tax: input.tax,
      roundedTotal: input.roundedTotal,
      actorSnapshotId: input.actorSnapshotId,
      changeReason: input.reason,
    });
    await transaction
      .update(jobs)
      .set({
        currentRevisionId: revisionId,
        currentProofVersionId: null,
        productionHold: true,
        productionHoldReason: "job_revision_changed",
        blockerProjection: {
          schema_version: "blocker_projection.v1",
          blockers: [
            ...deriveJobBlockers(input.requirements, input.pricingMode),
            "production_hold",
          ],
        },
        version: sql`${jobs.version} + 1`,
      })
      .where(eq(jobs.id, input.jobId));

    const quoteThread = await transaction.query.quoteThreads.findFirst({
      where: and(
        eq(quoteThreads.shopId, input.shopId),
        eq(quoteThreads.orderId, input.orderId),
      ),
    });
    const currentQuote = quoteThread?.currentRevisionId
      ? await transaction.query.quoteRevisions.findFirst({
          where: and(
            eq(quoteRevisions.shopId, input.shopId),
            eq(quoteRevisions.id, quoteThread.currentRevisionId),
          ),
        })
      : undefined;
    const currentQuoteLines = currentQuote
      ? await transaction.query.quoteLines.findMany({
          where: eq(quoteLines.quoteRevisionId, currentQuote.id),
        })
      : [];
    if (
      currentQuote &&
      currentQuote.lifecycle !== "superseded" &&
      currentQuoteLines.some(
        (line) => line.jobRevisionId === job.currentRevisionId,
      )
    ) {
      const now = new Date();
      await transaction
        .update(quoteRevisions)
        .set({ lifecycle: "superseded" })
        .where(eq(quoteRevisions.id, currentQuote.id));
      await transaction.insert(quoteLifecycleEvents).values({
        shopId: input.shopId,
        quoteRevisionId: currentQuote.id,
        eventType: "superseded",
        actorSnapshotId: input.actorSnapshotId,
        occurredAt: now,
      });
      const otherRevisionIds = currentQuoteLines
        .map((line) => line.jobRevisionId)
        .filter((revisionId) => revisionId !== job.currentRevisionId);
      const otherJobs = otherRevisionIds.length
        ? await transaction.query.jobs.findMany({
            where: and(
              eq(jobs.shopId, input.shopId),
              eq(jobs.orderId, input.orderId),
              inArray(jobs.currentRevisionId, otherRevisionIds),
              sql`${jobs.workflowState} <> 'canceled'`,
            ),
          })
        : [];
      for (const otherJob of otherJobs) {
        await transaction
          .update(jobs)
          .set({
            blockerProjection: withBlocker(
              otherJob.blockerProjection,
              "quote_response",
            ),
            version: sql`${jobs.version} + 1`,
            updatedAt: now,
          })
          .where(eq(jobs.id, otherJob.id));
      }
    }
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "job.revised",
      actorSnapshotId: input.actorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        job_revision_id: revisionId,
        reason: input.reason,
      },
      correlationId: randomUUID(),
    });
    return { jobRevisionId: revisionId };
  });
}

export async function recordPriceAcceptance(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  jobRevisionId: string;
  expectedOrderVersion: number;
  expectedJobVersion: number;
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
    const [job] = await transaction
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          eq(jobs.id, input.jobId),
          eq(jobs.currentRevisionId, input.jobRevisionId),
        ),
      )
      .for("update");
    if (!order || !job) throw new Error("superseded");
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    ) {
      throw new Error("stale_version");
    }
    if (order.terminalState !== "active") throw new Error("invalid_transition");
    const existing = await transaction.query.priceAcceptances.findMany({
      where: eq(priceAcceptances.jobRevisionId, input.jobRevisionId),
    });
    if (existing.length > 0) throw new Error("conflict");
    const [acceptance] = await transaction
      .insert(priceAcceptances)
      .values({
        shopId: input.shopId,
        jobRevisionId: input.jobRevisionId,
        sequenceNumber: 1,
        customerActorSnapshotId: input.customerActorSnapshotId,
        channel: input.channel,
        acceptedAt: new Date(),
        recordedByMembershipId: input.recordedByMembershipId,
      })
      .returning();
    const blockers = Array.isArray(job.blockerProjection.blockers)
      ? job.blockerProjection.blockers.filter(
          (blocker) => blocker !== "price_acceptance",
        )
      : [];
    await transaction
      .update(jobs)
      .set({
        blockerProjection: {
          schema_version: "blocker_projection.v1",
          blockers,
        },
        version: sql`${jobs.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
    const activityId = randomUUID();
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      id: activityId,
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "price.accepted",
      actorSnapshotId: input.customerActorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        job_revision_id: input.jobRevisionId,
        price_acceptance_id: acceptance.id,
      },
      correlationId: randomUUID(),
    });
    return acceptance;
  });
}

export async function correctPriceAcceptance(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  jobRevisionId: string;
  correctsAcceptanceId: string;
  recordedByMembershipId: string;
  adminActorSnapshotId: string;
  reason: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    const [job] = await transaction
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          eq(jobs.id, input.jobId),
          eq(jobs.currentRevisionId, input.jobRevisionId),
        ),
      )
      .for("update");
    if (!order || !job) throw new Error("superseded");

    const effective = await transaction.query.priceAcceptances.findFirst({
      where: eq(priceAcceptances.jobRevisionId, input.jobRevisionId),
      orderBy: [desc(priceAcceptances.sequenceNumber)],
    });
    if (!effective || effective.id !== input.correctsAcceptanceId) {
      throw new Error("conflict");
    }

    const [correction] = await transaction
      .insert(priceAcceptances)
      .values({
        shopId: input.shopId,
        jobRevisionId: input.jobRevisionId,
        sequenceNumber: effective.sequenceNumber + 1,
        customerActorSnapshotId: effective.customerActorSnapshotId,
        channel: effective.channel,
        acceptedAt: new Date(),
        recordedByMembershipId: input.recordedByMembershipId,
        correctsAcceptanceId: effective.id,
      })
      .returning();
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "price.acceptance_corrected",
      actorSnapshotId: input.adminActorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        acceptance_id: correction.id,
        corrects_acceptance_id: effective.id,
        reason: input.reason,
      },
      correlationId: randomUUID(),
    });
    return correction;
  });
}

export async function cancelOrder(input: {
  shopId: string;
  orderId: string;
  expectedOrderVersion: number;
  reason: string;
  actorSnapshotId: string;
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
    const now = new Date();
    await transaction
      .update(jobs)
      .set({
        workflowState: "canceled",
        canceledAt: now,
        version: sql`${jobs.version} + 1`,
      })
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          sql`${jobs.workflowState} <> 'canceled'`,
        ),
      );
    await transaction
      .update(orders)
      .set({
        terminalState: "canceled",
        canceledAt: now,
        cancellationReason: input.reason,
        version: sql`${orders.version} + 1`,
        updatedAt: now,
      })
      .where(eq(orders.id, input.orderId));
    const activityId = randomUUID();
    await transaction.insert(orderActivityEntries).values({
      id: activityId,
      shopId: input.shopId,
      orderId: input.orderId,
      actionType: "order.canceled",
      actorSnapshotId: input.actorSnapshotId,
      details: { schema_version: "order_activity.v1", reason: input.reason },
      correlationId: randomUUID(),
    });
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "order.terminal.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        activity_entry_id: activityId,
        template_version: "order_canceled.v1",
      },
    });
    return { canceledAt: now };
  });
}

export async function collectOrder(input: {
  shopId: string;
  orderId: string;
  expectedOrderVersion: number;
  actorSnapshotId: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    const orderJobs = await transaction
      .select()
      .from(jobs)
      .where(
        and(eq(jobs.shopId, input.shopId), eq(jobs.orderId, input.orderId)),
      )
      .for("update");

    if (!order) throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion)
      throw new Error("stale_version");
    const activeJobs = orderJobs.filter(
      (job) => job.workflowState !== "canceled",
    );
    if (
      order.terminalState !== "active" ||
      !isOrderReady(
        activeJobs.map((job) => job.workflowState as JobWorkflowState),
        activeJobs.reduce(
          (count, job) =>
            count +
            blockerCount(job.blockerProjection) +
            (job.productionHold ? 1 : 0),
          0,
        ),
      )
    ) {
      throw new Error("invalid_transition");
    }

    const now = new Date();
    await transaction
      .update(orders)
      .set({
        terminalState: "collected",
        collectedAt: now,
        version: sql`${orders.version} + 1`,
        updatedAt: now,
      })
      .where(eq(orders.id, input.orderId));
    const activityId = randomUUID();
    await transaction.insert(orderActivityEntries).values({
      id: activityId,
      shopId: input.shopId,
      orderId: input.orderId,
      actionType: "order.collected",
      actorSnapshotId: input.actorSnapshotId,
      details: { schema_version: "order_activity.v1" },
      correlationId: randomUUID(),
    });
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "order.terminal.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        activity_entry_id: activityId,
        template_version: "order_collected.v1",
      },
    });

    return { collectedAt: now };
  });
}

export async function addInternalNote(input: {
  shopId: string;
  orderId: string;
  jobId?: string;
  body: string;
  authorSnapshotId: string;
  authority: OrderAuthority;
  expectedOrderVersion: number;
}) {
  requireAdminAuthority(input.authority, input.shopId);
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order) throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion) {
      throw new Error("stale_version");
    }
    if (input.jobId) {
      const [job] = await transaction
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.shopId, input.shopId),
            eq(jobs.orderId, input.orderId),
            eq(jobs.id, input.jobId),
          ),
        )
        .for("update");
      if (!job) throw new Error("not_found");
    }
    const [note] = await transaction
      .insert(internalNotes)
      .values({
        shopId: input.shopId,
        orderId: input.orderId,
        jobId: input.jobId,
        body: input.body,
        authorSnapshotId: input.authorSnapshotId,
      })
      .returning();
    const now = new Date();
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "internal_note.added",
      actorSnapshotId: input.authorSnapshotId,
      details: { schema_version: "order_activity.v1", note_id: note.id },
      correlationId: randomUUID(),
    });
    return note;
  });
}

export async function recordProductionException(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  blockerType: keyof typeof blockerTypes;
  blockedTargetType: string;
  blockedTargetId: string;
  reason: string;
  actorSnapshotId: string;
  expiresAt?: Date;
  authority: OrderAuthority;
  expectedOrderVersion: number;
  expectedJobVersion: number;
}) {
  requireAdminAuthority(input.authority, input.shopId);
  if (!blockerTypes[input.blockerType]?.exceptionAllowed) {
    throw new Error("validation_failed");
  }

  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    const [job] = await transaction
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          eq(jobs.id, input.jobId),
        ),
      )
      .for("update");
    if (!order || !job) throw new Error("not_found");
    if (order.terminalState !== "active") {
      throw new Error("invalid_transition");
    }
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    ) {
      throw new Error("stale_version");
    }
    const blockers = Array.isArray(job.blockerProjection.blockers)
      ? job.blockerProjection.blockers.filter(
          (blocker): blocker is string => typeof blocker === "string",
        )
      : [];
    if (
      input.blockerType !== "proof_approval" ||
      input.blockedTargetType !== "proof_version" ||
      !job.currentProofVersionId ||
      input.blockedTargetId !== job.currentProofVersionId ||
      !blockers.includes("proof_approval")
    ) {
      throw new Error("superseded");
    }
    const [{ now: databaseNow }] = await transaction.execute<{
      now: string;
    }>(sql`select now() as now`);
    const now = new Date(databaseNow);
    if (input.expiresAt && input.expiresAt <= now) {
      throw new Error("validation_failed");
    }
    const [exception] = await transaction
      .insert(productionExceptions)
      .values({
        shopId: input.shopId,
        jobId: input.jobId,
        blockerType: input.blockerType,
        blockedTargetType: input.blockedTargetType,
        blockedTargetId: input.blockedTargetId,
        reason: input.reason,
        adminActorSnapshotId: input.actorSnapshotId,
        expiresAt: input.expiresAt,
      })
      .returning();
    await transaction
      .update(jobs)
      .set({ version: sql`${jobs.version} + 1`, updatedAt: now })
      .where(eq(jobs.id, input.jobId));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "production.exception_recorded",
      actorSnapshotId: input.actorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        exception_id: exception.id,
        blocker_type: input.blockerType,
        blocked_target_type: input.blockedTargetType,
        blocked_target_id: input.blockedTargetId,
      },
      correlationId: randomUUID(),
    });
    return exception;
  });
}
