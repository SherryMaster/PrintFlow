import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getDatabase } from "@/db/client";
import {
  capabilityDeliveries,
  idempotencyRecords,
  orders,
  outboxEvents,
  rateLimitCounters,
  securityEvents,
  shops,
} from "@/db/schema";
import {
  beginExternalEffectAttempt,
  claimOutboxBatch,
  completeOutboxEvent,
  reconcileUncertainEffect,
} from "@/jobs/outbox";
import {
  eraseEligiblePrivateDetails,
  purgeExpiredOperationalData,
} from "@/jobs/retention";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "1";

describe.skipIf(!runDatabaseTests)("operational database contracts", () => {
  afterAll(async () => {
    await getDatabase().sql.end();
  });

  it("fences outbox workers and reconciles an uncertain provider result", async () => {
    const { db } = getDatabase();
    const [shop] = await db
      .insert(shops)
      .values({
        slug: `operations-${randomUUID()}`,
        name: "Operations Test",
        timezone: "Asia/Karachi",
        currency: "PKR",
        referencePrefix: "PF",
        settings: {
          schema_version: "shop_settings.v1",
          quote_validity_days: 7,
          rounding_rule: "nearest_rupee_half_up",
        },
      })
      .returning();
    const eventId = randomUUID();
    await db.insert(outboxEvents).values({
      id: eventId,
      shopId: shop.id,
      aggregateType: "upload_session",
      aggregateId: randomUUID(),
      eventType: "file.rejected.v1",
      payload: {
        schema_version: "1",
        upload_session_id: randomUUID(),
        upload_intent_id: randomUUID(),
        rejection_category: "signature_mismatch",
      },
      nextAttemptAt: new Date("2000-01-01T00:00:00.000Z"),
    });

    const claimed = (await claimOutboxBatch({ workerId: "worker-one" })).find(
      (event) => event.id === eventId,
    );
    expect(claimed).toBeDefined();
    if (!claimed) {
      throw new Error("Expected the inserted event to be claimed");
    }
    const attempt = await beginExternalEffectAttempt({
      eventId,
      workerId: "worker-one",
      leaseFence: claimed.leaseFence,
      provider: "deterministic-fake",
      effectType: "file_rejection",
      requestFingerprint: "fingerprint-one",
    });
    expect(attempt.effectId).toBe(eventId);

    await completeOutboxEvent({
      eventId,
      attemptId: attempt.attemptId,
      workerId: "worker-one",
      leaseFence: claimed.leaseFence,
      result: { state: "uncertain", error: "response_lost" },
    });
    expect(
      (await claimOutboxBatch({ workerId: "worker-two" })).find(
        (event) => event.id === eventId,
      ),
    ).toBeUndefined();

    const reconciled = await reconcileUncertainEffect({
      eventId,
      attemptId: attempt.attemptId,
      accepted: false,
      reconciliationResult: "provider_has_no_effect",
    });
    expect(reconciled.state).toBe("retryable");

    await db
      .update(outboxEvents)
      .set({ nextAttemptAt: sql`now() - interval '1 minute'` })
      .where(eq(outboxEvents.id, eventId));
    const reclaimed = (await claimOutboxBatch({ workerId: "worker-two" })).find(
      (event) => event.id === eventId,
    );
    expect(reclaimed).toBeDefined();
    expect(reclaimed!.leaseFence).toBeGreaterThan(claimed.leaseFence);
    await expect(
      completeOutboxEvent({
        eventId,
        workerId: "worker-one",
        leaseFence: claimed.leaseFence,
      }),
    ).rejects.toThrow("stale_lease");
  });

  it("erases terminal private details and purges expired operational data", async () => {
    const { db } = getDatabase();
    const [shop] = await db
      .insert(shops)
      .values({
        slug: `retention-${randomUUID()}`,
        name: "Retention Test",
        timezone: "Asia/Karachi",
        currency: "PKR",
        referencePrefix: "PF",
        settings: {
          schema_version: "shop_settings.v1",
          quote_validity_days: 7,
          rounding_rule: "nearest_rupee_half_up",
        },
      })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        shopId: shop.id,
        reference: `PF-2024-${Math.floor(Math.random() * 900_000 + 100_000)}`,
        source: "walk_in",
        contactName: "Private Customer",
        contactPhoneDisplay: "03001234567",
        contactPhoneSearch: "+923001234567",
        submittedAt: new Date("2024-01-01T00:00:00.000Z"),
        terminalState: "collected",
        collectedAt: new Date("2024-01-02T00:00:00.000Z"),
      })
      .returning();
    const expired = new Date("2025-01-01T00:00:00.000Z");
    await db.insert(capabilityDeliveries).values({
      purpose: "retention_test",
      ownerId: order.id,
      encryptedCapability: "ciphertext",
      keyVersion: "test.v1",
      expiresAt: expired,
    });
    await db.insert(idempotencyRecords).values({
      shopId: shop.id,
      operationType: "retention_test",
      key: randomUUID(),
      requestFingerprint: "fingerprint",
      state: "completed",
      retentionExpiresAt: expired,
    });
    await db.insert(securityEvents).values({
      eventType: "retention.test",
      correlationId: randomUUID(),
      contextHash: "hash",
      retentionExpiresAt: expired,
      shopId: shop.id,
      orderId: order.id,
    });
    await db.insert(rateLimitCounters).values({
      shopId: shop.id,
      scope: "retention_test",
      identityHash: randomUUID(),
      windowStartedAt: expired,
      expiresAt: expired,
    });

    expect(
      await purgeExpiredOperationalData(new Date("2026-09-19T00:00:00.000Z")),
    ).toMatchObject({
      capabilityDeliveriesErased: 1,
      idempotencyRecordsDeleted: 1,
      securityEventsDeleted: 1,
      rateLimitCountersDeleted: 1,
    });
    expect(
      await eraseEligiblePrivateDetails(new Date("2026-09-19T00:00:00.000Z")),
    ).toMatchObject({ ordersErased: 1 });
    const erased = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
    });
    expect(erased?.contactName).toBeNull();
    expect(erased?.contactErasedAt).toEqual(
      new Date("2026-09-19T00:00:00.000Z"),
    );
  });
});
