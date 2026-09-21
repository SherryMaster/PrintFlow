import { z } from "zod";

const identifier = z.uuid();
const baseEvent = z.object({ schema_version: z.literal("1") }).strict();

export const eventRegistry = {
  "order.confirmation_requested.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      pending_grant_id: identifier,
      template_version: z.literal("order_confirmation.v1"),
      capability_delivery_id: identifier,
    }),
    customerEmail: true,
    templateVersion: "order_confirmation.v1",
  },
  "quote.delivery_requested.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      quote_revision_id: identifier,
      active_grant_id: identifier,
      template_version: z.literal("quote_delivery.v1"),
    }),
    customerEmail: true,
    templateVersion: "quote_delivery.v1",
  },
  "quote.response_recorded.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      quote_response_id: identifier,
      template_version: z.literal("quote_response.v1"),
    }),
    customerEmail: false,
    templateVersion: "quote_response.v1",
  },
  "proof.delivery_requested.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      job_id: identifier,
      proof_version_id: identifier,
      active_grant_id: identifier,
      template_version: z.literal("proof_delivery.v1"),
    }),
    customerEmail: true,
    templateVersion: "proof_delivery.v1",
  },
  "proof.response_recorded.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      job_id: identifier,
      proof_decision_id: identifier,
      template_version: z.literal("proof_response.v1"),
    }),
    customerEmail: false,
    templateVersion: "proof_response.v1",
  },
  "order.visible_status_changed.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      job_id: identifier.optional(),
      activity_entry_id: identifier,
      template_version: z.literal("order_status.v1"),
    }),
    customerEmail: "visible_state_allowlist",
    templateVersion: "order_status.v1",
  },
  "order.terminal.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      activity_entry_id: identifier,
      template_version: z.enum(["order_canceled.v1", "order_collected.v1"]),
    }),
    customerEmail: true,
    templateVersion: ["order_canceled.v1", "order_collected.v1"],
  },
  "artwork.review_requested.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      job_id: identifier,
      artwork_version_id: identifier,
      activity_entry_id: identifier,
    }),
    customerEmail: false,
    templateVersion: null,
  },
  "access.replacement_delivery_requested.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      pending_grant_id: identifier,
      template_version: z.literal("guest_link_replacement.v1"),
      capability_delivery_id: identifier,
    }),
    customerEmail: true,
    templateVersion: "guest_link_replacement.v1",
  },
  "file.accepted.v1": {
    schema: baseEvent.extend({
      upload_session_id: identifier,
      upload_intent_id: identifier,
      stored_object_id: identifier,
      measured_media_type: z.string().min(1),
      measured_size: z.string().regex(/^\d+$/),
    }),
    customerEmail: false,
    templateVersion: null,
  },
  "file.rejected.v1": {
    schema: baseEvent.extend({
      upload_session_id: identifier,
      upload_intent_id: identifier,
      rejection_category: z.string().min(1),
    }),
    customerEmail: false,
    templateVersion: null,
  },
  "job.customer_action_required.v1": {
    schema: baseEvent.extend({
      order_id: identifier,
      job_id: identifier,
      target_type: z.string().min(1),
      target_id: identifier,
      action_category: z.enum([
        "quote_response",
        "proof_response",
        "replacement_artwork",
      ]),
    }),
    customerEmail: false,
    templateVersion: null,
  },
} as const;

export type EventType = keyof typeof eventRegistry;

export const customerVisibleStateEmailAllowlist = [
  "in_production",
  "ready",
] as const;

export type CustomerVisibleEmailState =
  (typeof customerVisibleStateEmailAllowlist)[number];

export function isEventType(value: string): value is EventType {
  return Object.hasOwn(eventRegistry, value);
}

export function parseEventPayload(type: EventType, payload: unknown) {
  return eventRegistry[type].schema.safeParse(payload);
}

export function assertEventPayload(type: string, payload: unknown): EventType {
  if (!isEventType(type)) {
    throw new Error("unregistered_event_type");
  }

  const parsed = parseEventPayload(type, payload);
  if (!parsed.success) {
    throw new Error("invalid_event_payload");
  }

  return type;
}
