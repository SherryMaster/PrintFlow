import { describe, expect, it } from "vitest";

import {
  recordOperationalSignal,
  setOperationalSignalSinkForTests,
  type OperationalSignal,
} from "@/observability/operations";

describe("operational telemetry", () => {
  it("accepts identifiers and measurements without an arbitrary private data bag", () => {
    const captured: OperationalSignal[] = [];
    const restore = setOperationalSignalSinkForTests((signal) => {
      captured.push(signal);
    });

    recordOperationalSignal({
      name: "outbox_lag",
      operation: "claim_outbox_batch",
      eventId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
      value: 42,
      occurredAt: "2026-09-19T00:00:00.000Z",
    });
    restore();

    expect(captured).toEqual([
      {
        name: "outbox_lag",
        operation: "claim_outbox_batch",
        eventId: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
        value: 42,
        occurredAt: "2026-09-19T00:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(captured)).not.toContain("contact");
    expect(JSON.stringify(captured)).not.toContain("token");
  });
});
