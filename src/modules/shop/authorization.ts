import { and, eq, gt, isNull } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { adminSessions, shopMemberships } from "@/db/schema";

export type AdminAuthority = {
  kind: "admin";
  shopId: string;
  membershipId: string;
};

export async function authorizeAdminSession(input: {
  shopId: string;
  sessionIdentifierHash: string;
}): Promise<AdminAuthority> {
  const { db } = getDatabase();
  const [match] = await db
    .select({
      shopId: adminSessions.shopId,
      membershipId: adminSessions.membershipId,
    })
    .from(adminSessions)
    .innerJoin(
      shopMemberships,
      and(
        eq(shopMemberships.shopId, adminSessions.shopId),
        eq(shopMemberships.id, adminSessions.membershipId),
      ),
    )
    .where(
      and(
        eq(adminSessions.shopId, input.shopId),
        eq(adminSessions.sessionIdentifierHash, input.sessionIdentifierHash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.absoluteExpiresAt, new Date()),
        eq(shopMemberships.active, true),
      ),
    )
    .limit(1);

  if (!match) throw new Error("forbidden");
  return { kind: "admin", ...match };
}
