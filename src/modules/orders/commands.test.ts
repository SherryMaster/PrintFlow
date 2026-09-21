import { describe, expect, it } from "vitest";

import {
  addDraftJob,
  createDraft,
  submitOrder,
} from "@/modules/orders/commands";

const shopId = "37e69597-d813-4e6a-a8f4-c3edc8f41870";
const draftId = "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd";
const serviceVersionId = "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4";
const priceRuleVersionId = "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a";
const idempotencyKey = "draft-request-key-2026-09-21";

describe("order command input boundaries", () => {
  it("[AC-1] rejects an unknown draft source before database access", async () => {
    await expect(
      createDraft({
        shopId,
        source: "public" as never,
        idempotencyKey,
        capabilityEncryptionKey: "test-key",
        capabilityKeyVersion: "v1",
      }),
    ).rejects.toThrow();
  });

  it("[AC-2] rejects a draft job with a nonpositive quantity before database access", async () => {
    await expect(
      addDraftJob({
        shopId,
        draftId,
        capability: "a".repeat(43),
        lineNumber: 1,
        serviceVersionId,
        priceRuleVersionId,
        quantity: 0 as never,
        configuration: {},
        measurements: {},
        requirements: {},
        pricePreview: null,
      }),
    ).rejects.toThrow();
  });

  it("[AC-11] rejects a submit request with a short idempotency key before database access", async () => {
    await expect(
      submitOrder({
        shopId,
        draftId,
        capability: "a".repeat(43),
        idempotencyKey: "short",
        contact: { name: "Ayesha", phone: "03001234567" },
        capabilityEncryptionKey: "test-key",
        capabilityKeyVersion: "v1",
      }),
    ).rejects.toThrow();
  });
});
