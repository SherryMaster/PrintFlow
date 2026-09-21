import { and, desc, eq, lt, or } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  artworkItems,
  artworkVersions,
  internalNotes,
  jobs,
  orderActivityEntries,
  orders,
} from "@/db/schema";
import type { OrderAuthority } from "@/modules/orders/authorization";

type Cursor = {
  occurredAt: Date;
  id: string;
};

function pageSize(value?: number): number {
  return Math.min(Math.max(value ?? 50, 1), 100);
}

async function assertAdminOrder(
  authority: OrderAuthority,
  orderId: string,
): Promise<void> {
  if (authority.kind !== "admin") {
    throw new Error("not_found");
  }

  const { db } = getDatabase();
  const order = await db.query.orders.findFirst({
    columns: { id: true },
    where: and(eq(orders.shopId, authority.shopId), eq(orders.id, orderId)),
  });
  if (!order) {
    throw new Error("not_found");
  }
}

export async function getOrderActivityPage(input: {
  authority: OrderAuthority;
  orderId: string;
  cursor?: Cursor;
  limit?: number;
}) {
  await assertAdminOrder(input.authority, input.orderId);
  const { db } = getDatabase();

  return db
    .select()
    .from(orderActivityEntries)
    .where(
      and(
        eq(orderActivityEntries.shopId, input.authority.shopId),
        eq(orderActivityEntries.orderId, input.orderId),
        input.cursor
          ? or(
              lt(orderActivityEntries.occurredAt, input.cursor.occurredAt),
              and(
                eq(orderActivityEntries.occurredAt, input.cursor.occurredAt),
                lt(orderActivityEntries.id, input.cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(orderActivityEntries.occurredAt),
      desc(orderActivityEntries.id),
    )
    .limit(pageSize(input.limit));
}

export async function getInternalNotesPage(input: {
  authority: OrderAuthority;
  orderId: string;
  before?: Date;
  limit?: number;
}) {
  await assertAdminOrder(input.authority, input.orderId);
  const { db } = getDatabase();

  return db
    .select()
    .from(internalNotes)
    .where(
      and(
        eq(internalNotes.shopId, input.authority.shopId),
        eq(internalNotes.orderId, input.orderId),
        input.before ? lt(internalNotes.createdAt, input.before) : undefined,
      ),
    )
    .orderBy(desc(internalNotes.createdAt), desc(internalNotes.id))
    .limit(pageSize(input.limit));
}

export async function getArtworkHistoryPage(input: {
  authority: OrderAuthority;
  orderId: string;
  jobId: string;
  before?: Date;
  limit?: number;
}) {
  await assertAdminOrder(input.authority, input.orderId);
  const { db } = getDatabase();

  return db
    .select({
      itemId: artworkItems.id,
      purpose: artworkItems.purpose,
      versionId: artworkVersions.id,
      versionNumber: artworkVersions.versionNumber,
      storedObjectId: artworkVersions.storedObjectId,
      createdAt: artworkVersions.createdAt,
    })
    .from(artworkItems)
    .innerJoin(
      jobs,
      and(
        eq(jobs.shopId, artworkItems.shopId),
        eq(jobs.id, artworkItems.jobId),
      ),
    )
    .innerJoin(
      artworkVersions,
      and(
        eq(artworkVersions.shopId, artworkItems.shopId),
        eq(artworkVersions.artworkItemId, artworkItems.id),
      ),
    )
    .where(
      and(
        eq(artworkItems.shopId, input.authority.shopId),
        eq(jobs.orderId, input.orderId),
        eq(artworkItems.jobId, input.jobId),
        input.before ? lt(artworkVersions.createdAt, input.before) : undefined,
      ),
    )
    .orderBy(desc(artworkVersions.createdAt), desc(artworkVersions.id))
    .limit(pageSize(input.limit));
}
