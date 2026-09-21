import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import {
  artworkItems,
  artworkVersions,
  draftJobObjects,
  draftJobs,
  jobs,
  orders,
  orderDrafts,
  outboxEvents,
  proofVersions,
  shopMemberships,
  storedObjects,
  uploadIntents,
  uploadSessions,
} from "@/db/schema";
import {
  type OrderAuthority,
  requireOrderAuthority,
} from "@/modules/orders/authorization";
import { hashCapability } from "@/modules/orders/capabilities";

const maxFileBytes = 250n * 1024n * 1024n;
const maxSessionBytes = 500n * 1024n * 1024n;

const uploadPurposeSchema = z.enum(["artwork", "proof"]);

type UploadSessionAuthority =
  OrderAuthority | { kind: "draft"; capability: string };

function requireMatchingSessionAuthority(
  session: typeof uploadSessions.$inferSelect,
  authority: UploadSessionAuthority,
): void {
  if (session.ownerType === "draft") {
    if (
      authority.kind !== "draft" ||
      session.capabilityHash !== hashCapability(authority.capability)
    ) {
      throw new Error("not_found");
    }
    return;
  }

  if (authority.kind === "draft" || authority.shopId !== session.shopId) {
    throw new Error("not_found");
  }
  if (
    authority.kind === "guest" &&
    (authority.orderId !== session.orderId ||
      authority.grantId !== session.authorizingGrantId ||
      !authority.scopes.includes("artwork:upload"))
  ) {
    throw new Error("not_found");
  }
  if (
    authority.kind === "admin" &&
    authority.membershipId !== session.authorizingMembershipId
  ) {
    throw new Error("not_found");
  }
}

export async function createOrderUploadSession(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  purpose: z.input<typeof uploadPurposeSchema>;
  authority: OrderAuthority;
}) {
  const purpose = uploadPurposeSchema.parse(input.purpose);
  requireOrderAuthority(
    input.authority,
    input.shopId,
    input.orderId,
    "artwork:upload",
  );
  if (input.authority.kind === "guest" && purpose !== "artwork") {
    throw new Error("not_found");
  }

  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [job] = await transaction
      .select({ terminalState: orders.terminalState })
      .from(jobs)
      .innerJoin(
        orders,
        and(eq(orders.shopId, jobs.shopId), eq(orders.id, jobs.orderId)),
      )
      .where(
        and(
          eq(jobs.shopId, input.shopId),
          eq(jobs.orderId, input.orderId),
          eq(jobs.id, input.jobId),
        ),
      )
      .for("update");
    if (!job || job.terminalState !== "active") {
      throw new Error("not_found");
    }

    const now = new Date();
    if (input.authority.kind === "admin") {
      const membership = await transaction.query.shopMemberships.findFirst({
        where: and(
          eq(shopMemberships.shopId, input.shopId),
          eq(shopMemberships.id, input.authority.membershipId),
          eq(shopMemberships.active, true),
          eq(shopMemberships.role, "admin"),
        ),
      });
      if (!membership) throw new Error("not_found");
    }

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [session] = await transaction
      .insert(uploadSessions)
      .values({
        shopId: input.shopId,
        ownerType: "order",
        orderId: input.orderId,
        jobId: input.jobId,
        purpose,
        authorizingGrantId:
          input.authority.kind === "guest"
            ? input.authority.grantId
            : undefined,
        authorizingMembershipId:
          input.authority.kind === "admin"
            ? input.authority.membershipId
            : undefined,
        byteQuota: maxSessionBytes,
        expiresAt,
      })
      .returning();

    return session;
  });
}

export async function createUploadIntent(input: {
  shopId: string;
  uploadSessionId: string;
  authority: UploadSessionAuthority;
  filename: string;
  mediaType: string;
  requestedBytes: bigint;
}) {
  if (input.requestedBytes <= 0n || input.requestedBytes > maxFileBytes) {
    throw new Error("validation_failed");
  }

  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [session] = await transaction
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.shopId, input.shopId),
          eq(uploadSessions.id, input.uploadSessionId),
        ),
      )
      .for("update");

    if (!session) throw new Error("not_found");
    requireMatchingSessionAuthority(session, input.authority);

    if (
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.reservedBytes + session.acceptedBytes + input.requestedBytes >
        session.byteQuota
    ) {
      throw new Error("validation_failed");
    }

    const intentId = randomUUID();
    const quarantineKey = `quarantine/${input.shopId}/${intentId}`;
    const [intent] = await transaction
      .insert(uploadIntents)
      .values({
        id: intentId,
        shopId: input.shopId,
        uploadSessionId: input.uploadSessionId,
        quarantineKey,
        declaredFilename: input.filename,
        declaredMediaType: input.mediaType,
        reservedBytes: input.requestedBytes,
        uploadUrlExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
      .returning();
    await transaction
      .update(uploadSessions)
      .set({
        reservedBytes: sql`${uploadSessions.reservedBytes} + ${input.requestedBytes}`,
        version: sql`${uploadSessions.version} + 1`,
      })
      .where(eq(uploadSessions.id, input.uploadSessionId));

    return intent;
  });
}

