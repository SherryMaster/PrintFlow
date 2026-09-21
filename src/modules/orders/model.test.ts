import { describe, expect, it } from "vitest";

import {
  allocateQuoteAdjustment,
  canTransitionJob,
  deriveJobBlockers,
  deriveOrderProgress,
  hasExactQuoteCoverage,
  isOrderReady,
  parseEventPayload,
  withBlocker,
  withoutBlocker,
} from "@/modules/orders/model";

describe("order lifecycle", () => {
  it("allows forward moves and reasoned adjacent reversals", () => {
    expect(canTransitionJob("received", "under_review", false)).toBe(true);
    expect(canTransitionJob("under_review", "received", false)).toBe(false);
    expect(canTransitionJob("under_review", "received", true)).toBe(true);
    expect(canTransitionJob("ready", "canceled", true)).toBe(true);
    expect(canTransitionJob("canceled", "received", true)).toBe(false);
  });

  it("derives progress from the least advanced active job", () => {
    expect(deriveOrderProgress(["ready", "in_production", "canceled"])).toBe(
      "in_production",
    );
    expect(deriveOrderProgress(["canceled"])).toBe("canceled");
    expect(isOrderReady(["ready", "canceled"], 0)).toBe(true);
    expect(isOrderReady(["ready"], 1)).toBe(false);
  });

  it("[AC-6] rejects skipped, repeated, and unreasoned workflow moves", () => {
    expect(canTransitionJob("received", "ready_for_production", true)).toBe(
      false,
    );
    expect(canTransitionJob("under_review", "under_review", true)).toBe(false);
    expect(canTransitionJob("ready", "in_production", false)).toBe(false);
  });

  it("[AC-3] does not mark an order ready when it has no active jobs", () => {
    expect(isOrderReady(["canceled"], 0)).toBe(false);
    expect(deriveOrderProgress([])).toBe("canceled");
  });
});

describe("quote adjustment allocation", () => {
  const jobs = [
    { jobRevisionId: "b", lineNumber: 2, subtotal: 100n, tax: 0n },
    { jobRevisionId: "a", lineNumber: 1, subtotal: 100n, tax: 0n },
    { jobRevisionId: "c", lineNumber: 3, subtotal: 100n, tax: 0n },
  ];

  it("uses line order to allocate positive and negative remainders", () => {
    const positive = allocateQuoteAdjustment(jobs, 2n);
    const negative = allocateQuoteAdjustment(jobs, -2n);

    expect(positive.map((job) => job.allocatedAdjustment)).toEqual([
      1n,
      1n,
      0n,
    ]);
    expect(negative.map((job) => job.allocatedAdjustment)).toEqual([
      -1n,
      -1n,
      0n,
    ]);
  });

  it("keeps the allocated sum equal to the requested adjustment", () => {
    const allocation = allocateQuoteAdjustment(
      [
        { jobRevisionId: "a", lineNumber: 1, subtotal: 300n, tax: 20n },
        { jobRevisionId: "b", lineNumber: 2, subtotal: 100n, tax: 10n },
      ],
      77n,
    );
    expect(
      allocation.reduce((sum, job) => sum + job.allocatedAdjustment, 0n),
    ).toBe(77n);
    expect(allocation.reduce((sum, job) => sum + job.roundedTotal, 0n)).toBe(
      500n,
    );
  });

  it("[AC-4] distributes an adjustment across jobs with zero subtotals", () => {
    const allocation = allocateQuoteAdjustment(
      [
        { jobRevisionId: "a", lineNumber: 1, subtotal: 0n, tax: 0n },
        { jobRevisionId: "b", lineNumber: 2, subtotal: 0n, tax: 0n },
      ],
      101n,
    );

    expect(allocation.map((job) => job.allocatedAdjustment)).toEqual([
      51n,
      50n,
    ]);
    expect(
      allocation.reduce((sum, job) => sum + job.allocatedAdjustment, 0n),
    ).toBe(101n);
  });

  it("[AC-4] rejects empty and negative quote lines", () => {
    expect(() => allocateQuoteAdjustment([], 1n)).toThrow();
    expect(() =>
      allocateQuoteAdjustment(
        [{ jobRevisionId: "a", lineNumber: 1, subtotal: -1n, tax: 0n }],
        0n,
      ),
    ).toThrow();
  });
});

describe("quote coverage and blockers", () => {
  it("keeps commercial, artwork, and proof blockers on revisions", () => {
    expect(
      deriveJobBlockers(
        {
          required_artwork_purposes: ["print_source"],
          proof_approval_required: true,
        },
        "standard",
      ),
    ).toEqual(["price_acceptance", "artwork_review", "proof_approval"]);
    expect(
      deriveJobBlockers(
        { required_artwork_purposes: [], proof_approval_required: false },
        "standard",
        { standardPriceAccepted: true },
      ),
    ).toEqual([]);

    expect(
      deriveJobBlockers(
        {
          required_artwork_purposes: [],
          proof_approval_required: false,
        },
        "quote_required",
      ),
    ).toEqual(["quote_response"]);
  });

  it("requires one supplied revision for every active quoted job", () => {
    expect(hasExactQuoteCoverage(["a", "b"], ["b", "a"])).toBe(true);
    expect(hasExactQuoteCoverage(["a", "b"], ["a"])).toBe(false);
    expect(hasExactQuoteCoverage(["a", "b"], ["a", "b", "c"])).toBe(false);
    expect(hasExactQuoteCoverage(["a", "b"], ["a", "a"])).toBe(false);
  });

  it("removes only the resolved blocker", () => {
    expect(
      withoutBlocker(
        {
          schema_version: "blocker_projection.v1",
          blockers: ["quote_response", "artwork_review"],
        },
        "quote_response",
      ),
    ).toEqual({
      schema_version: "blocker_projection.v1",
      blockers: ["artwork_review"],
    });
  });

  it("adds a missing blocker without duplicating it", () => {
    expect(
      withBlocker(
        {
          schema_version: "blocker_projection.v1",
          blockers: ["artwork_review"],
        },
        "quote_response",
      ),
    ).toEqual({
      schema_version: "blocker_projection.v1",
      blockers: ["artwork_review", "quote_response"],
    });
    expect(
      withBlocker(
        {
          schema_version: "blocker_projection.v1",
          blockers: ["quote_response"],
        },
        "quote_response",
      ).blockers,
    ).toEqual(["quote_response"]);
  });
});

describe("event schemas", () => {
  it("rejects unknown fields from versioned payloads", () => {
    const result = parseEventPayload("order.terminal.v1", {
      schema_version: "1",
      order_id: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
      activity_entry_id: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
      template_version: "terminal.v1",
      contact_email: "private@example.com",
    });
    expect(result.success).toBe(false);
  });
});
