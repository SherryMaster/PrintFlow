import { describe, expect, it } from "vitest";

import {
  type GuestAuthority,
  requireAdminAuthority,
  requireOrderAuthority,
} from "@/modules/orders/authorization";

const guest: GuestAuthority = {
  kind: "guest",
  shopId: "shop-a",
  orderId: "order-a",
  grantId: "grant-a",
  scopes: ["order:read", "artwork:upload"],
};

describe("order authorization boundaries", () => {
  it("accepts only the guest's exact shop, order, and scope", () => {
    expect(() =>
      requireOrderAuthority(guest, "shop-a", "order-a", "order:read"),
    ).not.toThrow();
    expect(() =>
      requireOrderAuthority(guest, "shop-b", "order-a", "order:read"),
    ).toThrow("not_found");
    expect(() =>
      requireOrderAuthority(guest, "shop-a", "order-b", "order:read"),
    ).toThrow("not_found");
    expect(() =>
      requireOrderAuthority(guest, "shop-a", "order-a", "proof:respond"),
    ).toThrow("not_found");
  });

  it("does not allow a guest through an admin boundary", () => {
    expect(() => requireAdminAuthority(guest, "shop-a")).toThrow("not_found");
  });

  it("keeps admin authority inside its shop", () => {
    const admin = {
      kind: "admin" as const,
      shopId: "shop-a",
      membershipId: "membership-a",
    };

    expect(() => requireAdminAuthority(admin, "shop-a")).not.toThrow();
    expect(() => requireAdminAuthority(admin, "shop-b")).toThrow("not_found");
    expect(() =>
      requireOrderAuthority(admin, "shop-a", "order-a", "proof:respond"),
    ).not.toThrow();
  });
});
