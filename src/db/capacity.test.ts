import { describe, expect, it } from "vitest";

import {
  assertRepresentativePlansUseIndexes,
  capacityRowCounts,
  representativePlanIndexes,
  requiredOperationalIndexes,
} from "@/db/capacity";

describe("pilot capacity contract", () => {
  it("represents five years at the agreed average volume", () => {
    expect(capacityRowCounts()).toEqual({
      orders: 182_500,
      jobs: 365_000,
      artworkVersions: 730_000,
    });
  });

  it("names the indexes required by routine operational reads", () => {
    expect(requiredOperationalIndexes).toContain(
      "orders_shop_reference_unique",
    );
    expect(requiredOperationalIndexes).toContain("orders_shop_due_idx");
    expect(requiredOperationalIndexes).toContain(
      "order_activity_order_occurred_idx",
    );
    expect(representativePlanIndexes.jobs).toContain("jobs_order_state_idx");
    expect(requiredOperationalIndexes).toContain("outbox_events_claim_idx");
  });

  it("fails when a representative query does not use its intended index", () => {
    const plans = Object.fromEntries(
      Object.entries(representativePlanIndexes).map(([name, index]) => [
        name,
        [
          {
            Plan: {
              "Index Name": typeof index === "string" ? index : index[0],
            },
          },
        ],
      ]),
    ) as Record<keyof typeof representativePlanIndexes, unknown>;
    expect(() => assertRepresentativePlansUseIndexes(plans)).not.toThrow();
    plans.contact = [{ Plan: { "Node Type": "Seq Scan" } }];
    expect(() => assertRepresentativePlansUseIndexes(plans)).toThrow(
      "contact did not use orders_shop_phone_idx",
    );
  });
});
