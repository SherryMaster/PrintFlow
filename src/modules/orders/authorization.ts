import type { AdminAuthority } from "@/modules/shop/authorization";

import type { GuestScope } from "@/modules/orders/grants";

export type GuestAuthority = {
  kind: "guest";
  shopId: string;
  orderId: string;
  grantId: string;
  scopes: readonly GuestScope[];
};

export type OrderAuthority = AdminAuthority | GuestAuthority;

export function requireAdminAuthority(
  authority: OrderAuthority,
  shopId: string,
): asserts authority is AdminAuthority {
  if (authority.kind !== "admin" || authority.shopId !== shopId) {
    throw new Error("not_found");
  }
}

export function requireOrderAuthority(
  authority: OrderAuthority,
  shopId: string,
  orderId: string,
  requiredScope: GuestScope,
): void {
  if (authority.shopId !== shopId) {
    throw new Error("not_found");
  }

  if (
    authority.kind === "guest" &&
    (authority.orderId !== orderId || !authority.scopes.includes(requiredScope))
  ) {
    throw new Error("not_found");
  }
}
