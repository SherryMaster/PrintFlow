import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  artworkItems,
  artworkReviewDecisions,
  artworkVersions,
  jobs,
  orderAccessGrants,
  orderActivityEntries,
  orders,
  outboxEvents,
  productionExceptions,
  proofArtworkSources,
  proofDecisions,
  proofVersions,
  storedObjects,
  uploadIntents,
  uploadSessions,
} from "@/db/schema";
import {
  type OrderAuthority,
  requireAdminAuthority,
  requireOrderAuthority,
} from "@/modules/orders/authorization";
import { withBlocker, withoutBlocker } from "@/modules/orders/model";

export async function attachArtworkVersion(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  purpose: string;
  storedObjectId: string;
  uploaderSnapshotId: string;
  requiredChecks: readonly string[];
  authority: OrderAuthority;
  expectedOrderVersion: number;
  expectedJobVersion: number;
}) {
  requireOrderAuthority(
    input.authority,
    input.shopId,
    input.orderId,
    "artwork:upload",
  );
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order || order.terminalState !== "active")
      throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion) {
      throw new Error("stale_version");
    }
    const [object] = await transaction
      .select({ storedObject: storedObjects })
      .from(storedObjects)
      .innerJoin(
        uploadIntents,
        and(
          eq(uploadIntents.shopId, storedObjects.shopId),
          eq(uploadIntents.id, storedObjects.uploadIntentId),
        ),
      )
      .innerJoin(
        uploadSessions,
        and(
          eq(uploadSessions.shopId, uploadIntents.shopId),
          eq(uploadSessions.id, uploadIntents.uploadSessionId),
          eq(uploadSessions.orderId, input.orderId),
          eq(uploadSessions.jobId, input.jobId),
          eq(uploadSessions.purpose, "artwork"),
        ),
      )
      .where(
        and(
          eq(storedObjects.shopId, input.shopId),
          eq(storedObjects.id, input.storedObjectId),
          eq(storedObjects.validationState, "accepted"),
        ),
      )
      .limit(1);
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
    if (job && job.version !== input.expectedJobVersion) {
      throw new Error("stale_version");
    }
    if (
      !object ||
      !job ||
      object.storedObject.bytesDeletedAt ||
      object.storedObject.scanState === "failed" ||
      object.storedObject.attachedAt
    ) {
      throw new Error("quarantined");
    }

    let item = await transaction.query.artworkItems.findFirst({
      where: and(
        eq(artworkItems.shopId, input.shopId),
        eq(artworkItems.jobId, input.jobId),
        eq(artworkItems.purpose, input.purpose),
      ),
    });
    if (!item) {
      [item] = await transaction
        .insert(artworkItems)
        .values({
          shopId: input.shopId,
          jobId: input.jobId,
          purpose: input.purpose,
          requiredChecks: {
            schema_version: "artwork_checks.v1",
            checks: input.requiredChecks,
          },
        })
        .returning();
    }
    const existing = await transaction.query.artworkVersions.findMany({
      where: eq(artworkVersions.artworkItemId, item.id),
    });
    const versionId = randomUUID();
    await transaction.insert(artworkVersions).values({
      id: versionId,
      shopId: input.shopId,
      artworkItemId: item.id,
      storedObjectId: input.storedObjectId,
      versionNumber: existing.length + 1,
      uploaderSnapshotId: input.uploaderSnapshotId,
    });
    await transaction
      .update(artworkItems)
      .set({
        currentVersionId: versionId,
        currentReview: null,
        updatedAt: new Date(),
      })
      .where(eq(artworkItems.id, item.id));
    await transaction
      .update(jobs)
      .set({
        productionHold: existing.length > 0,
        productionHoldReason:
          existing.length > 0
            ? "artwork_version_replaced"
            : job.productionHoldReason,
        currentProofVersionId:
          existing.length > 0 ? null : job.currentProofVersionId,
        blockerProjection: withBlocker(
          existing.length > 0
            ? withBlocker(job.blockerProjection, "proof_approval")
            : job.blockerProjection,
          "artwork_review",
        ),
        version: sql`${jobs.version} + 1`,
      })
      .where(eq(jobs.id, input.jobId));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await transaction
      .update(storedObjects)
      .set({ attachedAt: new Date() })
      .where(eq(storedObjects.id, input.storedObjectId));
    const activityId = randomUUID();
    await transaction.insert(orderActivityEntries).values({
      id: activityId,
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "artwork.version_attached",
      actorSnapshotId: input.uploaderSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        artwork_version_id: versionId,
      },
      correlationId: randomUUID(),
    });
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "artwork.review_requested.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        job_id: input.jobId,
        artwork_version_id: versionId,
        activity_entry_id: activityId,
      },
    });

    return { artworkItemId: item.id, artworkVersionId: versionId };
  });
}

