import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import {
  createCapability,
  hashCapability,
} from "@/modules/orders/capabilities";
import { authorizeOrderGrant } from "@/modules/orders/grants";
import { updateShopSettings } from "@/modules/shop/commands";
import { authorizeAdminSession } from "@/modules/shop/authorization";
import { CustomerShell } from "@/ui/shells/customer-shell";
import { AdminShell } from "@/ui/shells/admin-shell";
import { pilotShopSettings } from "@/ui/theme/branding";
import { resolveApprovedPublicShop, resolveShopThemeForContext } from "./theme";

const activeDatabase = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/db/client", () => ({
  getDatabase: () => ({ db: activeDatabase.db }),
}));

loadEnvConfig(process.cwd());

const originalPilotSlug = process.env.PILOT_SHOP_SLUG;

afterEach(() => {
  activeDatabase.db = null;
  vi.restoreAllMocks();
  if (originalPilotSlug === undefined) delete process.env.PILOT_SHOP_SLUG;
  else process.env.PILOT_SHOP_SLUG = originalPilotSlug;
});

function mockShopSelect(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  activeDatabase.db = { select };
  return { select, from, where, limit };
}

describe("trusted shop theme resolution", () => {
  it("[V3] rejects a public slug outside the configured pilot", async () => {
    process.env.PILOT_SHOP_SLUG = "lahore-print-shop";

    await expect(resolveApprovedPublicShop("another-shop")).rejects.toThrow(
      "not_found",
    );
  });

  it("[V3] returns the database shop for the configured public slug", async () => {
    process.env.PILOT_SHOP_SLUG = "lahore-print-shop";
    mockShopSelect([{ id: "shop-1" }]);

    await expect(
      resolveApprovedPublicShop("lahore-print-shop"),
    ).resolves.toEqual({ kind: "public", shopId: "shop-1", approved: true });
  });

  it("[V3] resolves a theme from the supplied trusted shop context", async () => {
    mockShopSelect([
      { id: "shop-1", name: "OkPrints", settings: pilotShopSettings(7) },
    ]);

    const theme = await resolveShopThemeForContext({
      source: { kind: "public", shopId: "shop-1", approved: true },
    });

    expect(theme.identity.name).toBe("OkPrints");
    expect(theme.identity.logo?.src).toBe("/branding/okprints/ok-prints.png");
  });

  it("[V3] warns and uses the safe theme when stored branding is outdated", async () => {
    mockShopSelect([
      {
        id: "shop-old",
        name: "Older shop",
        settings: {
          schema_version: "shop_settings.v1",
          quote_validity_days: 7,
          rounding_rule: "nearest_rupee_half_up",
        },
      },
    ]);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    const theme = await resolveShopThemeForContext({
      source: { kind: "public", shopId: "shop-old", approved: true },
    });

    expect(theme.identity).toEqual({ name: "Older shop" });
    expect(warning).toHaveBeenCalledWith("shop_theme_fallback", {
      shopId: "shop-old",
      reason: "missing_or_invalid_branding",
      schemaVersion: "shop_settings.v1",
    });
  });
});

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "1")(
  "shop theme live contract",
  () => {
    it("resolves trusted contexts and rejects stale settings updates", async () => {
      const sql = postgres(process.env.DATABASE_URL!, {
        max: 1,
        prepare: false,
        ssl: {
          ca: process.env.DATABASE_CA_CERT,
          rejectUnauthorized: true,
        },
      });
      const rootDatabase = drizzle(sql, { schema });
      const previousSlug = process.env.PILOT_SHOP_SLUG;
      const suffix = randomUUID();
      const brandedShopId = randomUUID();
      const oldShopId = randomUUID();
      const brandedSlug = `verify-branded-${suffix}`;
      const oldSlug = `verify-old-${suffix}`;
      const rollback = new Error("verification rolled back");

      try {
        let transactionError: unknown;
        try {
          await rootDatabase.transaction(async (db) => {
            activeDatabase.db = db;

            await db.insert(schema.shops).values([
              {
                id: brandedShopId,
                slug: brandedSlug,
                name: "Verified OkPrints",
                timezone: "Asia/Karachi",
                currency: "PKR",
                referencePrefix: "PF",
                settings: pilotShopSettings(7),
                updatedAt: new Date("2020-01-01T00:00:00Z"),
              },
              {
                id: oldShopId,
                slug: oldSlug,
                name: "Older shop",
                timezone: "Asia/Karachi",
                currency: "PKR",
                referencePrefix: "PF",
                settings: {
                  schema_version: "shop_settings.v1",
                  quote_validity_days: 7,
                  rounding_rule: "nearest_rupee_half_up",
                },
              },
            ]);

            const membershipId = randomUUID();
            await db.insert(schema.shopMemberships).values({
              id: membershipId,
              shopId: brandedShopId,
              authUserId: randomUUID(),
              displayName: "Verification admin",
              role: "admin",
            });
            const sessionHash = randomUUID();
            const now = new Date();
            await db.insert(schema.adminSessions).values({
              shopId: brandedShopId,
              membershipId,
              sessionIdentifierHash: sessionHash,
              signedInAt: now,
              lastVerifiedAt: now,
              absoluteExpiresAt: new Date(now.getTime() + 60_000),
            });

            const orderId = randomUUID();
            await db.insert(schema.orders).values({
              id: orderId,
              shopId: brandedShopId,
              reference: "VERIFY-1",
              source: "walk_in",
              contactName: "Verification customer",
              contactPhoneDisplay: "+923001234567",
              contactPhoneSearch: "+923001234567",
              submittedAt: now,
            });
            const capability = createCapability();
            await db.insert(schema.orderAccessGrants).values({
              shopId: brandedShopId,
              orderId,
              tokenHash: hashCapability(capability),
              state: "active",
              scopes: ["order:read"],
              activationAt: now,
              terminalExpiresAt: new Date(now.getTime() + 60_000),
            });

            process.env.PILOT_SHOP_SLUG = brandedSlug;
            const publicContext = await resolveApprovedPublicShop(brandedSlug);
            const adminContext = await authorizeAdminSession({
              shopId: brandedShopId,
              sessionIdentifierHash: sessionHash,
            });
            const guestContext = await authorizeOrderGrant({
              token: capability,
              requiredScope: "order:read",
              correlationId: randomUUID(),
            });
            expect(guestContext.shopId).toBe(brandedShopId);
            await expect(resolveApprovedPublicShop(oldSlug)).rejects.toThrow(
              "not_found",
            );
            await expect(resolveApprovedPublicShop(oldShopId)).rejects.toThrow(
              "not_found",
            );
            await expect(
              authorizeAdminSession({
                shopId: oldShopId,
                sessionIdentifierHash: sessionHash,
              }),
            ).rejects.toThrow("forbidden");

            for (const source of [publicContext, adminContext, guestContext]) {
              const theme = await resolveShopThemeForContext({ source });
              expect(theme.identity.name).toBe("Verified OkPrints");
              expect(theme.identity.logo?.src).toBe(
                "/branding/okprints/ok-prints.png",
              );
              const markup = renderToStaticMarkup(
                <CustomerShell theme={theme}>
                  <p>Customer content</p>
                </CustomerShell>,
              );
              expect(markup).toContain("--background:");
              expect(markup).not.toContain(brandedShopId);
              expect(markup).not.toContain("shop_settings.v2");
              expect(markup).not.toContain(
                '"key":"branding/okprints/ok-prints.png"',
              );
            }

            const warning = vi
              .spyOn(console, "warn")
              .mockImplementation(() => {});
            const oldTheme = await resolveShopThemeForContext({
              source: { kind: "public", shopId: oldShopId, approved: true },
            });
            expect(oldTheme.identity).toEqual({ name: "Older shop" });
            const oldShop = await db.query.shops.findFirst({
              where: eq(schema.shops.id, oldShopId),
            });
            expect(oldShop?.settings).toEqual({
              schema_version: "shop_settings.v1",
              quote_validity_days: 7,
              rounding_rule: "nearest_rupee_half_up",
            });
            expect(warning).toHaveBeenCalledWith("shop_theme_fallback", {
              shopId: oldShopId,
              reason: "missing_or_invalid_branding",
              schemaVersion: "shop_settings.v1",
            });
            warning.mockRestore();

            const adminMarkup = renderToStaticMarkup(
              <AdminShell theme={oldTheme} heading="Orders" navigation={[]}>
                <p>Admin content</p>
              </AdminShell>,
            );
            expect(adminMarkup).toContain("--background:");
            expect(adminMarkup).not.toContain(oldShopId);

            const before = await db.query.shops.findFirst({
              where: eq(schema.shops.id, brandedShopId),
            });
            expect(before).toBeDefined();
            const updated = await updateShopSettings({
              authority: adminContext,
              expectedVersion: before!.version,
              settings: pilotShopSettings(8),
            });
            expect(updated.version).toBe(before!.version + 1);
            const after = await db.query.shops.findFirst({
              where: eq(schema.shops.id, brandedShopId),
            });
            expect(after?.settings).toEqual(pilotShopSettings(8));
            expect(after!.updatedAt.getTime()).toBeGreaterThan(
              before!.updatedAt.getTime(),
            );
            await expect(
              updateShopSettings({
                authority: adminContext,
                expectedVersion: before!.version,
                settings: pilotShopSettings(9),
              }),
            ).rejects.toThrow("conflict");
            const afterConflict = await db.query.shops.findFirst({
              where: eq(schema.shops.id, brandedShopId),
            });
            expect(afterConflict?.settings).toEqual(pilotShopSettings(8));

            throw rollback;
          });
        } catch (error) {
          transactionError = error;
        }
        if (transactionError !== rollback) throw transactionError;
        const remaining = await sql`
          select count(*)::int as count from app.shops
          where id in (${brandedShopId}, ${oldShopId})
        `;
        expect(remaining[0].count).toBe(0);
      } finally {
        activeDatabase.db = null;
        if (previousSlug === undefined) delete process.env.PILOT_SHOP_SLUG;
        else process.env.PILOT_SHOP_SLUG = previousSlug;
        await sql.end();
      }
    });
  },
);
