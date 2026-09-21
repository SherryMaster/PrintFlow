import { describe, expect, it } from "vitest";

import { transitionJob } from "@/modules/orders/lifecycle";

describe("order lifecycle command input boundaries", () => {
  it("[AC-6] rejects an unknown workflow state before database access", async () => {
    await expect(
      transitionJob({
        shopId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
        orderId: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
        jobId: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
        expectedOrderVersion: 1,
        expectedJobVersion: 1,
        targetState: "skipped" as never,
        actorSnapshotId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
      }),
    ).rejects.toThrow();
  });

  it("[AC-11] rejects stale version zero at the command boundary", async () => {
    await expect(
      transitionJob({
        shopId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
        orderId: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
        jobId: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
        expectedOrderVersion: 0,
        expectedJobVersion: 1,
        targetState: "received",
        actorSnapshotId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
      }),
    ).rejects.toThrow();
  });
});
