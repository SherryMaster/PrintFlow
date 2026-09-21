import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db/client";
import { requestFingerprint } from "@/db/contracts";
import {
  actorSnapshots,
  artworkItems,
  artworkVersions,
  capabilityDeliveries,
  draftJobObjects,
  draftJobs,
  idempotencyRecords,
  jobRevisions,
  jobs,
  orderAccessGrants,
  orderActivityEntries,
  orderDrafts,
  orderReferenceCounters,
  orders,
  outboxEvents,
  priceAcceptances,
  priceRuleVersions,
  serviceVersions,
  shops,
  storedObjects,
  uploadIntents,
  uploadSessions,
} from "@/db/schema";
import {
  createCapability,
  decryptCapability,
  encryptCapability,
  hashCapability,
} from "@/modules/orders/capabilities";
import {
  calculationSnapshotSchema,
  contactInputSchema,
  normalizeEmail,
  normalizePakistanPhone,
} from "@/modules/orders/validation";
import { deriveJobBlockers } from "@/modules/orders/model";

const createDraftInputSchema = z
  .object({
    shopId: z.uuid(),
    source: z.enum(["online", "walk_in", "phone"]),
    idempotencyKey: z.string().min(22),
    capabilityEncryptionKey: z.string().min(1),
    capabilityKeyVersion: z.string().min(1),
  })
  .strict();

const addDraftJobInputSchema = z
  .object({
    shopId: z.uuid(),
    draftId: z.uuid(),
    capability: z.string().min(32),
    lineNumber: z.int().positive(),
    serviceVersionId: z.uuid(),
    priceRuleVersionId: z.uuid(),
    quantity: z.int().positive(),
    configuration: z.record(z.string(), z.unknown()),
    measurements: z.record(z.string(), z.unknown()),
    requirements: z.record(z.string(), z.unknown()),
    pricePreview: calculationSnapshotSchema.nullable(),
  })
  .strict();

const submitOrderInputSchema = z
  .object({
    shopId: z.uuid(),
    draftId: z.uuid(),
    capability: z.string().min(32),
    idempotencyKey: z.string().min(22),
    contact: contactInputSchema,
    capabilityEncryptionKey: z.string().min(1),
    capabilityKeyVersion: z.string().min(1),
  })
  .strict();

export async function createDraft(
  rawInput: z.input<typeof createDraftInputSchema>,
) {
  const input = createDraftInputSchema.parse(rawInput);
  const { db } = getDatabase();
  const fingerprint = requestFingerprint({
    shopId: input.shopId,
    source: input.source,
  });

  return db.transaction(async (transaction) => {
    const replay = await transaction.query.idempotencyRecords.findFirst({
      where: and(
        eq(idempotencyRecords.shopId, input.shopId),
        eq(idempotencyRecords.operationType, "create_draft"),
        eq(idempotencyRecords.key, input.idempotencyKey),
      ),
    });

    if (replay) {
      if (replay.requestFingerprint !== fingerprint) {
        throw new Error("conflict");
      }
      const deliveryId = replay.responseSnapshot?.delivery_id;
      const delivery =
        typeof deliveryId === "string"
          ? await transaction.query.capabilityDeliveries.findFirst({
              where: eq(capabilityDeliveries.id, deliveryId),
            })
          : undefined;
      if (
        !delivery?.encryptedCapability ||
        delivery.erasedAt ||
        delivery.expiresAt <= new Date()
      ) {
        throw new Error("expired");
      }
      return {
        draftId: replay.resultId!,
        uploadSessionId: undefined,
        capability: decryptCapability(
          delivery.encryptedCapability,
          input.capabilityEncryptionKey,
        ),
        expiresAt: delivery.expiresAt,
      };
    }

    const capability = createCapability();
    const draftId = randomUUID();
    const uploadSessionId = randomUUID();
    const deliveryId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await transaction.insert(orderDrafts).values({
      id: draftId,
      shopId: input.shopId,
      capabilityHash: hashCapability(capability),
      source: input.source,
      expiresAt,
    });
    await transaction.insert(uploadSessions).values({
      id: uploadSessionId,
      shopId: input.shopId,
      ownerType: "draft",
      orderDraftId: draftId,
      capabilityHash: hashCapability(capability),
      byteQuota: 524_288_000n,
      expiresAt,
    });
    await transaction.insert(capabilityDeliveries).values({
      id: deliveryId,
      purpose: "draft_capability",
      ownerId: draftId,
      encryptedCapability: encryptCapability(
        capability,
        input.capabilityEncryptionKey,
      ),
      keyVersion: input.capabilityKeyVersion,
      expiresAt,
    });
    await transaction.insert(idempotencyRecords).values({
      shopId: input.shopId,
      operationType: "create_draft",
      key: input.idempotencyKey,
      requestFingerprint: fingerprint,
      state: "completed",
      resultType: "order_draft",
      resultId: draftId,
      responseSnapshot: {
        schema_version: "idempotency_response.v1",
        delivery_id: deliveryId,
      },
      retentionExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });

    return { draftId, uploadSessionId, capability, expiresAt };
  });
}

