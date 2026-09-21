import { describe, expect, it } from "vitest";

import { revokeOrderGrant, rotateOrderGrant } from "@/modules/orders/grants";

const shopId = "37e69597-d813-4e6a-a8f4-c3edc8f41870";
const orderId = "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd";
const guest = {
  kind: "guest" as const,
  shopId,
  orderId,
  grantId: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
  scopes: ["link:rotate"] as const,
};

describe("guest grant boundaries", () => {
  it("[AC-10] cannot revoke a different guest grant", async () => {
    await expect(
      revokeOrderGrant({
        shopId,
        orderId,
        grantId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
        authority: guest,
      }),
    ).rejects.toThrow("not_found");
  });

  it("[AC-10] cannot rotate a link without the rotate scope", async () => {
    await expect(
      rotateOrderGrant({
        shopId,
        orderId,
        authority: { ...guest, scopes: ["order:read"] },
        capabilityEncryptionKey: "test-key",
        capabilityKeyVersion: "v1",
      }),
    ).rejects.toThrow("not_found");
  });
});
