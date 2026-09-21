import { describe, expect, it } from "vitest";

import { issueQuote } from "@/modules/orders/quotes";

const baseQuote = {
  shopId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
  orderId: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
  expectedOrderVersion: 1,
  actorSnapshotId: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
  activeGrantId: "c35a8b8c-dc86-45f6-ae35-0c7c8c7e1d2a",
  validUntil: new Date("2026-09-30T00:00:00.000Z"),
  adjustmentPaisa: 0n,
  customerMessage: "Your quote is ready",
  terms: {},
};

describe("quote command input boundaries", () => {
  it("[AC-4] rejects an empty quote before database access", async () => {
    await expect(issueQuote({ ...baseQuote, jobs: [] })).rejects.toThrow();
  });

  it("[AC-11] rejects an incomplete quote line before database access", async () => {
    await expect(
      issueQuote({
        ...baseQuote,
        jobs: [
          {
            jobId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
            jobRevisionId: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
            lineNumber: 1,
            description: "",
            subtotalPaisa: 100n,
            taxPaisa: 0n,
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
