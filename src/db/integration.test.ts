import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { publishCatalogVersion } from "@/modules/catalog/commands";
import {
  attachArtworkVersion,
  clearProductionHold,
  createProof,
  recordArtworkReview,
  recordProofDecision,
} from "@/modules/orders/artwork";
import { decryptCapability } from "@/modules/orders/capabilities";
import {
  addDraftJob,
  createDraft,
  submitOrder,
} from "@/modules/orders/commands";
import {
  addInternalNote,
  collectOrder,
  recordProductionException,
  reviseJob,
  transitionJob,
} from "@/modules/orders/lifecycle";
import { getOrderAggregate } from "@/modules/orders/queries";
import {
  correctQuoteResponse,
  issueQuote,
  recordQuoteResponse,
} from "@/modules/orders/quotes";
import {
  activateDeliveredGrant,
  authorizeOrderGrant,
} from "@/modules/orders/grants";
import { bootstrapShop } from "@/modules/shop/commands";
import {
  acceptStoredObject,
  createOrderUploadSession,
  createUploadIntent,
} from "@/storage/commands";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "1";

describe.skipIf(!runDatabaseTests)("real PostgreSQL order thread", () => {
  afterAll(async () => {
    const { getDatabase } = await import("@/db/client");
    await getDatabase().sql.end();
  });

  it("enforces contact snapshots while allowing retention erasure", async () => {
    const { getDatabase } = await import("@/db/client");
    const { orders, shops } = await import("@/db/schema");
    const { db } = getDatabase();
    const shopId = randomUUID();

    await db.insert(shops).values({
      id: shopId,
      slug: `contact-contract-${shopId}`,
      name: "Contact Contract Shop",
      timezone: "Asia/Karachi",
      currency: "PKR",
      referencePrefix: "PF",
      settings: {
        schema_version: "shop_settings.v1",
        quote_validity_days: 7,
        rounding_rule: "nearest_rupee_half_up",
      },
    });

    await expect(
      db.insert(orders).values({
        shopId,
        reference: "PF-2026-000001",
        source: "walk_in",
        submittedAt: new Date(),
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(orders).values({
        shopId,
        reference: "PF-2026-000002",
        source: "online",
        contactName: "Guest Customer",
        contactPhoneDisplay: "03001234567",
        contactPhoneSearch: "+923001234567",
        contactEmailDisplay: "guest@example.com",
        submittedAt: new Date(),
      }),
    ).rejects.toThrow();

    const [order] = await db
      .insert(orders)
      .values({
        shopId,
        reference: "PF-2026-000003",
        source: "online",
        contactName: "Guest Customer",
        contactPhoneDisplay: "03001234567",
        contactPhoneSearch: "+923001234567",
        contactEmailDisplay: "guest@example.com",
        contactEmailSearch: "guest@example.com",
        submittedAt: new Date(),
      })
      .returning({ id: orders.id });

    await expect(
      db
        .update(orders)
        .set({
          contactName: null,
          contactPhoneDisplay: null,
          contactPhoneSearch: null,
          contactEmailDisplay: null,
          contactEmailSearch: null,
          contactErasedAt: new Date(),
        })
        .where(eq(orders.id, order.id)),
    ).resolves.toBeDefined();
  });

  it("bootstraps, publishes, submits, and reads one standard order", async () => {
    const { getDatabase } = await import("@/db/client");
    const {
      actorSnapshots,
      capabilityDeliveries,
      jobRevisions,
      jobs,
      orderAccessGrants,
      orders,
      outboxEvents,
      priceRuleVersions,
      quoteResponses,
      quoteRevisions,
      securityEvents,
      serviceVersions,
      services,
      uploadIntents,
    } = await import("@/db/schema");
    const { db } = getDatabase();
    const testRunId = randomUUID();
    const adminUserId = randomUUID();
    const bootstrapInput = {
      idempotencyKey: `bootstrap-${testRunId}`,
      slug: `lahore-pilot-${testRunId}`,
      name: "Lahore Pilot",
      timezone: "Asia/Karachi",
      currency: "PKR",
      referencePrefix: "PF",
      settings: {
        schema_version: "shop_settings.v2",
        quote_validity_days: 7,
        rounding_rule: "nearest_rupee_half_up",
        branding: {
          schema_version: "shop_branding.v1",
          logo: {
            key: "branding/okprints/ok-prints.png",
            alt: "OkPrints logo",
          },
          palette: {
            primary: "#ED3237",
            supporting_red: "#C52F33",
            ink: "#0A0500",
            paper: "#FDFDFD",
          },
        },
      },
      firstAdminUserId: adminUserId,
      firstAdminDisplayName: "Pilot Admin",
    } as const;
    const bootstrap = await bootstrapShop(bootstrapInput);
    await expect(bootstrapShop(bootstrapInput)).resolves.toMatchObject({
      shopId: bootstrap.shopId,
      replayed: true,
    });
    await expect(
      bootstrapShop({ ...bootstrapInput, name: "Changed Pilot" }),
    ).rejects.toThrow("conflict");
    const adminActor = await db.query.actorSnapshots.findFirst({
      where: eq(actorSnapshots.shopId, bootstrap.shopId),
    });
    expect(adminActor).toBeDefined();
    const adminAuthority = {
      kind: "admin" as const,
      shopId: bootstrap.shopId,
      membershipId: bootstrap.membershipId!,
    };

    const [service] = await db
      .insert(services)
      .values({ shopId: bootstrap.shopId, code: "test", name: "Test Print" })
      .returning();
    const [serviceVersion] = await db
      .insert(serviceVersions)
      .values({
        shopId: bootstrap.shopId,
        serviceId: service.id,
        versionNumber: 1,
        definition: {
          schema_version: "service_definition.v1",
          configuration_schema: {},
          required_artwork_purposes: [],
          required_file_checks: [],
          proof_approval_required: false,
          quote_required: false,
        },
      })
      .returning();
    const [priceRuleVersion] = await db
      .insert(priceRuleVersions)
      .values({
        shopId: bootstrap.shopId,
        serviceId: service.id,
        versionNumber: 1,
        rules: {
          schema_version: "price_rule.v1",
          calculator: "test_standard_v1",
          parameters: { unit_price_paisa: "155" },
        },
      })
      .returning();
    await publishCatalogVersion({
      shopId: bootstrap.shopId,
      serviceId: service.id,
      serviceVersionId: serviceVersion.id,
      priceRuleVersionId: priceRuleVersion.id,
      actorSnapshotId: adminActor!.id,
      serviceDefinition: serviceVersion.definition,
      priceRules: priceRuleVersion.rules,
    });

    const key = Buffer.alloc(32, 4).toString("base64");
    const draft = await createDraft({
      shopId: bootstrap.shopId,
      source: "online",
      idempotencyKey: `draft-${testRunId}`,
      capabilityEncryptionKey: key,
      capabilityKeyVersion: "test.v1",
    });
    const recoveredDraft = await createDraft({
      shopId: bootstrap.shopId,
      source: "online",
      idempotencyKey: `draft-${testRunId}`,
      capabilityEncryptionKey: key,
      capabilityKeyVersion: "test.v1",
    });
    expect(recoveredDraft.draftId).toBe(draft.draftId);
    expect(recoveredDraft.capability).toBe(draft.capability);
    await addDraftJob({
      shopId: bootstrap.shopId,
      draftId: draft.draftId,
      capability: draft.capability,
      lineNumber: 1,
      serviceVersionId: serviceVersion.id,
      priceRuleVersionId: priceRuleVersion.id,
      quantity: 3,
      configuration: { size: "A4" },
      measurements: {},
      requirements: { quote_required: false },
      pricePreview: {
        schema_version: "calculation_snapshot.v1",
        components: [
          {
            rule: "test_standard_v1",
            inputs: { quantity: "3" },
            amount_paisa: "465",
          },
        ],
        subtotal_paisa: "465",
        adjustment_paisa: "0",
        tax_label: "No tax",
        tax_paisa: "0",
        rounded_total_paisa: "500",
      },
    });
    for (const lineNumber of [2, 3]) {
      await addDraftJob({
        shopId: bootstrap.shopId,
        draftId: draft.draftId,
        capability: draft.capability,
        lineNumber,
        serviceVersionId: serviceVersion.id,
        priceRuleVersionId: priceRuleVersion.id,
        quantity: 1,
        configuration: { size: `custom-${lineNumber}` },
        measurements: {},
        requirements: { quote_required: true },
        pricePreview: null,
      });
    }
    const submitted = await submitOrder({
      shopId: bootstrap.shopId,
      draftId: draft.draftId,
      capability: draft.capability,
      idempotencyKey: `submit-${testRunId}`,
      contact: {
        name: "Guest Customer",
        phone: "03001234567",
        email: "Guest@Example.com",
      },
      capabilityEncryptionKey: key,
      capabilityKeyVersion: "test.v1",
    });
    const pendingAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });

    expect(submitted.reference).toMatch(/^PF-\d{4}-000001$/);
    expect(submitted.grantId).toBeDefined();
    expect(pendingAggregate.knownTotalPaisa).toBe("500");
    expect(pendingAggregate.unknownPriceJobIds).toHaveLength(2);
    expect(pendingAggregate.jobs).toHaveLength(3);
    if (!("version" in pendingAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }

    const pendingGrant = await db.query.orderAccessGrants.findFirst({
      where: eq(orderAccessGrants.id, submitted.grantId!),
    });
    const deliveryEvent = await db.query.outboxEvents.findFirst({
      where: eq(outboxEvents.id, pendingGrant!.deliveryOutboxEventId!),
    });
    const deliveryId = deliveryEvent!.payload.capability_delivery_id;
    if (typeof deliveryId !== "string") {
      throw new Error("Expected a capability delivery identifier");
    }
    const delivery = await db.query.capabilityDeliveries.findFirst({
      where: eq(capabilityDeliveries.id, deliveryId),
    });
    const guestToken = decryptCapability(delivery!.encryptedCapability!, key);
    await activateDeliveredGrant({
      shopId: bootstrap.shopId,
      grantId: submitted.grantId!,
      deliveryOutboxEventId: pendingGrant!.deliveryOutboxEventId!,
    });
    const guestAuthority = await authorizeOrderGrant({
      token: guestToken,
      requiredScope: "artwork:upload",
      correlationId: randomUUID(),
    });
    await expect(
      authorizeOrderGrant({
        token: "invalid-capability-with-no-order-match",
        requiredScope: "order:read",
        correlationId: randomUUID(),
      }),
    ).rejects.toThrow("not_found");
    expect(
      await db.query.securityEvents.findFirst({
        where: eq(securityEvents.eventType, "guest_grant.denied"),
      }),
    ).toBeDefined();
    const uploadJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.shopId, bootstrap.shopId),
        eq(jobs.orderId, submitted.orderId!),
        eq(jobs.lineNumber, 1),
      ),
    });
    const uploadSession = await createOrderUploadSession({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: uploadJob!.id,
      purpose: "artwork",
      authority: guestAuthority,
    });
    const rejectedIntent = await createUploadIntent({
      shopId: bootstrap.shopId,
      uploadSessionId: uploadSession.id,
      authority: guestAuthority,
      filename: "rejected.pdf",
      mediaType: "application/pdf",
      requestedBytes: 100n,
    });
    await expect(
      acceptStoredObject({
        shopId: bootstrap.shopId,
        uploadIntentId: rejectedIntent.id,
        metadata: {
          objectKey: `accepted/${rejectedIntent.id}`,
          etag: "etag-rejected",
          measuredMediaType: "application/pdf",
          measuredSize: 100n,
          checksum: "checksum-rejected",
          signatureValid: false,
          scanState: "not_required",
        },
      }),
    ).rejects.toThrow("quarantined");
    const persistedRejection = await db.query.uploadIntents.findFirst({
      where: eq(uploadIntents.id, rejectedIntent.id),
    });
    expect(persistedRejection?.state).toBe("rejected");
    expect(
      await db.query.outboxEvents.findFirst({
        where: and(
          eq(outboxEvents.aggregateId, uploadSession.id),
          eq(outboxEvents.eventType, "file.rejected.v1"),
        ),
      }),
    ).toBeDefined();

    const acceptedIntent = await createUploadIntent({
      shopId: bootstrap.shopId,
      uploadSessionId: uploadSession.id,
      authority: guestAuthority,
      filename: "artwork.pdf",
      mediaType: "application/pdf",
      requestedBytes: 200n,
    });
    const storedObject = await acceptStoredObject({
      shopId: bootstrap.shopId,
      uploadIntentId: acceptedIntent.id,
      metadata: {
        objectKey: `accepted/${acceptedIntent.id}`,
        etag: "etag-accepted",
        measuredMediaType: "application/pdf",
        measuredSize: 200n,
        checksum: "checksum-accepted",
        signatureValid: true,
        scanState: "passed",
      },
    });

    const submittedJobs = await db
      .select({
        jobId: jobs.id,
        revisionId: jobRevisions.id,
        lineNumber: jobs.lineNumber,
      })
      .from(jobs)
      .innerJoin(
        jobRevisions,
        and(
          eq(jobRevisions.shopId, jobs.shopId),
          eq(jobRevisions.id, jobs.currentRevisionId),
        ),
      )
      .where(eq(jobs.orderId, submitted.orderId!))
      .orderBy(asc(jobs.lineNumber));
    const quotedJobs = submittedJobs.slice(1);
    const guestActor = await db.query.actorSnapshots.findFirst({
      where: and(
        eq(actorSnapshots.shopId, bootstrap.shopId),
        eq(actorSnapshots.type, "guest"),
      ),
    });
    expect(guestActor).toBeDefined();
    const [orderBeforeArtwork, jobBeforeArtwork] = await Promise.all([
      db.query.orders.findFirst({
        where: eq(orders.id, submitted.orderId!),
      }),
      db.query.jobs.findFirst({
        where: eq(jobs.id, submittedJobs[0].jobId),
      }),
    ]);
    const artwork = await attachArtworkVersion({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      purpose: "print_source",
      storedObjectId: storedObject.id,
      uploaderSnapshotId: guestActor!.id,
      requiredChecks: ["signature", "scan"],
      authority: guestAuthority,
      expectedOrderVersion: orderBeforeArtwork!.version,
      expectedJobVersion: jobBeforeArtwork!.version,
    });
    const [orderBeforeArtworkReview, jobBeforeArtworkReview] =
      await Promise.all([
        db.query.orders.findFirst({
          where: eq(orders.id, submitted.orderId!),
        }),
        db.query.jobs.findFirst({
          where: eq(jobs.id, submittedJobs[0].jobId),
        }),
      ]);
    await recordArtworkReview({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      artworkVersionId: artwork.artworkVersionId,
      decision: "accepted",
      reason: "Artwork is safe for production",
      actorSnapshotId: adminActor!.id,
      authority: adminAuthority,
      expectedOrderVersion: orderBeforeArtworkReview!.version,
      expectedJobVersion: jobBeforeArtworkReview!.version,
    });

    const proofUploadSession = await createOrderUploadSession({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      purpose: "proof",
      authority: adminAuthority,
    });
    const firstProofIntent = await createUploadIntent({
      shopId: bootstrap.shopId,
      uploadSessionId: proofUploadSession.id,
      authority: adminAuthority,
      filename: "proof-1.pdf",
      mediaType: "application/pdf",
      requestedBytes: 180n,
    });
    const firstProofObject = await acceptStoredObject({
      shopId: bootstrap.shopId,
      uploadIntentId: firstProofIntent.id,
      metadata: {
        objectKey: `accepted/${firstProofIntent.id}`,
        etag: "etag-proof-1",
        measuredMediaType: "application/pdf",
        measuredSize: 180n,
        checksum: "checksum-proof-1",
        signatureValid: true,
        scanState: "passed",
      },
    });
    const [orderBeforeProof, jobBeforeProof] = await Promise.all([
      db.query.orders.findFirst({ where: eq(orders.id, submitted.orderId!) }),
      db.query.jobs.findFirst({ where: eq(jobs.id, submittedJobs[0].jobId) }),
    ]);
    const firstProof = await createProof({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      jobRevisionId: submittedJobs[0].revisionId,
      storedObjectId: firstProofObject.id,
      artworkVersionIds: [artwork.artworkVersionId],
      creatorSnapshotId: adminActor!.id,
      activeGrantId: submitted.grantId!,
      authority: adminAuthority,
      expectedOrderVersion: orderBeforeProof!.version,
      expectedJobVersion: jobBeforeProof!.version,
    });
    const [orderBeforeProofDecision, jobBeforeProofDecision] =
      await Promise.all([
        db.query.orders.findFirst({ where: eq(orders.id, submitted.orderId!) }),
        db.query.jobs.findFirst({
          where: eq(jobs.id, submittedJobs[0].jobId),
        }),
      ]);
    await recordProofDecision({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      proofVersionId: firstProof.proofVersionId,
      decision: "accepted",
      customerActorSnapshotId: guestActor!.id,
      channel: "guest_link",
      authority: guestAuthority,
      expectedOrderVersion: orderBeforeProofDecision!.version,
      expectedJobVersion: jobBeforeProofDecision!.version,
    });

    const replacementIntent = await createUploadIntent({
      shopId: bootstrap.shopId,
      uploadSessionId: uploadSession.id,
      authority: guestAuthority,
      filename: "artwork-replacement.pdf",
      mediaType: "application/pdf",
      requestedBytes: 210n,
    });
    const replacementObject = await acceptStoredObject({
      shopId: bootstrap.shopId,
      uploadIntentId: replacementIntent.id,
      metadata: {
        objectKey: `accepted/${replacementIntent.id}`,
        etag: "etag-replacement",
        measuredMediaType: "application/pdf",
        measuredSize: 210n,
        checksum: "checksum-replacement",
        signatureValid: true,
        scanState: "passed",
      },
    });
    const [orderBeforeReplacement, jobBeforeReplacement] = await Promise.all([
      db.query.orders.findFirst({ where: eq(orders.id, submitted.orderId!) }),
      db.query.jobs.findFirst({ where: eq(jobs.id, submittedJobs[0].jobId) }),
    ]);
    const replacementArtwork = await attachArtworkVersion({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      purpose: "print_source",
      storedObjectId: replacementObject.id,
      uploaderSnapshotId: guestActor!.id,
      requiredChecks: ["signature", "scan"],
      authority: guestAuthority,
      expectedOrderVersion: orderBeforeReplacement!.version,
      expectedJobVersion: jobBeforeReplacement!.version,
    });
    const heldJob = await db.query.jobs.findFirst({
      where: eq(jobs.id, submittedJobs[0].jobId),
    });
    expect(heldJob?.productionHold).toBe(true);
    expect(heldJob?.currentProofVersionId).toBeNull();

    const orderBeforeReplacementReview = await db.query.orders.findFirst({
      where: eq(orders.id, submitted.orderId!),
    });
    await recordArtworkReview({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      artworkVersionId: replacementArtwork.artworkVersionId,
      decision: "accepted",
      reason: "Replacement is safe for production",
      actorSnapshotId: adminActor!.id,
      authority: adminAuthority,
      expectedOrderVersion: orderBeforeReplacementReview!.version,
      expectedJobVersion: heldJob!.version,
    });

    const secondProofIntent = await createUploadIntent({
      shopId: bootstrap.shopId,
      uploadSessionId: proofUploadSession.id,
      authority: adminAuthority,
      filename: "proof-2.pdf",
      mediaType: "application/pdf",
      requestedBytes: 190n,
    });
    const secondProofObject = await acceptStoredObject({
      shopId: bootstrap.shopId,
      uploadIntentId: secondProofIntent.id,
      metadata: {
        objectKey: `accepted/${secondProofIntent.id}`,
        etag: "etag-proof-2",
        measuredMediaType: "application/pdf",
        measuredSize: 190n,
        checksum: "checksum-proof-2",
        signatureValid: true,
        scanState: "passed",
      },
    });
    const [orderBeforeSecondProof, jobBeforeSecondProof] = await Promise.all([
      db.query.orders.findFirst({ where: eq(orders.id, submitted.orderId!) }),
      db.query.jobs.findFirst({ where: eq(jobs.id, submittedJobs[0].jobId) }),
    ]);
    const secondProof = await createProof({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      jobRevisionId: submittedJobs[0].revisionId,
      storedObjectId: secondProofObject.id,
      artworkVersionIds: [replacementArtwork.artworkVersionId],
      creatorSnapshotId: adminActor!.id,
      activeGrantId: submitted.grantId!,
      authority: adminAuthority,
      expectedOrderVersion: orderBeforeSecondProof!.version,
      expectedJobVersion: jobBeforeSecondProof!.version,
    });
    const [orderBeforeSecondDecision, jobBeforeSecondDecision] =
      await Promise.all([
        db.query.orders.findFirst({ where: eq(orders.id, submitted.orderId!) }),
        db.query.jobs.findFirst({
          where: eq(jobs.id, submittedJobs[0].jobId),
        }),
      ]);
    await recordProofDecision({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      proofVersionId: secondProof.proofVersionId,
      decision: "accepted",
      customerActorSnapshotId: guestActor!.id,
      channel: "guest_link",
      authority: guestAuthority,
      expectedOrderVersion: orderBeforeSecondDecision!.version,
      expectedJobVersion: jobBeforeSecondDecision!.version,
    });
    const [orderBeforeHoldClear, jobBeforeHoldClear] = await Promise.all([
      db.query.orders.findFirst({ where: eq(orders.id, submitted.orderId!) }),
      db.query.jobs.findFirst({ where: eq(jobs.id, submittedJobs[0].jobId) }),
    ]);
    await clearProductionHold({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      expectedOrderVersion: orderBeforeHoldClear!.version,
      expectedJobVersion: jobBeforeHoldClear!.version,
      actorSnapshotId: adminActor!.id,
      reason: "Replacement artwork and proof are current",
      authority: adminAuthority,
    });
    expect(
      await db.query.jobs.findFirst({
        where: eq(jobs.id, submittedJobs[0].jobId),
      }),
    ).toMatchObject({ productionHold: false });

    const orderBeforeQuote = await db.query.orders.findFirst({
      where: eq(orders.id, submitted.orderId!),
    });

    const quoteInput = {
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: orderBeforeQuote!.version,
      actorSnapshotId: adminActor!.id,
      activeGrantId: submitted.grantId!,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      adjustmentPaisa: 1n,
      customerMessage: "Complete replacement quote",
      terms: { validity: "one_day" },
      jobs: quotedJobs.map((job, index) => ({
        jobId: job.jobId,
        jobRevisionId: job.revisionId,
        lineNumber: job.lineNumber,
        description: `Quoted job ${index + 1}`,
        subtotalPaisa: index === 0 ? 125n : 275n,
        taxPaisa: 0n,
      })),
    };

    await expect(
      issueQuote({ ...quoteInput, jobs: quoteInput.jobs.slice(0, 1) }),
    ).rejects.toThrow("validation_failed");
    const quote = await issueQuote(quoteInput);
    expect(quote.total).toBe(400n);
    const orderAfterQuote = await db.query.orders.findFirst({
      where: eq(orders.id, submitted.orderId!),
    });
    const firstResponse = await recordQuoteResponse({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: orderAfterQuote!.version,
      quoteRevisionId: quote.quoteRevisionId,
      decision: "accepted",
      customerActorSnapshotId: guestActor!.id,
      channel: "guest_link",
    });

    const acceptedAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });
    expect(acceptedAggregate.knownTotalPaisa).toBe("900");
    expect(acceptedAggregate.unknownPriceJobIds).toEqual([]);
    expect(acceptedAggregate.jobs.map((job) => job.roundedTotalPaisa)).toEqual([
      "500",
      "100",
      "300",
    ]);

    if (!("version" in acceptedAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }
    const declinedCorrection = await correctQuoteResponse({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: acceptedAggregate.version,
      quoteRevisionId: quote.quoteRevisionId,
      correctsResponseId: firstResponse.responseId,
      decision: "declined",
      reason: "Admin corrected the recorded customer response",
      adminActorSnapshotId: adminActor!.id,
      recordedByMembershipId: bootstrap.membershipId!,
    });
    const declinedAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });
    expect(declinedAggregate.unknownPriceJobIds).toHaveLength(2);
    if (!("version" in declinedAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }
    await correctQuoteResponse({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: declinedAggregate.version,
      quoteRevisionId: quote.quoteRevisionId,
      correctsResponseId: declinedCorrection.responseId,
      decision: "accepted",
      reason: "Customer acceptance was confirmed",
      adminActorSnapshotId: adminActor!.id,
      recordedByMembershipId: bootstrap.membershipId!,
    });

    const [orderBeforeRevision, jobBeforeRevision] = await Promise.all([
      db.query.orders.findFirst({
        where: eq(orders.id, submitted.orderId!),
      }),
      db.query.jobs.findFirst({
        where: eq(jobs.id, quotedJobs[0].jobId),
      }),
    ]);
    const revised = await reviseJob({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: quotedJobs[0].jobId,
      expectedOrderVersion: orderBeforeRevision!.version,
      expectedJobVersion: jobBeforeRevision!.version,
      serviceVersionId: serviceVersion.id,
      priceRuleVersionId: priceRuleVersion.id,
      configuration: {
        schema_version: "customer_configuration.v1",
        size: "custom-revised",
      },
      measurements: { schema_version: "measurements.v1" },
      requirements: {
        schema_version: "job_requirements.v1",
        quote_required: true,
      },
      pricingMode: "quote_required",
      actorSnapshotId: adminActor!.id,
      reason: "Customer changed the requested size",
    });
    const quoteInvalidatedByRevision = await db.query.quoteRevisions.findFirst({
      where: eq(quoteRevisions.id, quote.quoteRevisionId),
    });
    expect(quoteInvalidatedByRevision?.lifecycle).toBe("superseded");
    const revisionInvalidatedAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });
    expect(revisionInvalidatedAggregate.unknownPriceJobIds).toHaveLength(2);
    if (!("version" in revisionInvalidatedAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }

    const quoteAfterRevision = await issueQuote({
      ...quoteInput,
      expectedOrderVersion: revisionInvalidatedAggregate.version,
      adjustmentPaisa: 0n,
      customerMessage: "Quote after job revision",
      jobs: [
        {
          ...quoteInput.jobs[0],
          jobRevisionId: revised.jobRevisionId,
          subtotalPaisa: 150n,
        },
        { ...quoteInput.jobs[1], subtotalPaisa: 250n },
      ],
    });
    const orderBeforeRevisedQuoteResponse = await db.query.orders.findFirst({
      where: eq(orders.id, submitted.orderId!),
    });
    await recordQuoteResponse({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: orderBeforeRevisedQuoteResponse!.version,
      quoteRevisionId: quoteAfterRevision.quoteRevisionId,
      decision: "accepted",
      customerActorSnapshotId: guestActor!.id,
      channel: "guest_link",
    });

    const [orderBeforeCancellation, jobBeforeCancellation] = await Promise.all([
      db.query.orders.findFirst({
        where: eq(orders.id, submitted.orderId!),
      }),
      db.query.jobs.findFirst({
        where: eq(jobs.id, quotedJobs[0].jobId),
      }),
    ]);
    await transitionJob({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: quotedJobs[0].jobId,
      expectedOrderVersion: orderBeforeCancellation!.version,
      expectedJobVersion: jobBeforeCancellation!.version,
      targetState: "canceled",
      reason: "Customer removed this job",
      actorSnapshotId: adminActor!.id,
    });
    const supersededQuote = await db.query.quoteRevisions.findFirst({
      where: eq(quoteRevisions.id, quoteAfterRevision.quoteRevisionId),
    });
    expect(supersededQuote?.lifecycle).toBe("superseded");
    const invalidatedAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });
    expect(invalidatedAggregate.unknownPriceJobIds).toEqual([
      quotedJobs[1].jobId,
    ]);
    if (!("version" in invalidatedAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }

    const replacementQuote = await issueQuote({
      ...quoteInput,
      expectedOrderVersion: invalidatedAggregate.version,
      adjustmentPaisa: 0n,
      customerMessage: "Replacement quote for active work",
      jobs: [quoteInput.jobs[1]],
    });
    const orderBeforeRace = await db.query.orders.findFirst({
      where: eq(orders.id, submitted.orderId!),
    });
    const responseBase = {
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: orderBeforeRace!.version,
      quoteRevisionId: replacementQuote.quoteRevisionId,
      customerActorSnapshotId: guestActor!.id,
      channel: "guest_link",
    } as const;
    const racedResponses = await Promise.allSettled([
      recordQuoteResponse({ ...responseBase, decision: "accepted" }),
      recordQuoteResponse({ ...responseBase, decision: "declined" }),
    ]);
    expect(
      racedResponses.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      racedResponses.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const savedResponses = await db.query.quoteResponses.findMany({
      where: eq(
        quoteResponses.quoteRevisionId,
        replacementQuote.quoteRevisionId,
      ),
    });
    expect(savedResponses).toHaveLength(1);
    if (savedResponses[0].decision === "declined") {
      const currentOrder = await db.query.orders.findFirst({
        where: eq(orders.id, submitted.orderId!),
      });
      await correctQuoteResponse({
        shopId: bootstrap.shopId,
        orderId: submitted.orderId!,
        expectedOrderVersion: currentOrder!.version,
        quoteRevisionId: replacementQuote.quoteRevisionId,
        correctsResponseId: savedResponses[0].id,
        decision: "accepted",
        reason: "Confirmed the intended concurrent response",
        adminActorSnapshotId: adminActor!.id,
        recordedByMembershipId: bootstrap.membershipId!,
      });
    }

    const currentAcceptedAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });
    expect(currentAcceptedAggregate.knownTotalPaisa).toBe("800");
    expect(currentAcceptedAggregate.unknownPriceJobIds).toEqual([]);
    if (!("version" in currentAcceptedAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }

    const firstJobBeforeTransition = await db.query.jobs.findFirst({
      where: eq(jobs.id, submittedJobs[0].jobId),
    });
    await expect(
      transitionJob({
        shopId: bootstrap.shopId,
        orderId: submitted.orderId!,
        jobId: submittedJobs[0].jobId,
        expectedOrderVersion: currentAcceptedAggregate.version,
        expectedJobVersion: firstJobBeforeTransition!.version,
        targetState: "ready",
        actorSnapshotId: adminActor!.id,
      }),
    ).rejects.toThrow("invalid_transition");

    const transitionBase = {
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      jobId: submittedJobs[0].jobId,
      expectedOrderVersion: currentAcceptedAggregate.version,
      expectedJobVersion: firstJobBeforeTransition!.version,
      targetState: "under_review" as const,
      actorSnapshotId: adminActor!.id,
    };
    const racedTransitions = await Promise.allSettled([
      transitionJob(transitionBase),
      transitionJob(transitionBase),
    ]);
    expect(
      racedTransitions.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      racedTransitions.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    for (const [submittedJob, targetStates] of [
      [
        submittedJobs[0],
        ["ready_for_production", "in_production", "ready"] as const,
      ],
      [
        quotedJobs[1],
        [
          "under_review",
          "ready_for_production",
          "in_production",
          "ready",
        ] as const,
      ],
    ] as const) {
      for (const targetState of targetStates) {
        const [currentOrder, currentJob] = await Promise.all([
          db.query.orders.findFirst({
            where: eq(orders.id, submitted.orderId!),
          }),
          db.query.jobs.findFirst({
            where: eq(jobs.id, submittedJob.jobId),
          }),
        ]);
        await transitionJob({
          shopId: bootstrap.shopId,
          orderId: submitted.orderId!,
          jobId: submittedJob.jobId,
          expectedOrderVersion: currentOrder!.version,
          expectedJobVersion: currentJob!.version,
          targetState,
          actorSnapshotId: adminActor!.id,
        });
      }
    }

    const readyAggregate = await getOrderAggregate({
      authority: adminAuthority,
      orderId: submitted.orderId!,
    });
    expect(readyAggregate.progress).toBe("ready");
    expect(readyAggregate.readyForCollection).toBe(true);
    if (!("version" in readyAggregate)) {
      throw new Error("Expected the admin aggregate projection");
    }
    await collectOrder({
      shopId: bootstrap.shopId,
      orderId: submitted.orderId!,
      expectedOrderVersion: readyAggregate.version,
      actorSnapshotId: adminActor!.id,
    });
    const collected = await db.query.orders.findFirst({
      where: eq(orders.id, submitted.orderId!),
    });
    expect(collected?.terminalState).toBe("collected");
  }, 120_000);

  it("records terminal facts when the final job is canceled", async () => {
    const { getDatabase } = await import("@/db/client");
    const {
      actorSnapshots,
      jobs,
      orderActivityEntries,
      orders,
      outboxEvents,
      shops,
    } = await import("@/db/schema");
    const { db } = getDatabase();
    const testRunId = randomUUID();
    const shopId = randomUUID();
    const orderId = randomUUID();
    const jobId = randomUUID();
    const actorId = randomUUID();

    await db.insert(shops).values({
      id: shopId,
      slug: `final-cancel-${testRunId}`,
      name: "Final Cancel Shop",
      timezone: "Asia/Karachi",
      currency: "PKR",
      referencePrefix: "PF",
      settings: {
        schema_version: "shop_settings.v1",
        quote_validity_days: 7,
        rounding_rule: "nearest_rupee_half_up",
      },
    });
    await db.insert(actorSnapshots).values({
      id: actorId,
      shopId,
      type: "admin",
      stableIdentity: testRunId,
      displayLabel: "Final Cancel Admin",
    });
    await db.insert(orders).values({
      id: orderId,
      shopId,
      reference: `PF-${testRunId}`,
      source: "walk_in",
      contactName: "Walk In Customer",
      contactPhoneDisplay: "03001234567",
      contactPhoneSearch: "+923001234567",
      submittedAt: new Date(),
    });
    await db.insert(jobs).values({
      id: jobId,
      shopId,
      orderId,
      lineNumber: 1,
      blockerProjection: {
        schema_version: "blocker_projection.v1",
        blockers: [],
      },
    });

    await transitionJob({
      shopId,
      orderId,
      jobId,
      expectedOrderVersion: 1,
      expectedJobVersion: 1,
      targetState: "canceled",
      reason: "Customer canceled the only job",
      actorSnapshotId: actorId,
    });

    const canceledOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    const cancellationActivity = await db.query.orderActivityEntries.findFirst({
      where: and(
        eq(orderActivityEntries.shopId, shopId),
        eq(orderActivityEntries.orderId, orderId),
        eq(orderActivityEntries.actionType, "order.canceled"),
      ),
    });
    const terminalEvent = await db.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.shopId, shopId),
        eq(outboxEvents.aggregateId, orderId),
        eq(outboxEvents.eventType, "order.terminal.v1"),
      ),
    });

    expect(canceledOrder?.terminalState).toBe("canceled");
    expect(canceledOrder?.canceledAt).toBeInstanceOf(Date);
    expect(cancellationActivity).toBeDefined();
    expect(terminalEvent?.payload).toMatchObject({
      order_id: orderId,
      activity_entry_id: cancellationActivity?.id,
      template_version: "order_canceled.v1",
    });
  }, 30_000);

  it("does not advance a held job into production", async () => {
    const { getDatabase } = await import("@/db/client");
    const { actorSnapshots, jobs, orders, shops } = await import("@/db/schema");
    const { db } = getDatabase();
    const testRunId = randomUUID();
    const shopId = randomUUID();
    const orderId = randomUUID();
    const jobId = randomUUID();
    const actorId = randomUUID();

    await db.insert(shops).values({
      id: shopId,
      slug: `held-job-${testRunId}`,
      name: "Held Job Shop",
      timezone: "Asia/Karachi",
      currency: "PKR",
      referencePrefix: "PF",
      settings: {
        schema_version: "shop_settings.v1",
        quote_validity_days: 7,
        rounding_rule: "nearest_rupee_half_up",
      },
    });
    await db.insert(actorSnapshots).values({
      id: actorId,
      shopId,
      type: "admin",
      stableIdentity: testRunId,
      displayLabel: "Held Job Admin",
    });
    await db.insert(orders).values({
      id: orderId,
      shopId,
      reference: `PF-${testRunId}`,
      source: "walk_in",
      contactName: "Walk In Customer",
      contactPhoneDisplay: "03001234567",
      contactPhoneSearch: "+923001234567",
      submittedAt: new Date(),
    });
    await db.insert(jobs).values({
      id: jobId,
      shopId,
      orderId,
      lineNumber: 1,
      workflowState: "ready_for_production",
      productionHold: true,
      blockerProjection: {
        schema_version: "blocker_projection.v1",
        blockers: [],
      },
    });

    await expect(
      transitionJob({
        shopId,
        orderId,
        jobId,
        expectedOrderVersion: 1,
        expectedJobVersion: 1,
        targetState: "in_production",
        actorSnapshotId: actorId,
      }),
    ).rejects.toThrow("invalid_transition");
  }, 30_000);

  it("keeps operator facts inside the order aggregate", async () => {
    const { getDatabase } = await import("@/db/client");
    const { actorSnapshots, jobs, internalNotes, orders, shops } =
      await import("@/db/schema");
    const { db } = getDatabase();
    const testRunId = randomUUID();
    const shopId = randomUUID();
    const orderId = randomUUID();
    const otherOrderId = randomUUID();
    const jobId = randomUUID();
    const actorId = randomUUID();
    const authority = {
      kind: "admin" as const,
      shopId,
      membershipId: testRunId,
    };

    await db.insert(shops).values({
      id: shopId,
      slug: `aggregate-facts-${testRunId}`,
      name: "Aggregate Facts Shop",
      timezone: "Asia/Karachi",
      currency: "PKR",
      referencePrefix: "PF",
      settings: {
        schema_version: "shop_settings.v1",
        quote_validity_days: 7,
        rounding_rule: "nearest_rupee_half_up",
      },
    });
    await db.insert(actorSnapshots).values({
      id: actorId,
      shopId,
      type: "admin",
      stableIdentity: testRunId,
      displayLabel: "Aggregate Facts Admin",
    });
    await db.insert(orders).values([
      {
        id: orderId,
        shopId,
        reference: `PF-${testRunId}-1`,
        source: "walk_in",
        contactName: "Walk In Customer",
        contactPhoneDisplay: "03001234567",
        contactPhoneSearch: "+923001234567",
        submittedAt: new Date(),
      },
      {
        id: otherOrderId,
        shopId,
        reference: `PF-${testRunId}-2`,
        source: "walk_in",
        contactName: "Other Customer",
        contactPhoneDisplay: "03001234568",
        contactPhoneSearch: "+923001234568",
        submittedAt: new Date(),
      },
    ]);
    await db.insert(jobs).values({
      id: jobId,
      shopId,
      orderId: otherOrderId,
      lineNumber: 1,
      blockerProjection: {
        schema_version: "blocker_projection.v1",
        blockers: [],
      },
    });

    await expect(
      addInternalNote({
        shopId,
        orderId,
        jobId,
        body: "Should not cross order boundaries",
        authorSnapshotId: actorId,
        authority,
        expectedOrderVersion: 1,
      }),
    ).rejects.toThrow("not_found");
    await expect(
      recordProductionException({
        shopId,
        orderId,
        jobId,
        blockerType: "proof_approval",
        blockedTargetType: "proof_version",
        blockedTargetId: randomUUID(),
        reason: "Should not cross order boundaries",
        actorSnapshotId: actorId,
        authority,
        expectedOrderVersion: 1,
        expectedJobVersion: 1,
      }),
    ).rejects.toThrow("not_found");

    const notes = await db.query.internalNotes.findMany({
      where: eq(internalNotes.orderId, orderId),
    });
    expect(notes).toHaveLength(0);
  }, 30_000);
});