export async function addDraftJob(
  rawInput: z.input<typeof addDraftJobInputSchema>,
) {
  const input = addDraftJobInputSchema.parse(rawInput);
  const { db } = getDatabase();

  return db.transaction(async (transaction) => {
    const draft = await transaction.query.orderDrafts.findFirst({
      where: and(
        eq(orderDrafts.id, input.draftId),
        eq(orderDrafts.shopId, input.shopId),
        eq(orderDrafts.capabilityHash, hashCapability(input.capability)),
      ),
    });

    if (
      !draft ||
      draft.submittedAt ||
      draft.revokedAt ||
      draft.expiresAt <= new Date()
    ) {
      throw new Error("not_found");
    }

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

    const [job] = await transaction
      .insert(draftJobs)
      .values({
        shopId: input.shopId,
        orderDraftId: input.draftId,
        lineNumber: input.lineNumber,
        serviceVersionId: input.serviceVersionId,
        priceRuleVersionId: input.priceRuleVersionId,
        configuration: {
          schema_version: "customer_configuration.v1",
          ...input.configuration,
        },
        measurements: {
          schema_version: "measurements.v1",
          ...input.measurements,
        },
        requirements: {
          schema_version: "job_requirements.v1",
          ...input.requirements,
        },
        pricePreview: input.pricePreview ?? undefined,
        quantity: input.quantity,
      })
      .onConflictDoUpdate({
        target: [draftJobs.orderDraftId, draftJobs.lineNumber],
        set: {
          serviceVersionId: input.serviceVersionId,
          priceRuleVersionId: input.priceRuleVersionId,
          configuration: {
            schema_version: "customer_configuration.v1",
            ...input.configuration,
          },
          measurements: {
            schema_version: "measurements.v1",
            ...input.measurements,
          },
          requirements: {
            schema_version: "job_requirements.v1",
            ...input.requirements,
          },
          pricePreview: input.pricePreview ?? undefined,
          quantity: input.quantity,
          updatedAt: new Date(),
        },
      })
      .returning({ id: draftJobs.id });

    await transaction
      .update(orderDrafts)
      .set({ version: sql`${orderDrafts.version} + 1` })
      .where(eq(orderDrafts.id, input.draftId));

    return job;
  });
}

