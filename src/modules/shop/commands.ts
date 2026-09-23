import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requestFingerprint } from "@/db/contracts";
import { getDatabase } from "@/db/client";
import {
  actorSnapshots,
  idempotencyRecords,
  orderReferenceCounters,
  shopActivityEntries,
  shopMemberships,
  shops,
} from "@/db/schema";
import { shopSettingsSchema } from "@/modules/orders/validation";
import type { AdminAuthority } from "@/modules/shop/authorization";
import { resolveShopTheme } from "@/ui/theme/theme";
import { pilotShopSettings } from "@/ui/theme/branding";

const bootstrapInputSchema = z
  .object({
    idempotencyKey: z.string().min(22),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(200),
    timezone: z.literal("Asia/Karachi"),
    currency: z.literal("PKR"),
    referencePrefix: z.literal("PF"),
    settings: shopSettingsSchema,
    firstAdminUserId: z.uuid(),
    firstAdminDisplayName: z.string().trim().min(1).max(200),
  })
  .strict();

export type BootstrapShopInput = z.input<typeof bootstrapInputSchema>;

export function bootstrapPilotShop(
  input: Omit<BootstrapShopInput, "settings"> & { quoteValidityDays: number },
) {
  const { quoteValidityDays, ...profile } = input;
  return bootstrapShop({
    ...profile,
    settings: pilotShopSettings(quoteValidityDays),
  });
}

export async function updateShopSettings(input: {
  authority: AdminAuthority;
  expectedVersion: number;
  settings: z.input<typeof shopSettingsSchema>;
}) {
  z.int().positive().parse(input.expectedVersion);
  const settings = shopSettingsSchema.parse(input.settings);
  if (resolveShopTheme({ name: "Shop", settings }).warning)
    throw new Error("invalid_branding");
  const { db } = getDatabase();
  const [updated] = await db
    .update(shops)
    .set({
      settings,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(shops.id, input.authority.shopId),
        eq(shops.version, input.expectedVersion),
      ),
    )
    .returning({ id: shops.id, version: shops.version });
  if (!updated) throw new Error("conflict");
  return updated;
}

export async function bootstrapShop(rawInput: BootstrapShopInput) {
  const input = bootstrapInputSchema.parse(rawInput);
  if (resolveShopTheme({ name: input.name, settings: input.settings }).warning)
    throw new Error("invalid_branding");
  const fingerprint = requestFingerprint(input);
  const { db } = getDatabase();

  return db.transaction(async (transaction) => {
    const existing = await transaction.query.shops.findFirst({
      where: eq(shops.slug, input.slug),
    });

    if (existing) {
      const replay = await transaction.query.idempotencyRecords.findFirst({
        where: and(
          eq(idempotencyRecords.shopId, existing.id),
          eq(idempotencyRecords.operationType, "bootstrap_shop"),
          eq(idempotencyRecords.key, input.idempotencyKey),
        ),
      });

      if (!replay || replay.requestFingerprint !== fingerprint) {
        throw new Error("conflict");
      }

      return { shopId: existing.id, replayed: true } as const;
    }

    const shopId = randomUUID();
    const membershipId = randomUUID();
    const actorSnapshotId = randomUUID();
    const now = new Date();

    await transaction.insert(shops).values({
      id: shopId,
      slug: input.slug,
      name: input.name,
      timezone: input.timezone,
      currency: input.currency,
      referencePrefix: input.referencePrefix,
      settings: input.settings,
    });
    await transaction.insert(shopMemberships).values({
      id: membershipId,
      shopId,
      authUserId: input.firstAdminUserId,
      displayName: input.firstAdminDisplayName,
    });
    await transaction.insert(actorSnapshots).values({
      id: actorSnapshotId,
      shopId,
      type: "admin",
      stableIdentity: input.firstAdminUserId,
      displayLabel: input.firstAdminDisplayName,
    });
    await transaction.insert(orderReferenceCounters).values({
      shopId,
      calendarYear: Number(
        new Intl.DateTimeFormat("en", {
          timeZone: input.timezone,
          year: "numeric",
        }).format(now),
      ),
      nextValue: 1n,
    });
    await transaction.insert(shopActivityEntries).values({
      shopId,
      actionType: "shop.bootstrapped",
      actorSnapshotId,
      details: { schema_version: "shop_activity.v1", slug: input.slug },
      correlationId: randomUUID(),
      idempotencyKey: input.idempotencyKey,
    });
    await transaction.insert(idempotencyRecords).values({
      shopId,
      operationType: "bootstrap_shop",
      key: input.idempotencyKey,
      requestFingerprint: fingerprint,
      state: "completed",
      resultType: "shop",
      resultId: shopId,
      responseSnapshot: {
        schema_version: "idempotency_response.v1",
        shop_id: shopId,
      },
      retentionExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });

    return { shopId, membershipId, replayed: false } as const;
  });
}
