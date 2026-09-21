import { describe, expect, it } from "vitest";

import { bootstrapShop } from "@/modules/shop/commands";

const validBootstrap = {
  idempotencyKey: "bootstrap-shop-key-2026-09-21",
  slug: "lahore-print-shop",
  name: "Lahore Print Shop",
  timezone: "Asia/Karachi" as const,
  currency: "PKR" as const,
  referencePrefix: "PF" as const,
  settings: {
    schema_version: "shop_settings.v1" as const,
    quote_validity_days: 7,
    rounding_rule: "nearest_rupee_half_up" as const,
  },
  firstAdminUserId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
  firstAdminDisplayName: "First Admin",
};

describe("shop bootstrap input boundary", () => {
  it("[AC-15] rejects a non pilot timezone before database access", async () => {
    await expect(
      bootstrapShop({ ...validBootstrap, timezone: "UTC" as never }),
    ).rejects.toThrow();
  });

  it("[AC-15] rejects an unknown bootstrap field before database access", async () => {
    await expect(
      bootstrapShop({ ...validBootstrap, unexpected: true } as never),
    ).rejects.toThrow();
  });
});