export async function submitOrder(
  rawInput: z.input<typeof submitOrderInputSchema>,
) {
  const input = submitOrderInputSchema.parse(rawInput);
  const { db } = getDatabase();
  const fingerprint = requestFingerprint({
    shopId: input.shopId,
    draftId: input.draftId,
    contact: input.contact,
  });

  return db.transaction(async (transaction) => {
    const replay = await transaction.query.idempotencyRecords.findFirst({
      where: and(
        eq(idempotencyRecords.shopId, input.shopId),
        eq(idempotencyRecords.operationType, "submit_order"),
        eq(idempotencyRecords.key, input.idempotencyKey),
      ),
    });

    if (replay) {
      if (replay.requestFingerprint !== fingerprint) {
        throw new Error("conflict");
      }
      return { orderId: replay.resultId, replayed: true } as const;
    }

    const draft = await transaction.query.orderDrafts.findFirst({
      where: and(
        eq(orderDrafts.id, input.draftId),
        eq(orderDrafts.shopId, input.shopId),
        eq(orderDrafts.capabilityHash, hashCapability(input.capability)),
      ),
    });
    const draftJobRows = await transaction.query.draftJobs.findMany({
      where: and(
        eq(draftJobs.shopId, input.shopId),
        eq(draftJobs.orderDraftId, input.draftId),
      ),
      orderBy: [asc(draftJobs.lineNumber)],
    });

    if (
      !draft ||
      draft.submittedAt ||
      draft.revokedAt ||
      draft.expiresAt <= new Date() ||
      draftJobRows.length === 0
    ) {
      throw new Error("invalid_transition");
    }
    if (draft.source === "online" && !input.contact.email) {
      throw new Error("validation_failed");
    }

    const shop = await transaction.query.shops.findFirst({
      where: and(eq(shops.id, input.shopId), eq(shops.id, draft.shopId)),
    });
    if (!shop) {
      throw new Error("not_found");
    }

    const [{ calendarYear }] = await transaction
      .select({
        calendarYear: sql<number>`extract(year from timezone(${shop.timezone}, now()))::integer`,
      })
      .from(shops)
      .where(eq(shops.id, input.shopId));
    const [counter] = await transaction
      .insert(orderReferenceCounters)
      .values({ shopId: input.shopId, calendarYear, nextValue: 2n })
      .onConflictDoUpdate({
        target: [
          orderReferenceCounters.shopId,
          orderReferenceCounters.calendarYear,
        ],
        set: {
          nextValue: sql`${orderReferenceCounters.nextValue} + 1`,
        },
      })
      .returning({
        allocated: sql<bigint>`${orderReferenceCounters.nextValue} - 1`,
      });

    const orderId = randomUUID();
    const customerActorSnapshotId = randomUUID();
    const submittedAt = new Date();
    const reference = `${shop.referencePrefix}-${calendarYear}-${counter.allocated.toString().padStart(6, "0")}`;
    const phoneSearch = normalizePakistanPhone(input.contact.phone);
    const emailSearch = input.contact.email
      ? normalizeEmail(input.contact.email)
      : undefined;

    await transaction.insert(actorSnapshots).values({
      id: customerActorSnapshotId,
      shopId: input.shopId,
      type: draft.source === "online" ? "guest" : "assisted_customer",
      displayLabel: input.contact.name,
      assistedChannel: draft.source === "online" ? undefined : draft.source,
    });
    await transaction.insert(orders).values({
      id: orderId,
      shopId: input.shopId,
      reference,
      source: draft.source,
      contactName: input.contact.name,
      contactPhoneDisplay: input.contact.phone,
      contactPhoneSearch: phoneSearch,
      contactEmailDisplay: input.contact.email,
      contactEmailSearch: emailSearch,
      submittedAt,
    });

    for (const draftJob of draftJobRows) {
      const jobId = randomUUID();
      const revisionId = randomUUID();
      const preview = draftJob.pricePreview
        ? calculationSnapshotSchema.parse(draftJob.pricePreview)
        : undefined;
      const quoteRequired = preview === undefined;
      const pricingMode = quoteRequired ? "quote_required" : "standard";
      const blockers = deriveJobBlockers(draftJob.requirements, pricingMode, {
        standardPriceAccepted: preview !== undefined,
      });

      await transaction.insert(jobs).values({
        id: jobId,
        shopId: input.shopId,
        orderId,
        lineNumber: draftJob.lineNumber,
        blockerProjection: {
          schema_version: "blocker_projection.v1",
          blockers,
        },
        currentRevisionId: revisionId,
      });
      await transaction.insert(jobRevisions).values({
        id: revisionId,
        shopId: input.shopId,
        jobId,
        revisionNumber: 1,
        serviceVersionId: draftJob.serviceVersionId,
        priceRuleVersionId: draftJob.priceRuleVersionId,
        configuration: draftJob.configuration,
        measurements: draftJob.measurements,
        requirements: draftJob.requirements,
        pricingMode,
        calculationSnapshot: preview,
        subtotal: preview ? BigInt(preview.subtotal_paisa) : undefined,
        adjustment: preview ? BigInt(preview.adjustment_paisa) : undefined,
        tax: preview ? BigInt(preview.tax_paisa) : undefined,
        roundedTotal: preview ? BigInt(preview.rounded_total_paisa) : undefined,
        actorSnapshotId: customerActorSnapshotId,
      });
      if (preview) {
        await transaction.insert(priceAcceptances).values({
          shopId: input.shopId,
          jobRevisionId: revisionId,
          sequenceNumber: 1,
          customerActorSnapshotId,
          channel: draft.source,
          acceptedAt: submittedAt,
        });
      }

      const draftObjects = await transaction
        .select({
          storedObjectId: draftJobObjects.storedObjectId,
          purpose: draftJobObjects.purpose,
          createdAt: storedObjects.createdAt,
        })
        .from(draftJobObjects)
        .innerJoin(
          storedObjects,
          and(
            eq(storedObjects.shopId, draftJobObjects.shopId),
            eq(storedObjects.id, draftJobObjects.storedObjectId),
            eq(storedObjects.validationState, "accepted"),
          ),
        )
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
            eq(uploadSessions.orderDraftId, input.draftId),
          ),
        )
        .where(
          and(
            eq(draftJobObjects.shopId, input.shopId),
            eq(draftJobObjects.draftJobId, draftJob.id),
          ),
        )
        .orderBy(asc(storedObjects.createdAt));

      const byPurpose = new Map<string, typeof draftObjects>();
      for (const object of draftObjects) {
        const versions = byPurpose.get(object.purpose) ?? [];
        versions.push(object);
        byPurpose.set(object.purpose, versions);
      }
      const requiredChecks = Array.isArray(
        draftJob.requirements.required_file_checks,
      )
        ? draftJob.requirements.required_file_checks.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      for (const [purpose, versions] of byPurpose) {
        const artworkItemId = randomUUID();
        const versionIds = versions.map(() => randomUUID());
        await transaction.insert(artworkItems).values({
          id: artworkItemId,
          shopId: input.shopId,
          jobId,
          purpose,
          requiredChecks: {
            schema_version: "artwork_checks.v1",
            checks: requiredChecks,
          },
          currentVersionId: versionIds.at(-1),
        });
        await transaction.insert(artworkVersions).values(
          versions.map((object, index) => ({
            id: versionIds[index],
            shopId: input.shopId,
            artworkItemId,
            storedObjectId: object.storedObjectId,
            versionNumber: index + 1,
            uploaderSnapshotId: customerActorSnapshotId,
          })),
        );
      }
    }

    let grantId: string | undefined;
    if (draft.source === "online") {
      grantId = randomUUID();
      const guestCapability = createCapability();
      const deliveryId = randomUUID();
      const outboxId = randomUUID();

      await transaction.insert(capabilityDeliveries).values({
        id: deliveryId,
        purpose: "guest_order_link",
        ownerId: orderId,
        encryptedCapability: encryptCapability(
          guestCapability,
          input.capabilityEncryptionKey,
        ),
        keyVersion: input.capabilityKeyVersion,
        expiresAt: new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000),
      });
      await transaction.insert(orderAccessGrants).values({
        id: grantId,
        shopId: input.shopId,
        orderId,
        tokenHash: hashCapability(guestCapability),
        state: "pending",
        scopes: [
          "order:read",
          "artwork:upload",
          "quote:respond",
          "proof:respond",
          "link:rotate",
        ],
        deliveryOutboxEventId: outboxId,
      });
      await transaction.insert(outboxEvents).values({
        id: outboxId,
        shopId: input.shopId,
        aggregateType: "order",
        aggregateId: orderId,
        eventType: "order.confirmation_requested.v1",
        payload: {
          schema_version: "1",
          order_id: orderId,
          pending_grant_id: grantId,
          template_version: "order_confirmation.v1",
          capability_delivery_id: deliveryId,
        },
      });
    }

    await transaction.insert(orderActivityEntries).values({
      shopId: input.shopId,
      orderId,
      actionType: "order.submitted",
      actorSnapshotId: customerActorSnapshotId,
      details: { schema_version: "order_activity.v1", reference },
      correlationId: randomUUID(),
      idempotencyKey: input.idempotencyKey,
    });
    await transaction
      .update(orderDrafts)
      .set({ submittedAt })
      .where(eq(orderDrafts.id, input.draftId));
    await transaction.insert(idempotencyRecords).values({
      shopId: input.shopId,
      operationType: "submit_order",
      key: input.idempotencyKey,
      requestFingerprint: fingerprint,
      state: "completed",
      resultType: "order",
      resultId: orderId,
      responseSnapshot: {
        schema_version: "idempotency_response.v1",
        order_id: orderId,
        reference,
        grant_id: grantId,
      },
      retentionExpiresAt: new Date(
        submittedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
      ),
    });

    return { orderId, reference, grantId, replayed: false } as const;
  });
}
