DROP INDEX "app"."order_activity_order_occurred_idx";--> statement-breakpoint
DROP INDEX "app"."orders_shop_state_created_idx";--> statement-breakpoint
DROP INDEX "app"."orders_shop_due_idx";--> statement-breakpoint
DROP INDEX "app"."outbox_events_claim_idx";--> statement-breakpoint
ALTER TABLE "app"."outbox_events" ADD COLUMN "first_attempt_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "external_effect_attempts_reconcile_idx" ON "app"."external_effect_attempts" USING btree ("outbox_event_id","state","attempt_number");--> statement-breakpoint
CREATE INDEX "orders_terminal_retention_idx" ON "app"."orders" USING btree ("terminal_state","collected_at","canceled_at");--> statement-breakpoint
CREATE INDEX "stored_objects_bytes_retention_idx" ON "app"."stored_objects" USING btree ("bytes_deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "stored_objects_filename_retention_idx" ON "app"."stored_objects" USING btree ("filename_erased_at","created_at");--> statement-breakpoint
CREATE INDEX "order_activity_order_occurred_idx" ON "app"."order_activity_entries" USING btree ("order_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "orders_shop_state_created_idx" ON "app"."orders" USING btree ("shop_id","terminal_state","created_at","id");--> statement-breakpoint
CREATE INDEX "orders_shop_due_idx" ON "app"."orders" USING btree ("shop_id","confirmed_due_at","id");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "app"."outbox_events" USING btree ("state","next_attempt_at","lease_expires_at");--> statement-breakpoint
CREATE FUNCTION "app"."reject_security_event_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.retention_expires_at <= now() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'security events are immutable until retention expiry' USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
DROP TRIGGER "security_events_immutable" ON "app"."security_events";--> statement-breakpoint
CREATE TRIGGER "security_events_immutable" BEFORE UPDATE OR DELETE ON "app"."security_events" FOR EACH ROW EXECUTE FUNCTION "app"."reject_security_event_change"();--> statement-breakpoint
GRANT UPDATE ("display_label", "stable_identity", "display_erased_at") ON "app"."actor_snapshots" TO printflow_app;--> statement-breakpoint
GRANT DELETE ON "app"."idempotency_records", "app"."security_events", "app"."rate_limit_counters" TO printflow_app;