export async function recordArtworkReview(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  artworkVersionId: string;
  decision: "accepted" | "declined";
  reason: string;
  actorSnapshotId: string;
  authority: OrderAuthority;
  expectedOrderVersion: number;
  expectedJobVersion: number;
}) {
  requireAdminAuthority(input.authority, input.shopId);
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
    if (!order || order.terminalState !== "active" || !job) {
      throw new Error("not_found");
    }
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    ) {
      throw new Error("stale_version");
    }
    const version = await transaction.query.artworkVersions.findFirst({
      where: and(
        eq(artworkVersions.shopId, input.shopId),
        eq(artworkVersions.id, input.artworkVersionId),
      ),
    });
    const item = version
      ? await transaction.query.artworkItems.findFirst({
          where: and(
            eq(artworkItems.id, version.artworkItemId),
            eq(artworkItems.jobId, input.jobId),
            eq(artworkItems.currentVersionId, version.id),
          ),
        })
      : undefined;
    if (!version || !item) throw new Error("superseded");
    const object = await transaction.query.storedObjects.findFirst({
      where: and(
        eq(storedObjects.shopId, input.shopId),
        eq(storedObjects.id, version.storedObjectId),
      ),
    });
    const checks = Array.isArray(item.requiredChecks.checks)
      ? item.requiredChecks.checks.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const scanRequired = checks.some((check) =>
      ["scan", "malware_scan"].includes(check),
    );
    if (
      !object ||
      object.validationState !== "accepted" ||
      object.bytesDeletedAt ||
      object.scanState === "failed" ||
      (scanRequired && object.scanState !== "passed")
    ) {
      throw new Error("quarantined");
    }

    const prior = await transaction.query.artworkReviewDecisions.findMany({
      where: eq(
        artworkReviewDecisions.artworkVersionId,
        input.artworkVersionId,
      ),
    });
    const [review] = await transaction
      .insert(artworkReviewDecisions)
      .values({
        shopId: input.shopId,
        jobId: input.jobId,
        artworkVersionId: input.artworkVersionId,
        sequenceNumber: prior.length + 1,
        decision: input.decision,
        reason: input.reason,
        actorSnapshotId: input.actorSnapshotId,
        channel: "admin",
        decidedAt: new Date(),
      })
      .returning();
    await transaction
      .update(artworkItems)
      .set({
        currentReview: input.decision,
        productionVersionId:
          input.decision === "accepted" ? input.artworkVersionId : null,
        updatedAt: new Date(),
      })
      .where(eq(artworkItems.id, item.id));
    const otherItems = await transaction.query.artworkItems.findMany({
      where: and(
        eq(artworkItems.shopId, input.shopId),
        eq(artworkItems.jobId, input.jobId),
      ),
    });
    const everyArtworkAccepted = otherItems.every((candidate) =>
      candidate.id === item.id
        ? input.decision === "accepted"
        : candidate.currentReview === "accepted",
    );
    await transaction
      .update(jobs)
      .set({
        blockerProjection: everyArtworkAccepted
          ? withoutBlocker(job.blockerProjection, "artwork_review")
          : withBlocker(job.blockerProjection, "artwork_review"),
        version: sql`${jobs.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "artwork.review_recorded",
      actorSnapshotId: input.actorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        artwork_version_id: input.artworkVersionId,
        decision: input.decision,
      },
      correlationId: randomUUID(),
    });
    return review;
  });
}

export async function createProof(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  jobRevisionId: string;
  storedObjectId: string;
  artworkVersionIds: readonly string[];
  creatorSnapshotId: string;
  message?: string;
  activeGrantId?: string;
  authority: OrderAuthority;
  expectedOrderVersion: number;
  expectedJobVersion: number;
}) {
  requireAdminAuthority(input.authority, input.shopId);
  if (input.artworkVersionIds.length === 0)
    throw new Error("validation_failed");
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order || order.terminalState !== "active")
      throw new Error("not_found");
    if (order.version !== input.expectedOrderVersion) {
      throw new Error("stale_version");
    }
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
    if (job && job.version !== input.expectedJobVersion) {
      throw new Error("stale_version");
    }
    const [proofObject] = await transaction
      .select({ storedObject: storedObjects })
      .from(storedObjects)
      .innerJoin(
        uploadIntents,
        and(
          eq(uploadIntents.shopId, storedObjects.shopId),
          eq(uploadIntents.id, storedObjects.uploadIntentId),
        ),
      )
      .innerJoin(
        uploadSessions,
        and(
          eq(uploadSessions.shopId, uploadIntents.shopId),
          eq(uploadSessions.id, uploadIntents.uploadSessionId),
          eq(uploadSessions.orderId, input.orderId),
          eq(uploadSessions.jobId, input.jobId),
          eq(uploadSessions.purpose, "proof"),
        ),
      )
      .where(
        and(
          eq(storedObjects.shopId, input.shopId),
          eq(storedObjects.id, input.storedObjectId),
          eq(storedObjects.validationState, "accepted"),
        ),
      )
      .limit(1);
    const sources = await transaction.query.artworkVersions.findMany({
      where: eq(artworkVersions.shopId, input.shopId),
    });
    const selected = sources.filter((source) =>
      input.artworkVersionIds.includes(source.id),
    );
    if (
      !job ||
      !proofObject ||
      proofObject.storedObject.attachedAt ||
      proofObject.storedObject.bytesDeletedAt ||
      proofObject.storedObject.scanState === "failed" ||
      proofObject.storedObject.scanState === "pending" ||
      selected.length !== input.artworkVersionIds.length
    ) {
      throw new Error("stale_version");
    }
    const items = await transaction.query.artworkItems.findMany({
      where: and(
        eq(artworkItems.shopId, input.shopId),
        eq(artworkItems.jobId, input.jobId),
      ),
    });
    if (
      selected.some(
        (source) =>
          !items.some(
            (item) =>
              item.id === source.artworkItemId &&
              item.currentVersionId === source.id,
          ),
      )
    ) {
      throw new Error("stale_version");
    }
    const prior = await transaction.query.proofVersions.findMany({
      where: eq(proofVersions.jobId, input.jobId),
    });
    const proofId = randomUUID();
    await transaction.insert(proofVersions).values({
      id: proofId,
      shopId: input.shopId,
      jobId: input.jobId,
      jobRevisionId: input.jobRevisionId,
      storedObjectId: input.storedObjectId,
      versionNumber: prior.length + 1,
      creatorSnapshotId: input.creatorSnapshotId,
      message: input.message,
    });
    await transaction.insert(proofArtworkSources).values(
      selected.map((source) => ({
        shopId: input.shopId,
        proofVersionId: proofId,
        artworkVersionId: source.id,
      })),
    );
    await transaction
      .update(jobs)
      .set({
        currentProofVersionId: proofId,
        blockerProjection: withBlocker(job.blockerProjection, "proof_approval"),
        version: sql`${jobs.version} + 1`,
      })
      .where(eq(jobs.id, input.jobId));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await transaction
      .update(storedObjects)
      .set({ attachedAt: new Date() })
      .where(eq(storedObjects.id, input.storedObjectId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "proof.created",
      actorSnapshotId: input.creatorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        proof_version_id: proofId,
      },
      correlationId: randomUUID(),
    });
    if (input.activeGrantId) {
      const grant = await transaction.query.orderAccessGrants.findFirst({
        where: and(
          eq(orderAccessGrants.shopId, input.shopId),
          eq(orderAccessGrants.orderId, input.orderId),
          eq(orderAccessGrants.id, input.activeGrantId),
          eq(orderAccessGrants.state, "active"),
        ),
      });
      if (!grant) throw new Error("not_found");
      await transaction.insert(outboxEvents).values({
        shopId: input.shopId,
        aggregateType: "order",
        aggregateId: input.orderId,
        eventType: "proof.delivery_requested.v1",
        payload: {
          schema_version: "1",
          order_id: input.orderId,
          job_id: input.jobId,
          proof_version_id: proofId,
          active_grant_id: input.activeGrantId,
          template_version: "proof_delivery.v1",
        },
      });
    }
    return { proofVersionId: proofId };
  });
}

export async function recordProofDecision(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  proofVersionId: string;
  decision: "accepted" | "declined";
  reason?: string;
  customerActorSnapshotId: string;
  channel: string;
  authority: OrderAuthority;
  expectedOrderVersion: number;
  expectedJobVersion: number;
}) {
  requireOrderAuthority(
    input.authority,
    input.shopId,
    input.orderId,
    "proof:respond",
  );
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
          eq(jobs.currentProofVersionId, input.proofVersionId),
        ),
      )
      .for("update");
    if (!order || order.terminalState !== "active" || !job) {
      throw new Error("superseded");
    }
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    ) {
      throw new Error("stale_version");
    }
    const prior = await transaction.query.proofDecisions.findMany({
      where: eq(proofDecisions.proofVersionId, input.proofVersionId),
    });
    if (prior.length > 0) throw new Error("conflict");
    const [proofDecision] = await transaction
      .insert(proofDecisions)
      .values({
        shopId: input.shopId,
        proofVersionId: input.proofVersionId,
        sequenceNumber: 1,
        decision: input.decision,
        reason: input.reason,
        customerActorSnapshotId: input.customerActorSnapshotId,
        channel: input.channel,
        recordedAt: new Date(),
      })
      .returning();
    await transaction
      .update(jobs)
      .set({
        blockerProjection:
          input.decision === "accepted"
            ? withoutBlocker(job.blockerProjection, "proof_approval")
            : withBlocker(job.blockerProjection, "proof_approval"),
        version: sql`${jobs.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "proof.decision_recorded",
      actorSnapshotId: input.customerActorSnapshotId,
      details: {
        schema_version: "order_activity.v1",
        proof_version_id: input.proofVersionId,
        decision: input.decision,
      },
      correlationId: randomUUID(),
    });
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "proof.response_recorded.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        job_id: input.jobId,
        proof_decision_id: proofDecision.id,
        template_version: "proof_response.v1",
      },
    });
    return proofDecision;
  });
}

