import { createHash, randomUUID } from "node:crypto";

import { and, eq, or, sql } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  capabilityDeliveries,
  orderAccessGrants,
  orders,
  outboxEvents,
  securityEvents,
} from "@/db/schema";
import {
  createCapability,
  encryptCapability,
  hashCapability,
} from "@/modules/orders/capabilities";
import {
  type OrderAuthority,
  requireOrderAuthority,
} from "@/modules/orders/authorization";

export const guestScopes = [
  "order:read",
  "artwork:upload",
  "quote:respond",
  "proof:respond",
  "link:rotate",
] as const;

export type GuestScope = (typeof guestScopes)[number];

function denialContextHash(tokenHash: string): string {
  return createHash("sha256")
    .update(`guest-grant-denial:${tokenHash}`)
    .digest("hex");
}

export async function authorizeOrderGrant(input: {
  token: string;
  requiredScope: GuestScope;
  correlationId: string;
}) {
  const { db } = getDatabase();
  const tokenHash = hashCapability(input.token);
  const now = new Date();

  const result = await db.transaction(async (transaction) => {
    const grant = await transaction.query.orderAccessGrants.findFirst({
      where: and(
        eq(orderAccessGrants.tokenHash, tokenHash),
        or(
          eq(orderAccessGrants.state, "active"),
          and(
            eq(orderAccessGrants.state, "grace"),
            sql`${orderAccessGrants.graceExpiresAt} > now()`,
          ),
        ),
      ),
    });

    const terminallyExpired =
      grant?.terminalExpiresAt !== null &&
      grant?.terminalExpiresAt !== undefined &&
      grant.terminalExpiresAt <= now;
    if (
      !grant ||
      terminallyExpired ||
      !grant.scopes.includes(input.requiredScope)
    ) {
      if (grant && terminallyExpired) {
        await transaction
          .update(orderAccessGrants)
          .set({ state: "expired" })
          .where(eq(orderAccessGrants.id, grant.id));
      }
      await transaction.insert(securityEvents).values({
        eventType: "guest_grant.denied",
        correlationId: input.correlationId,
        contextHash: denialContextHash(tokenHash),
        retentionExpiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        shopId: grant?.shopId,
        orderId: grant?.orderId,
        grantId: grant?.id,
      });
      return { authorized: false as const };
    }

    await transaction
      .update(orderAccessGrants)
      .set({ lastUsedAt: now })
      .where(eq(orderAccessGrants.id, grant.id));

    return {
      authorized: true as const,
      kind: "guest" as const,
      shopId: grant.shopId,
      orderId: grant.orderId,
      grantId: grant.id,
      scopes: grant.scopes as GuestScope[],
    };
  });

  if (!result.authorized) throw new Error("not_found");
  return result;
}

export async function rotateOrderGrant(input: {
  shopId: string;
  orderId: string;
  authority: OrderAuthority;
  currentGrantId?: string;
  capabilityEncryptionKey: string;
  capabilityKeyVersion: string;
}) {
  requireOrderAuthority(
    input.authority,
    input.shopId,
    input.orderId,
    "link:rotate",
  );
  const currentGrantId =
    input.authority.kind === "guest"
      ? input.authority.grantId
      : input.currentGrantId;
  if (!currentGrantId) throw new Error("not_found");

  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [order] = await transaction
      .select({ terminalState: orders.terminalState })
      .from(orders)
      .where(and(eq(orders.shopId, input.shopId), eq(orders.id, input.orderId)))
      .for("update");
    if (!order || order.terminalState !== "active") {
      throw new Error("not_found");
    }
    const [current] = await transaction
      .select()
      .from(orderAccessGrants)
      .where(
        and(
          eq(orderAccessGrants.shopId, input.shopId),
          eq(orderAccessGrants.orderId, input.orderId),
          eq(orderAccessGrants.id, currentGrantId),
          eq(orderAccessGrants.state, "active"),
        ),
      )
      .for("update");
    if (!current) throw new Error("not_found");

    const capability = createCapability();
    const grantId = randomUUID();
    const deliveryId = randomUUID();
    const outboxId = randomUUID();
    const now = new Date();
    await transaction.insert(capabilityDeliveries).values({
      id: deliveryId,
      purpose: "guest_order_link_replacement",
      ownerId: input.orderId,
      encryptedCapability: encryptCapability(
        capability,
        input.capabilityEncryptionKey,
      ),
      keyVersion: input.capabilityKeyVersion,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
    await transaction.insert(orderAccessGrants).values({
      id: grantId,
      shopId: input.shopId,
      orderId: input.orderId,
      tokenHash: hashCapability(capability),
      state: "pending",
      scopes: current.scopes,
      replacesGrantId: current.id,
      deliveryOutboxEventId: outboxId,
    });
    await transaction.insert(outboxEvents).values({
      id: outboxId,
      shopId: input.shopId,
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: "access.replacement_delivery_requested.v1",
      payload: {
        schema_version: "1",
        order_id: input.orderId,
        pending_grant_id: grantId,
        template_version: "guest_link_replacement.v1",
        capability_delivery_id: deliveryId,
      },
    });
    return { pendingGrantId: grantId, capability };
  });
}

