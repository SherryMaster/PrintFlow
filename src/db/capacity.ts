import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { getDatabase } from "@/db/client";
import type * as schema from "@/db/schema";

type QueryExecutor = Pick<PostgresJsDatabase<typeof schema>, "execute">;

export const requiredOperationalIndexes = [
  "orders_shop_reference_unique",
  "orders_shop_state_created_idx",
  "orders_shop_due_idx",
  "orders_shop_phone_idx",
  "orders_shop_email_idx",
  "order_activity_order_occurred_idx",
  "jobs_order_state_idx",
  "jobs_order_line_unique",
  "artwork_versions_item_number_unique",
  "outbox_events_claim_idx",
] as const;

export const capacityProfile = {
  days: 365 * 5,
  ordersPerDay: 100,
  averageJobsPerOrder: 2,
  averageArtworkVersionsPerJob: 2,
  maximumJobsPerOrder: 20,
  maximumArtworkVersionsPerJob: 20,
} as const;

export function capacityRowCounts() {
  const orders = capacityProfile.days * capacityProfile.ordersPerDay;
  const jobs = orders * capacityProfile.averageJobsPerOrder;
  return {
    orders,
    jobs,
    artworkVersions: jobs * capacityProfile.averageArtworkVersionsPerJob,
  };
}

export async function verifyOperationalIndexes(executor?: QueryExecutor) {
  const queryExecutor = executor ?? getDatabase().db;
  const rows = await queryExecutor.execute<{ indexname: string }>(sql`
    select indexname
    from pg_indexes
    where schemaname = 'app'
      and indexname in ${sql.raw(
        `(${requiredOperationalIndexes.map((name) => `'${name}'`).join(",")})`,
      )}
  `);
  const found = new Set(rows.map((row) => row.indexname));
  const missing = requiredOperationalIndexes.filter(
    (indexName) => !found.has(indexName),
  );
  if (missing.length > 0) {
    throw new Error(`Missing operational indexes: ${missing.join(", ")}`);
  }
  return { found: [...found].sort() };
}

export async function collectRepresentativeQueryPlans(
  input: {
    shopId: string;
    orderId: string;
    reference: string;
    phoneSearch: string;
    dueBefore: Date;
  },
  executor?: QueryExecutor,
) {
  const queryExecutor = executor ?? getDatabase().db;
  const queries = {
    reference: sql`select id from app.orders where shop_id = ${input.shopId} and reference = ${input.reference}`,
    dueQueue: sql`select id from app.orders where shop_id = ${input.shopId} and confirmed_due_at <= ${input.dueBefore.toISOString()} order by confirmed_due_at, id limit 100`,
    contact: sql`select id from app.orders where shop_id = ${input.shopId} and contact_phone_search = ${input.phoneSearch} limit 100`,
    activity: sql`select id from app.order_activity_entries where order_id = ${input.orderId} order by occurred_at desc, id desc limit 100`,
    jobs: sql`select id from app.jobs where order_id = ${input.orderId} and workflow_state = 'received' order by line_number limit 20`,
    artwork: sql`select id from app.artwork_versions where artwork_item_id = md5(${"artwork-" + input.orderId + "-1"})::uuid order by version_number desc limit 20`,
  };

  const plans: Record<keyof typeof queries, unknown> = {
    reference: null,
    dueQueue: null,
    contact: null,
    activity: null,
    jobs: null,
    artwork: null,
  };
  for (const name of Object.keys(queries) as (keyof typeof queries)[]) {
    const rows = await queryExecutor.execute<{ "QUERY PLAN": unknown }>(
      sql`explain (analyze, buffers, format json) ${queries[name]}`,
    );
    plans[name] = rows[0]?.["QUERY PLAN"];
  }
  return plans;
}

export const representativePlanIndexes = {
  reference: "orders_shop_reference_unique",
  dueQueue: "orders_shop_due_idx",
  contact: "orders_shop_phone_idx",
  activity: "order_activity_order_occurred_idx",
  jobs: ["jobs_order_state_idx", "jobs_order_line_unique"],
  artwork: "artwork_versions_item_number_unique",
} as const;

export function assertRepresentativePlansUseIndexes(
  plans: Record<keyof typeof representativePlanIndexes, unknown>,
): void {
  for (const [queryName, indexName] of Object.entries(
    representativePlanIndexes,
  )) {
    const allowedIndexNames = Array.isArray(indexName)
      ? indexName
      : [indexName];
    const plan = JSON.stringify(
      plans[queryName as keyof typeof representativePlanIndexes],
    );
    if (
      !allowedIndexNames.some((allowedIndexName) =>
        plan.includes(allowedIndexName),
      )
    ) {
      throw new Error(
        `${queryName} did not use ${allowedIndexNames.join(" or ")}`,
      );
    }
  }
}
