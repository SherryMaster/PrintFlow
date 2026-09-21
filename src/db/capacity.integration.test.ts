import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  assertRepresentativePlansUseIndexes,
  capacityRowCounts,
  collectRepresentativeQueryPlans,
  verifyOperationalIndexes,
} from "@/db/capacity";
import { getDatabase } from "@/db/client";

const runCapacityTests = process.env.RUN_CAPACITY_TESTS === "1";

describe.skipIf(!runCapacityTests)("five year pilot capacity", () => {
  afterAll(async () => {
    await getDatabase().sql.end();
  }, 60_000);

  it("keeps representative operational reads on their intended indexes", async () => {
    const { db } = getDatabase();
    const shopId = randomUUID();
    const membershipId = randomUUID();
    const actorId = randomUUID();
    const expected = capacityRowCounts();
    const capacityBatchSize = 25_000;
    const capacityRanges = Array.from(
      { length: Math.ceil(expected.orders / capacityBatchSize) },
      (_, index) => {
        const start = index * capacityBatchSize + 1;
        return {
          start,
          end: Math.min(start + capacityBatchSize - 1, expected.orders),
        };
      },
    );
    const rollbackMarker = Symbol("capacity fixture rollback");

    try {
      await db.transaction(async (transaction) => {
        await transaction.execute(sql`set transaction read write`);
        await transaction.execute(sql`
        do $$
        declare
          constraint_row record;
        begin
          for constraint_row in
            select conrelid::regclass as table_name, conname
            from pg_constraint
            where contype = 'f'
              and connamespace = 'app'::regnamespace
          loop
            execute format(
              'alter table %s drop constraint %I',
              constraint_row.table_name,
              constraint_row.conname
            );
          end loop;
        end $$;
      `);
        await transaction.execute(sql`
        insert into app.shops (
          id, slug, name, timezone, currency, reference_prefix, settings
        ) values (
          ${shopId},
          ${`capacity-${shopId}`},
          'Capacity proof',
          'Asia/Karachi',
          'PKR',
          'PF',
          '{"schema_version":"shop_settings.v1","quote_validity_days":7,"rounding_rule":"nearest_rupee_half_up"}'::jsonb
        )
      `);
        await transaction.execute(sql`
        insert into app.shop_memberships (
          id, shop_id, auth_user_id, display_name, role, active
        ) values (
          ${membershipId}, ${shopId}, ${randomUUID()}, 'Capacity admin', 'admin', true
        )
      `);
        await transaction.execute(sql`
        insert into app.actor_snapshots (id, shop_id, type, display_label)
        values (${actorId}, ${shopId}, 'system', 'System')
      `);
        for (const range of capacityRanges) {
          await transaction.execute(sql`
        insert into app.orders (
          id,
          shop_id,
          reference,
          source,
          contact_name,
          contact_phone_display,
          contact_phone_search,
          terminal_state,
          submitted_at,
          confirmed_due_at
        )
        select md5(${shopId}::text || '-order-' || sequence)::uuid,
               ${shopId},
               'PF-2024-' || lpad(sequence::text, 6, '0'),
               'walk_in',
               'Capacity customer ' || sequence,
               '0300' || lpad(sequence::text, 7, '0'),
               '+92300' || lpad(sequence::text, 7, '0'),
               'active',
               timestamptz '2024-01-01 00:00:00+00' + (sequence % 1825) * interval '1 day',
               timestamptz '2024-01-02 00:00:00+00' + (sequence % 1825) * interval '1 day'
        from generate_series(${range.start}::integer, ${range.end}::integer) as sequence
      `);
        }
        for (const range of capacityRanges) {
          await transaction.execute(sql`
        insert into app.jobs (
          id,
          shop_id,
          order_id,
          line_number,
          workflow_state,
          blocker_projection,
          production_hold
        )
        select md5(${shopId}::text || '-job-' || sequence || '-' || line)::uuid,
               ${shopId},
               md5(${shopId}::text || '-order-' || sequence)::uuid,
               line,
               'received',
               '{"schema_version":"blocker_projection.v1","blockers":[]}'::jsonb,
               false
        from generate_series(${range.start}::integer, ${range.end}::integer) as sequence
        cross join generate_series(1, 2) as line
      `);
        }
        await transaction.execute(sql`
        insert into app.order_activity_entries (
          id,
          shop_id,
          order_id,
          action_type,
          actor_snapshot_id,
          occurred_at,
          details,
          correlation_id
        )
        select md5(${shopId}::text || '-activity-' || entry)::uuid,
               ${shopId},
               md5(${shopId}::text || '-order-1')::uuid,
               'capacity.proof',
               ${actorId},
               timestamptz '2024-01-01 00:00:00+00' + entry * interval '1 minute',
               '{"schema_version":"order_activity.v1"}'::jsonb,
               md5(${shopId}::text || '-correlation-' || entry)::uuid
        from generate_series(1, 2) as entry
      `);
        for (const range of capacityRanges) {
          await transaction.execute(sql`
        insert into app.artwork_versions (
          id,
          shop_id,
          artwork_item_id,
          stored_object_id,
          version_number,
          uploader_snapshot_id
        )
        select md5(${shopId}::text || '-artwork-version-' || sequence || '-' || line || '-' || version)::uuid,
               ${shopId},
               md5('artwork-' || md5(${shopId}::text || '-order-' || sequence)::uuid || '-' || line)::uuid,
               md5(${shopId}::text || '-object-' || sequence || '-' || line || '-' || version)::uuid,
               version,
               ${actorId}
        from generate_series(${range.start}::integer, ${range.end}::integer) as sequence
        cross join generate_series(1, 2) as line
        cross join generate_series(1, 2) as version
      `);
        }

        const [counts] = await transaction.execute<{
          orders: number;
          jobs: number;
          artwork_versions: number;
        }>(sql`
        select
          (select count(*)::integer from app.orders where shop_id = ${shopId}) as orders,
          (select count(*)::integer from app.jobs where shop_id = ${shopId}) as jobs,
          (select count(*)::integer from app.artwork_versions where shop_id = ${shopId}) as artwork_versions
      `);
        expect(counts).toEqual({
          orders: expected.orders,
          jobs: expected.jobs,
          artwork_versions: expected.artworkVersions,
        });

        await transaction.execute(
          sql`analyze app.orders, app.jobs, app.order_activity_entries, app.artwork_versions`,
        );
        await expect(
          verifyOperationalIndexes(transaction),
        ).resolves.toBeDefined();
        const [sampleOrder] = await transaction.execute<{ id: string }>(sql`
        select id
        from app.orders
        where shop_id = ${shopId}
          and reference = 'PF-2024-000001'
      `);
        if (!sampleOrder) {
          throw new Error("Expected a seeded capacity order");
        }
        const orderId = sampleOrder.id;
        const plans = await collectRepresentativeQueryPlans(
          {
            shopId,
            orderId,
            reference: "PF-2024-000001",
            phoneSearch: "+923000000001",
            dueBefore: new Date("2024-01-12T00:00:00.000Z"),
          },
          transaction,
        );
        expect(() => assertRepresentativePlansUseIndexes(plans)).not.toThrow();
        throw rollbackMarker;
      });
    } catch (error) {
      if (error !== rollbackMarker) {
        throw error;
      }
    }
  }, 900_000);
});