export async function activateDeliveredGrant(input: {
  shopId: string;
  grantId: string;
  deliveryOutboxEventId: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [grant] = await transaction
      .select()
      .from(orderAccessGrants)
      .where(
        and(
          eq(orderAccessGrants.shopId, input.shopId),
          eq(orderAccessGrants.id, input.grantId),
          eq(
            orderAccessGrants.deliveryOutboxEventId,
            input.deliveryOutboxEventId,
          ),
          eq(orderAccessGrants.state, "pending"),
        ),
      )
      .for("update");
    if (!grant) throw new Error("not_found");
    const deliveryEvent = await transaction.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.id, input.deliveryOutboxEventId),
        eq(outboxEvents.shopId, input.shopId),
        eq(outboxEvents.aggregateId, grant.orderId),
      ),
    });
    const deliveryId = deliveryEvent?.payload.capability_delivery_id;
    if (typeof deliveryId !== "string") throw new Error("not_found");
    const now = new Date();
    if (grant.replacesGrantId) {
      await transaction
        .update(orderAccessGrants)
        .set({
          state: "grace",
          graceExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        })
        .where(eq(orderAccessGrants.id, grant.replacesGrantId));
    }
    await transaction
      .update(orderAccessGrants)
      .set({ state: "active", activationAt: now })
      .where(eq(orderAccessGrants.id, grant.id));
    await transaction
      .update(capabilityDeliveries)
      .set({ encryptedCapability: null, deliveredAt: now, erasedAt: now })
      .where(eq(capabilityDeliveries.id, deliveryId));
    return { activatedAt: now };
  });
}

export async function rejectGrantDelivery(input: {
  shopId: string;
  grantId: string;
  deliveryOutboxEventId: string;
}) {
  const { db } = getDatabase();
  return db.transaction(async (transaction) => {
    const [grant] = await transaction
      .select()
      .from(orderAccessGrants)
      .where(
        and(
          eq(orderAccessGrants.shopId, input.shopId),
          eq(orderAccessGrants.id, input.grantId),
          eq(
            orderAccessGrants.deliveryOutboxEventId,
            input.deliveryOutboxEventId,
          ),
          eq(orderAccessGrants.state, "pending"),
        ),
      )
      .for("update");
    if (!grant) throw new Error("not_found");

    const deliveryEvent = await transaction.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.id, input.deliveryOutboxEventId),
        eq(outboxEvents.shopId, input.shopId),
      ),
    });
    const deliveryId = deliveryEvent?.payload.capability_delivery_id;
    const now = new Date();
    await transaction
      .update(orderAccessGrants)
      .set({ state: "revoked", revokedAt: now })
      .where(eq(orderAccessGrants.id, grant.id));
    if (typeof deliveryId === "string") {
      await transaction
        .update(capabilityDeliveries)
        .set({ encryptedCapability: null, erasedAt: now })
        .where(eq(capabilityDeliveries.id, deliveryId));
    }
    return { revokedAt: now };
  });
}

export async function revokeOrderGrant(input: {
  shopId: string;
  orderId: string;
  grantId: string;
  authority: OrderAuthority;
}) {
  requireOrderAuthority(
    input.authority,
    input.shopId,
    input.orderId,
    "link:rotate",
  );
  if (
    input.authority.kind !== "admin" &&
    input.authority.grantId !== input.grantId
  ) {
    throw new Error("not_found");
  }

  const { db } = getDatabase();
  const now = new Date();
  const updated = await db
    .update(orderAccessGrants)
    .set({ state: "revoked", revokedAt: now })
    .where(
      and(
        eq(orderAccessGrants.shopId, input.shopId),
        eq(orderAccessGrants.orderId, input.orderId),
        eq(orderAccessGrants.id, input.grantId),
        or(
          eq(orderAccessGrants.state, "active"),
          eq(orderAccessGrants.state, "grace"),
        ),
      ),
    )
    .returning({ id: orderAccessGrants.id });
  if (updated.length !== 1) throw new Error("not_found");
  return { revokedAt: now };
}
