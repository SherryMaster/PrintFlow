import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { shops } from "@/db/schema";
import type { GuestAuthority } from "@/modules/orders/authorization";
import type { AdminAuthority } from "@/modules/shop/authorization";
import { resolveShopTheme } from "@/ui/theme/theme";

export type TrustedShopContext =
  | AdminAuthority
  | GuestAuthority
  | { kind: "public"; shopId: string; approved: true };

export async function resolveApprovedPublicShop(
  slug: string,
): Promise<TrustedShopContext> {
  const approvedSlug = process.env.PILOT_SHOP_SLUG;
  if (!approvedSlug || slug !== approvedSlug) throw new Error("not_found");
  const { db } = getDatabase();
  const [shop] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.slug, approvedSlug))
    .limit(1);
  if (!shop) throw new Error("not_found");
  return { kind: "public", shopId: shop.id, approved: true };
}

export async function resolveShopThemeForContext({
  source,
}: {
  source: TrustedShopContext;
}) {
  const { db } = getDatabase();
  const [shop] = await db
    .select({ id: shops.id, name: shops.name, settings: shops.settings })
    .from(shops)
    .where(eq(shops.id, source.shopId))
    .limit(1);
  if (!shop) throw new Error("not_found");
  const result = resolveShopTheme({ name: shop.name, settings: shop.settings });
  if (result.warning)
    console.warn("shop_theme_fallback", {
      shopId: shop.id,
      reason: result.warning,
      schemaVersion: shop.settings?.schema_version,
    });
  return result.theme;
}
