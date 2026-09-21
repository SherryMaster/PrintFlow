import { describe, expect, it } from "vitest";

import {
  assertEventPayload,
  customerVisibleStateEmailAllowlist,
  eventRegistry,
} from "@/jobs/events";
import { nextAttemptAt, outboxRetryMinutes } from "@/jobs/outbox";

describe("outbox retry schedule", () => {
  it("uses the fixed bounded recovery schedule", () => {
    expect(outboxRetryMinutes).toEqual([0, 1, 5, 15, 60, 180, 480, 1440]);
    const first = new Date("2026-09-18T00:00:00.000Z");
    expect(nextAttemptAt(first, 3)?.toISOString()).toBe(
      "2026-09-18T00:15:00.000Z",
    );
    expect(nextAttemptAt(first, 8)).toBeNull();
  });
});

describe("outbox event registry", () => {
  it("keeps every event schema paired with delivery metadata", () => {
    expect(Object.keys(eventRegistry)).toHaveLength(12);
    expect(customerVisibleStateEmailAllowlist).toEqual([
      "in_production",
      "ready",
    ]);
    expect(
      eventRegistry["order.confirmation_requested.v1"].templateVersion,
    ).toBe("order_confirmation.v1");
  });

  it("rejects unknown event types before dispatch", () => {
    expect(() => assertEventPayload("unknown.v1", {})).toThrow(
      "unregistered_event_type",
    );
  });

  it("[AC-10] accepts a complete customer confirmation payload", () => {
    expect(() =>
      assertEventPayload("order.confirmation_requested.v1", {
        schema_version: "1",
        order_id: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
        pending_grant_id: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
        template_version: "order_confirmation.v1",
        capability_delivery_id: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
      }),
    ).not.toThrow();
  });

  it("[AC-10] rejects private fields and missing required event fields", () => {
    expect(() =>
      assertEventPayload("order.confirmation_requested.v1", {
        schema_version: "1",
        order_id: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
        pending_grant_id: "5b4f0d9b-b6ec-4f69-b2a6-e14e52f84ffd",
        template_version: "order_confirmation.v1",
        capability_delivery_id: "f734e65d-6c8a-4ff5-b2f5-9aa8a524f1e4",
        contact_email: "private@example.com",
      }),
    ).toThrow("invalid_event_payload");
    expect(() =>
      assertEventPayload("order.confirmation_requested.v1", {
        schema_version: "1",
        order_id: "37e69597-d813-4e6a-a8f4-c3edc8f41870",
      }),
    ).toThrow("invalid_event_payload");
  });
});