export async function attachDraftJobObject(input: {
  shopId: string;
  draftId: string;
  draftJobId: string;
  uploadSessionId: string;
  storedObjectId: string;
  purpose: string;
  capability: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const draft = await transaction.query.orderDrafts.findFirst({
      where: and(
        eq(orderDrafts.shopId, input.shopId),
        eq(orderDrafts.id, input.draftId),
        eq(orderDrafts.capabilityHash, hashCapability(input.capability)),
      ),
    });
    const draftJob = await transaction.query.draftJobs.findFirst({
      where: and(
        eq(draftJobs.shopId, input.shopId),
        eq(draftJobs.orderDraftId, input.draftId),
        eq(draftJobs.id, input.draftJobId),
      ),
    });
    const session = await transaction.query.uploadSessions.findFirst({
      where: and(
        eq(uploadSessions.shopId, input.shopId),
        eq(uploadSessions.id, input.uploadSessionId),
        eq(uploadSessions.orderDraftId, input.draftId),
      ),
    });
    const [object] = await transaction
      .select({
        storedObject: storedObjects,
        intentSessionId: uploadIntents.uploadSessionId,
      })
      .from(storedObjects)
      .innerJoin(
        uploadIntents,
        and(
          eq(uploadIntents.shopId, storedObjects.shopId),
          eq(uploadIntents.id, storedObjects.uploadIntentId),
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

    if (
      !draft ||
      draft.submittedAt ||
      draft.revokedAt ||
      draft.expiresAt <= new Date() ||
      !draftJob ||
      !session ||
      session.expiresAt <= new Date() ||
      session.capabilityHash !== hashCapability(input.capability) ||
      !object ||
      object.intentSessionId !== session.id ||
      object.storedObject.attachedAt
    ) {
      throw new Error("not_found");
    }

    await transaction.insert(draftJobObjects).values({
      shopId: input.shopId,
      draftJobId: input.draftJobId,
      storedObjectId: input.storedObjectId,
      purpose: input.purpose,
    });
    await transaction
      .update(storedObjects)
      .set({ attachedAt: new Date() })
      .where(eq(storedObjects.id, input.storedObjectId));
    return { attached: true } as const;
  });
}

const acceptMetadataSchema = z
  .object({
    objectKey: z.string().min(1),
    etag: z.string().min(1),
    measuredMediaType: z.string().min(1),
    measuredSize: z.bigint().positive(),
    checksum: z.string().min(1),
    signatureValid: z.boolean(),
    scanState: z.enum(["not_required", "pending", "passed", "failed"]),
  })
  .strict();

export async function acceptStoredObject(input: {
  shopId: string;
  uploadIntentId: string;
  metadata: z.input<typeof acceptMetadataSchema>;
}) {
  const metadata = acceptMetadataSchema.parse(input.metadata);
  const { db } = getDatabase();

  const result = await db.transaction(async (transaction) => {
    const [intent] = await transaction
      .select()
      .from(uploadIntents)
      .where(
        and(
          eq(uploadIntents.shopId, input.shopId),
          eq(uploadIntents.id, input.uploadIntentId),
        ),
      )
      .for("update");
    if (!intent || intent.state !== "pending") throw new Error("conflict");

    const accepted =
      metadata.signatureValid &&
      metadata.measuredSize <= intent.reservedBytes &&
      metadata.scanState !== "failed";
    const now = new Date();

    if (!accepted) {
      await transaction
        .update(uploadIntents)
        .set({
          state: "rejected",
          rejectedAt: now,
          rejectionReason: "authoritative_validation_failed",
        })
        .where(eq(uploadIntents.id, intent.id));
      await transaction
        .update(uploadSessions)
        .set({
          reservedBytes: sql`${uploadSessions.reservedBytes} - ${intent.reservedBytes}`,
        })
        .where(eq(uploadSessions.id, intent.uploadSessionId));
      await transaction.insert(outboxEvents).values({
        shopId: input.shopId,
        aggregateType: "upload_session",
        aggregateId: intent.uploadSessionId,
        eventType: "file.rejected.v1",
        payload: {
          schema_version: "1",
          upload_session_id: intent.uploadSessionId,
          upload_intent_id: intent.id,
          rejection_category: "authoritative_validation_failed",
        },
      });
      return { accepted: false as const };
    }

    const [storedObject] = await transaction
      .insert(storedObjects)
      .values({
        shopId: input.shopId,
        uploadIntentId: intent.id,
        objectKey: metadata.objectKey,
        etag: metadata.etag,
        originalFilename: intent.declaredFilename,
        measuredMediaType: metadata.measuredMediaType,
        measuredSize: metadata.measuredSize,
        checksum: metadata.checksum,
        validationState: "accepted",
        scanState: metadata.scanState,
      })
      .returning();
    await transaction
      .update(uploadIntents)
      .set({ state: "accepted", completedAt: now })
      .where(eq(uploadIntents.id, intent.id));
    await transaction
      .update(uploadSessions)
      .set({
        reservedBytes: sql`${uploadSessions.reservedBytes} - ${intent.reservedBytes}`,
        acceptedBytes: sql`${uploadSessions.acceptedBytes} + ${metadata.measuredSize}`,
      })
      .where(eq(uploadSessions.id, intent.uploadSessionId));
    await transaction.insert(outboxEvents).values({
      shopId: input.shopId,
      aggregateType: "upload_session",
      aggregateId: intent.uploadSessionId,
      eventType: "file.accepted.v1",
      payload: {
        schema_version: "1",
        upload_session_id: intent.uploadSessionId,
        upload_intent_id: intent.id,
        stored_object_id: storedObject.id,
        measured_media_type: metadata.measuredMediaType,
        measured_size: metadata.measuredSize.toString(10),
      },
    });

    return { accepted: true as const, storedObject };
  });

  if (!result.accepted) {
    throw new Error("quarantined");
  }

  return result.storedObject;
}

export async function authorizeFileDownload(input: {
  shopId: string;
  orderId: string;
  jobId: string;
  storedObjectId: string;
  authority: OrderAuthority;
  signDownload: (input: {
    objectKey: string;
    filename: string | null;
    expiresInSeconds: 300;
  }) => Promise<string>;
}) {
  requireOrderAuthority(
    input.authority,
    input.shopId,
    input.orderId,
    "order:read",
  );
  const { db } = getDatabase();
  const [object] = await db
    .select({
      objectKey: storedObjects.objectKey,
      filename: storedObjects.originalFilename,
      validationState: storedObjects.validationState,
      scanState: storedObjects.scanState,
      bytesDeletedAt: storedObjects.bytesDeletedAt,
    })
    .from(storedObjects)
    .leftJoin(
      artworkVersions,
      and(
        eq(artworkVersions.shopId, storedObjects.shopId),
        eq(artworkVersions.storedObjectId, storedObjects.id),
      ),
    )
    .leftJoin(
      artworkItems,
      and(
        eq(artworkItems.shopId, artworkVersions.shopId),
        eq(artworkItems.id, artworkVersions.artworkItemId),
      ),
    )
    .leftJoin(
      proofVersions,
      and(
        eq(proofVersions.shopId, storedObjects.shopId),
        eq(proofVersions.storedObjectId, storedObjects.id),
      ),
    )
    .leftJoin(
      jobs,
      and(
        eq(jobs.shopId, input.shopId),
        eq(jobs.orderId, input.orderId),
        eq(jobs.id, input.jobId),
        sql`${jobs.id} = coalesce(${artworkItems.jobId}, ${proofVersions.jobId})`,
      ),
    )
    .where(
      and(
        eq(storedObjects.shopId, input.shopId),
        eq(storedObjects.id, input.storedObjectId),
        eq(jobs.id, input.jobId),
      ),
    )
    .limit(1);

  if (
    !object ||
    object.validationState !== "accepted" ||
    object.scanState === "failed" ||
    object.scanState === "pending" ||
    object.bytesDeletedAt
  ) {
    throw new Error("not_found");
  }

  const url = await input.signDownload({
    objectKey: object.objectKey,
    filename: object.filename,
    expiresInSeconds: 300,
  });
  return { url, expiresAt: new Date(Date.now() + 5 * 60 * 1000) };
}
