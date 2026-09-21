import { describe, expect, it } from "vitest";

import { getOrderAggregate } from "@/modules/orders/queries";

const shopId = "37e69597-d813-4e6a-a8f4-c3edc8f41870";
const orderId = "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd";

describe("order projection boundaries", () => {
  it("[AC-10] does not let a guest choose a different order or reference", async () => {
    const authority = {
      kind: "guest" as const,
      shopId,
      orderId,
      grantId: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
      scopes: ["order:read"] as const,
    };

    await expect(
      getOrderAggregate({ authority, reference: "PF-2026-000001" }),
    ).rejects.toThrow("not_found");
    await expect(
      getOrderAggregate({
        authority: {
          ...authority,
          orderId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
        },
        orderId,
      }),
    ).rejects.toThrow("not_found");
  });

  it("[AC-1] requires an administrator to identify exactly one order", async () => {
    const authority = {
      kind: "admin" as const,
      shopId,
      membershipId: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
    };

    await expect(getOrderAggregate({ authority })).rejects.toThrow(
      "exactly one order identifier",
    );
    await expect(
      getOrderAggregate({ authority, orderId, reference: "PF-2026-000001" }),
    ).rejects.toThrow("exactly one order identifier");
  });
});
