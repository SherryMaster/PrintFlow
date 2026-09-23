import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrapShop, updateShopSettings } from "@/modules/shop/commands";
import { okPrintsBranding, pilotShopSettings } from "@/ui/theme/branding";

const databaseState = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/db/client", () => ({
  getDatabase: () => ({ db: databaseState.db }),
}));

const validBootstrap = {
  idempotencyKey: "bootstrap-shop-key-2026-09-21",
  slug: "lahore-print-shop",
  name: "Lahore Print Shop",
  timezone: "Asia/Karachi" as const,
  currency: "PKR" as const,
  referencePrefix: "PF" as const,
  settings: {
    schema_version: "shop_settings.v2" as const,
    quote_validity_days: 7,
    rounding_rule: "nearest_rupee_half_up" as const,
    branding: okPrintsBranding,
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

describe("shop settings updates", () => {
  afterEach(() => {
    databaseState.db = null;
  });

  function mockUpdate(returned: { id: string; version: number }[]) {
    const returning = vi.fn().mockResolvedValue(returned);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    databaseState.db = { update };
    return { set, where, returning };
  }

  const authority = { shopId: "shop-1" } as never;

  it("[V2] writes validated settings with the next shop version", async () => {
    const query = mockUpdate([{ id: "shop-1", version: 4 }]);
    const settings = pilotShopSettings(8);

    await expect(
      updateShopSettings({ authority, expectedVersion: 3, settings }),
    ).resolves.toEqual({ id: "shop-1", version: 4 });
    expect(query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        settings,
        version: 4,
        updatedAt: expect.any(Date),
      }),
    );
  });

  it("[V2] reports a conflict when the expected version is stale", async () => {
    mockUpdate([]);

    await expect(
      updateShopSettings({
        authority,
        expectedVersion: 3,
        settings: pilotShopSettings(8),
      }),
    ).rejects.toThrow("conflict");
  });

  it("[V2] rejects invalid settings before accessing the database", async () => {
    await expect(
      updateShopSettings({
        authority,
        expectedVersion: 3,
        settings: { schema_version: "shop_settings.v2" } as never,
      }),
    ).rejects.toThrow();
  });
});