export async function clearProductionHold(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  expectedJobVersion: number;
  expectedOrderVersion: number;
  actorSnapshotId: string;
  reason: string;
  authority: OrderAuthority;
}) {
  requireAdminAuthority(input.authority, input.shopId);
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
    if (!order || order.terminalState !== "active" || !job) {
      throw new Error("not_found");
    }
    if (
      order.version !== input.expectedOrderVersion ||
      job.version !== input.expectedJobVersion
    )
      throw new Error("stale_version");
    if (
      Array.isArray(job.blockerProjection.blockers) &&
      job.blockerProjection.blockers.length
    ) {
      const [{ now: databaseNow }] = await transaction.execute<{
        now: string;
      }>(sql`select now() as now`);
      const now = new Date(databaseNow);
      const activeException = job.currentProofVersionId
        ? await transaction.query.productionExceptions.findFirst({
            where: and(
              eq(productionExceptions.shopId, input.shopId),
              eq(productionExceptions.jobId, input.jobId),
              eq(productionExceptions.blockerType, "proof_approval"),
              eq(productionExceptions.blockedTargetType, "proof_version"),
              eq(
                productionExceptions.blockedTargetId,
                job.currentProofVersionId,
              ),
              or(
                isNull(productionExceptions.expiresAt),
                gt(productionExceptions.expiresAt, now),
              ),
            ),
            orderBy: [desc(productionExceptions.createdAt)],
          })
        : undefined;
      const blockers = job.blockerProjection.blockers.filter(
        (blocker): blocker is string => typeof blocker === "string",
      );
      const unresolvedBlockers = activeException
        ? blockers.filter((blocker) => blocker !== "proof_approval")
        : blockers;
      if (unresolvedBlockers.length) {
        throw new Error("invalid_transition");
      }
      await transaction
        .update(jobs)
        .set({
          blockerProjection: {
            schema_version: "blocker_projection.v1",
            blockers: unresolvedBlockers,
          },
          productionHold: false,
          productionHoldReason: null,
          version: sql`${jobs.version} + 1`,
          updatedAt: now,
        })
        .where(eq(jobs.id, input.jobId));
      await transaction
        .update(orders)
        .set({ version: sql`${orders.version} + 1`, updatedAt: now })
        .where(eq(orders.id, input.orderId));
      await transaction.insert(orderActivityEntries).values({
        shopId: input.shopId,
        orderId: input.orderId,
        jobId: input.jobId,
        actionType: "production.hold_cleared",
        actorSnapshotId: input.actorSnapshotId,
        details: {
          schema_version: "order_activity.v1",
          reason: input.reason,
          production_exception_id: activeException?.id,
        },
        correlationId: randomUUID(),
      });
      return { cleared: true };
    }
    const now = new Date();
    await transaction
      .update(jobs)
      .set({
        productionHold: false,
        productionHoldReason: null,
        version: sql`${jobs.version} + 1`,
        updatedAt: now,
      })
      .where(eq(jobs.id, input.jobId));
    await transaction
      .update(orders)
      .set({ version: sql`${orders.version} + 1`, updatedAt: now })
      .where(eq(orders.id, input.orderId));
    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId: input.orderId,
      jobId: input.jobId,
      actionType: "production.hold_cleared",
      actorSnapshotId: input.actorSnapshotId,
      details: { schema_version: "order_activity.v1", reason: input.reason },
      correlationId: randomUUID(),
    });
    return { cleared: true };
  });
}
