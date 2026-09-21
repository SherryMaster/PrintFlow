CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."actor_type" AS ENUM('admin', 'guest', 'assisted_customer', 'system');--> statement-breakpoint
CREATE TYPE "app"."decision" AS ENUM('accepted', 'declined');--> statement-breakpoint
CREATE TYPE "app"."grant_state" AS ENUM('pending', 'active', 'grace', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "app"."job_workflow_state" AS ENUM('received', 'under_review', 'ready_for_production', 'in_production', 'ready', 'canceled');--> statement-breakpoint
CREATE TYPE "app"."lifecycle_state" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "app"."order_source" AS ENUM('online', 'walk_in', 'phone');--> statement-breakpoint
CREATE TYPE "app"."order_terminal_state" AS ENUM('active', 'canceled', 'collected');--> statement-breakpoint
CREATE TYPE "app"."pricing_mode" AS ENUM('standard', 'quote_required');--> statement-breakpoint
CREATE TYPE "app"."quote_state" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "app"."scan_state" AS ENUM('not_required', 'pending', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "app"."upload_state" AS ENUM('pending', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "app"."work_state" AS ENUM('pending', 'leased', 'completed', 'retryable', 'uncertain', 'dead');--> statement-breakpoint
CREATE TABLE "app"."actor_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"type" "app"."actor_type" NOT NULL,
	"stable_identity" text,
	"display_label" text NOT NULL,
	"assisted_channel" text,
	"display_erased_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_snapshots_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"session_identifier_hash" text NOT NULL,
	"signed_in_at" timestamp with time zone NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_session_identifier_hash_unique" UNIQUE("session_identifier_hash"),
	CONSTRAINT "admin_sessions_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."artwork_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"required_checks" jsonb NOT NULL,
	"current_review" text,
	"current_version_id" uuid,
	"production_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_items_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "artwork_items_job_purpose_unique" UNIQUE("job_id","purpose")
);
--> statement-breakpoint
CREATE TABLE "app"."artwork_review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"artwork_version_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"decision" "app"."decision" NOT NULL,
	"reason" text NOT NULL,
	"actor_snapshot_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"corrects_decision_id" uuid,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "artwork_review_decisions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "artwork_review_decisions_version_sequence_unique" UNIQUE("artwork_version_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "app"."artwork_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"artwork_item_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"uploader_snapshot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_versions_stored_object_id_unique" UNIQUE("stored_object_id"),
	CONSTRAINT "artwork_versions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "artwork_versions_item_number_unique" UNIQUE("artwork_item_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "app"."capability_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"encrypted_capability" text,
	"key_version" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"erased_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."catalog_version_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_snapshot_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_version_events_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "catalog_version_events_target_event_unique" UNIQUE("target_type","target_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "app"."draft_job_objects" (
	"shop_id" uuid NOT NULL,
	"draft_job_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	CONSTRAINT "draft_job_objects_shop_id_draft_job_id_stored_object_id_pk" PRIMARY KEY("shop_id","draft_job_id","stored_object_id")
);
--> statement-breakpoint
CREATE TABLE "app"."draft_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_draft_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"service_version_id" uuid NOT NULL,
	"price_rule_version_id" uuid NOT NULL,
	"configuration" jsonb NOT NULL,
	"measurements" jsonb NOT NULL,
	"price_preview" jsonb,
	"requirements" jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_jobs_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "draft_jobs_order_line_unique" UNIQUE("order_draft_id","line_number"),
	CONSTRAINT "draft_jobs_line_positive" CHECK ("app"."draft_jobs"."line_number" > 0),
	CONSTRAINT "draft_jobs_quantity_positive" CHECK ("app"."draft_jobs"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."external_effect_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"lease_fence" bigint NOT NULL,
	"provider" text NOT NULL,
	"effect_type" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" "app"."work_state" NOT NULL,
	"provider_identifier" text,
	"reconciliation_result" text,
	"response_summary" jsonb,
	"uncertain_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	CONSTRAINT "external_effect_attempts_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "external_effect_attempts_event_attempt_unique" UNIQUE("outbox_event_id","attempt_number")
);
--> statement-breakpoint
CREATE TABLE "app"."idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"operation_type" text NOT NULL,
	"key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" "app"."work_state" DEFAULT 'pending' NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"result_type" text,
	"result_id" uuid,
	"response_snapshot" jsonb,
	"retention_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_records_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "idempotency_records_operation_key_unique" UNIQUE("shop_id","operation_type","key")
);
--> statement-breakpoint
CREATE TABLE "app"."internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"job_id" uuid,
	"body" text NOT NULL,
	"author_snapshot_id" uuid NOT NULL,
	"corrects_note_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_notes_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."job_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"service_version_id" uuid NOT NULL,
	"price_rule_version_id" uuid NOT NULL,
	"configuration" jsonb NOT NULL,
	"measurements" jsonb NOT NULL,
	"requirements" jsonb NOT NULL,
	"pricing_mode" "app"."pricing_mode" NOT NULL,
	"calculation_snapshot" jsonb,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"subtotal" bigint,
	"adjustment" bigint,
	"tax" bigint,
	"rounded_total" bigint,
	"actor_snapshot_id" uuid NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_revisions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "job_revisions_job_number_unique" UNIQUE("job_id","revision_number"),
	CONSTRAINT "job_revisions_number_positive" CHECK ("app"."job_revisions"."revision_number" > 0),
	CONSTRAINT "job_revisions_reason_after_first" CHECK ("app"."job_revisions"."revision_number" = 1 or "app"."job_revisions"."change_reason" is not null),
	CONSTRAINT "job_revisions_amounts_nonnegative" CHECK (coalesce("app"."job_revisions"."subtotal", 0) >= 0 and coalesce("app"."job_revisions"."tax", 0) >= 0 and coalesce("app"."job_revisions"."rounded_total", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"workflow_state" "app"."job_workflow_state" DEFAULT 'received' NOT NULL,
	"blocker_projection" jsonb NOT NULL,
	"production_hold" boolean DEFAULT false NOT NULL,
	"production_hold_reason" text,
	"current_revision_id" uuid,
	"current_proof_version_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "jobs_order_line_unique" UNIQUE("order_id","line_number"),
	CONSTRAINT "jobs_line_positive" CHECK ("app"."jobs"."line_number" > 0),
	CONSTRAINT "jobs_version_positive" CHECK ("app"."jobs"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."order_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"state" "app"."grant_state" DEFAULT 'pending' NOT NULL,
	"scopes" text[] NOT NULL,
	"replaces_grant_id" uuid,
	"activation_at" timestamp with time zone,
	"grace_expires_at" timestamp with time zone,
	"terminal_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"delivery_outbox_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_access_grants_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "order_access_grants_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."order_activity_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"job_id" uuid,
	"action_type" text NOT NULL,
	"actor_snapshot_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb NOT NULL,
	"correlation_id" uuid NOT NULL,
	"idempotency_key" text,
	CONSTRAINT "order_activity_entries_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."order_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"capability_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"source" "app"."order_source" NOT NULL,
	"provisional_contact" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_drafts_capability_hash_unique" UNIQUE("capability_hash"),
	CONSTRAINT "order_drafts_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "order_drafts_version_positive" CHECK ("app"."order_drafts"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."order_reference_counters" (
	"shop_id" uuid NOT NULL,
	"calendar_year" integer NOT NULL,
	"next_value" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "order_reference_counters_shop_id_calendar_year_pk" PRIMARY KEY("shop_id","calendar_year"),
	CONSTRAINT "order_reference_next_positive" CHECK ("app"."order_reference_counters"."next_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"source" "app"."order_source" NOT NULL,
	"contact_name" text,
	"contact_phone_display" text,
	"contact_phone_search" text,
	"contact_email_display" text,
	"contact_email_search" text,
	"terminal_state" "app"."order_terminal_state" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"requested_local_date" date,
	"confirmed_due_at" timestamp with time zone,
	"submitted_at" timestamp with time zone NOT NULL,
	"canceled_at" timestamp with time zone,
	"cancellation_reason" text,
	"collected_at" timestamp with time zone,
	"contact_erased_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "orders_shop_reference_unique" UNIQUE("shop_id","reference"),
	CONSTRAINT "orders_version_positive" CHECK ("app"."orders"."version" > 0),
	CONSTRAINT "orders_online_email_required" CHECK ("app"."orders"."source" <> 'online' or "app"."orders"."contact_email_display" is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" "app"."work_state" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_fence" bigint DEFAULT 0 NOT NULL,
	"claim_owner" text,
	"lease_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "outbox_events_attempt_nonnegative" CHECK ("app"."outbox_events"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."price_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"job_revision_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"customer_actor_snapshot_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"recorded_by_membership_id" uuid,
	"corrects_acceptance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_acceptances_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "price_acceptances_revision_sequence_unique" UNIQUE("job_revision_id","sequence_number"),
	CONSTRAINT "price_acceptances_sequence_positive" CHECK ("app"."price_acceptances"."sequence_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."price_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle" "app"."lifecycle_state" DEFAULT 'draft' NOT NULL,
	"rules" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_rule_versions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "price_rule_versions_service_number_unique" UNIQUE("service_id","version_number"),
	CONSTRAINT "price_rule_version_number_positive" CHECK ("app"."price_rule_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."production_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"blocker_type" text NOT NULL,
	"blocked_target_type" text NOT NULL,
	"blocked_target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"admin_actor_snapshot_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_exceptions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "production_exceptions_proof_only" CHECK ("app"."production_exceptions"."blocker_type" = 'proof_approval')
);
--> statement-breakpoint
CREATE TABLE "app"."proof_artwork_sources" (
	"shop_id" uuid NOT NULL,
	"proof_version_id" uuid NOT NULL,
	"artwork_version_id" uuid NOT NULL,
	CONSTRAINT "proof_artwork_sources_shop_id_proof_version_id_artwork_version_id_pk" PRIMARY KEY("shop_id","proof_version_id","artwork_version_id")
);
--> statement-breakpoint
CREATE TABLE "app"."proof_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"proof_version_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"decision" "app"."decision" NOT NULL,
	"reason" text,
	"customer_actor_snapshot_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"recorded_by_membership_id" uuid,
	"corrects_decision_id" uuid,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "proof_decisions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "proof_decisions_proof_sequence_unique" UNIQUE("proof_version_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "app"."proof_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"job_revision_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"creator_snapshot_id" uuid NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proof_versions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "proof_versions_job_number_unique" UNIQUE("job_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "app"."quote_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"quote_revision_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_snapshot_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quote_lifecycle_events_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"quote_revision_id" uuid NOT NULL,
	"job_revision_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"unit_amount" bigint NOT NULL,
	"subtotal" bigint NOT NULL,
	"allocated_adjustment" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"unrounded_total" bigint NOT NULL,
	"rounded_total" bigint NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "quote_lines_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "quote_lines_revision_sort_unique" UNIQUE("quote_revision_id","sort_order"),
	CONSTRAINT "quote_lines_amounts_nonnegative" CHECK ("app"."quote_lines"."subtotal" >= 0 and "app"."quote_lines"."tax" >= 0 and "app"."quote_lines"."rounded_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."quote_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"quote_revision_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"decision" "app"."decision" NOT NULL,
	"reason" text,
	"customer_actor_snapshot_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"recorded_by_membership_id" uuid,
	"corrects_response_id" uuid,
	"responded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quote_responses_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "quote_responses_revision_sequence_unique" UNIQUE("quote_revision_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "app"."quote_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"quote_thread_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"lifecycle" "app"."quote_state" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"valid_until" timestamp with time zone NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"subtotal" bigint NOT NULL,
	"adjustment" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"rounding_delta" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"customer_message" text NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_revisions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "quote_revisions_thread_number_unique" UNIQUE("quote_thread_id","revision_number"),
	CONSTRAINT "quote_revisions_number_positive" CHECK ("app"."quote_revisions"."revision_number" > 0),
	CONSTRAINT "quote_revisions_amounts_nonnegative" CHECK ("app"."quote_revisions"."subtotal" >= 0 and "app"."quote_revisions"."tax" >= 0 and "app"."quote_revisions"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."quote_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"current_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_threads_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "quote_threads_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."rate_limit_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"identity_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_counters_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "rate_limit_counters_window_unique" UNIQUE("scope","identity_hash","window_started_at"),
	CONSTRAINT "rate_limit_count_nonnegative" CHECK ("app"."rate_limit_counters"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"correlation_id" uuid NOT NULL,
	"context_hash" text NOT NULL,
	"retention_expires_at" timestamp with time zone NOT NULL,
	"shop_id" uuid,
	"order_id" uuid,
	"grant_id" uuid,
	"actor_snapshot_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."service_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle" "app"."lifecycle_state" DEFAULT 'draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_versions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "service_versions_service_number_unique" UNIQUE("service_id","version_number"),
	CONSTRAINT "service_version_number_positive" CHECK ("app"."service_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "services_shop_code_unique" UNIQUE("shop_id","code")
);
--> statement-breakpoint
CREATE TABLE "app"."shop_activity_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"actor_snapshot_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb NOT NULL,
	"correlation_id" uuid NOT NULL,
	"service_id" uuid,
	"idempotency_key" text,
	CONSTRAINT "shop_activity_entries_shop_id_id_unique" UNIQUE("shop_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."shop_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_memberships_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "shop_memberships_shop_user_unique" UNIQUE("shop_id","auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"currency" text NOT NULL,
	"reference_prefix" text NOT NULL,
	"settings" jsonb NOT NULL,
	"contact_details" jsonb,
	"pickup_details" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_slug_unique" UNIQUE("slug"),
	CONSTRAINT "shops_version_positive" CHECK ("app"."shops"."version" > 0),
	CONSTRAINT "shops_currency_pkr" CHECK ("app"."shops"."currency" = 'PKR'),
	CONSTRAINT "shops_timezone_karachi" CHECK ("app"."shops"."timezone" = 'Asia/Karachi')
);
--> statement-breakpoint
CREATE TABLE "app"."stored_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"upload_intent_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"etag" text NOT NULL,
	"original_filename" text,
	"measured_media_type" text NOT NULL,
	"measured_size" bigint NOT NULL,
	"checksum" text NOT NULL,
	"validation_state" text NOT NULL,
	"scan_state" "app"."scan_state" DEFAULT 'not_required' NOT NULL,
	"attached_at" timestamp with time zone,
	"bytes_deleted_at" timestamp with time zone,
	"filename_erased_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stored_objects_upload_intent_id_unique" UNIQUE("upload_intent_id"),
	CONSTRAINT "stored_objects_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "stored_objects_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "stored_objects_size_positive" CHECK ("app"."stored_objects"."measured_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."upload_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"upload_session_id" uuid NOT NULL,
	"quarantine_key" text NOT NULL,
	"declared_filename" text NOT NULL,
	"declared_media_type" text NOT NULL,
	"reserved_bytes" bigint NOT NULL,
	"state" "app"."upload_state" DEFAULT 'pending' NOT NULL,
	"upload_url_expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"cleaned_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_intents_quarantine_key_unique" UNIQUE("quarantine_key"),
	CONSTRAINT "upload_intents_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "upload_intents_size_limit" CHECK ("app"."upload_intents"."reserved_bytes" > 0 and "app"."upload_intents"."reserved_bytes" <= 262144000)
);
--> statement-breakpoint
CREATE TABLE "app"."upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"order_draft_id" uuid,
	"order_id" uuid,
	"authorizing_grant_id" uuid,
	"authorizing_membership_id" uuid,
	"capability_hash" text,
	"version" integer DEFAULT 1 NOT NULL,
	"byte_quota" bigint NOT NULL,
	"reserved_bytes" bigint DEFAULT 0 NOT NULL,
	"accepted_bytes" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"cleaned_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_sessions_shop_id_id_unique" UNIQUE("shop_id","id"),
	CONSTRAINT "upload_sessions_one_owner" CHECK (num_nonnulls("app"."upload_sessions"."order_draft_id", "app"."upload_sessions"."order_id") = 1),
	CONSTRAINT "upload_sessions_quota_valid" CHECK ("app"."upload_sessions"."byte_quota" > 0 and "app"."upload_sessions"."reserved_bytes" >= 0 and "app"."upload_sessions"."accepted_bytes" >= 0 and "app"."upload_sessions"."reserved_bytes" + "app"."upload_sessions"."accepted_bytes" <= "app"."upload_sessions"."byte_quota")
);
--> statement-breakpoint
ALTER TABLE "app"."actor_snapshots" ADD CONSTRAINT "actor_snapshots_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."admin_sessions" ADD CONSTRAINT "admin_sessions_shop_id_membership_id_shop_memberships_shop_id_id_fk" FOREIGN KEY ("shop_id","membership_id") REFERENCES "app"."shop_memberships"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_items" ADD CONSTRAINT "artwork_items_shop_id_job_id_jobs_shop_id_id_fk" FOREIGN KEY ("shop_id","job_id") REFERENCES "app"."jobs"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_review_decisions" ADD CONSTRAINT "artwork_review_decisions_shop_id_job_id_jobs_shop_id_id_fk" FOREIGN KEY ("shop_id","job_id") REFERENCES "app"."jobs"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_review_decisions" ADD CONSTRAINT "artwork_review_decisions_shop_id_artwork_version_id_artwork_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","artwork_version_id") REFERENCES "app"."artwork_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_versions" ADD CONSTRAINT "artwork_versions_shop_id_artwork_item_id_artwork_items_shop_id_id_fk" FOREIGN KEY ("shop_id","artwork_item_id") REFERENCES "app"."artwork_items"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_versions" ADD CONSTRAINT "artwork_versions_shop_id_stored_object_id_stored_objects_shop_id_id_fk" FOREIGN KEY ("shop_id","stored_object_id") REFERENCES "app"."stored_objects"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."artwork_versions" ADD CONSTRAINT "artwork_versions_shop_id_uploader_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","uploader_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_version_events" ADD CONSTRAINT "catalog_version_events_shop_id_actor_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","actor_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draft_job_objects" ADD CONSTRAINT "draft_job_objects_shop_id_draft_job_id_draft_jobs_shop_id_id_fk" FOREIGN KEY ("shop_id","draft_job_id") REFERENCES "app"."draft_jobs"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draft_job_objects" ADD CONSTRAINT "draft_job_objects_shop_id_stored_object_id_stored_objects_shop_id_id_fk" FOREIGN KEY ("shop_id","stored_object_id") REFERENCES "app"."stored_objects"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draft_jobs" ADD CONSTRAINT "draft_jobs_shop_id_order_draft_id_order_drafts_shop_id_id_fk" FOREIGN KEY ("shop_id","order_draft_id") REFERENCES "app"."order_drafts"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draft_jobs" ADD CONSTRAINT "draft_jobs_shop_id_service_version_id_service_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","service_version_id") REFERENCES "app"."service_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."draft_jobs" ADD CONSTRAINT "draft_jobs_shop_id_price_rule_version_id_price_rule_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","price_rule_version_id") REFERENCES "app"."price_rule_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."external_effect_attempts" ADD CONSTRAINT "external_effect_attempts_shop_id_outbox_event_id_outbox_events_shop_id_id_fk" FOREIGN KEY ("shop_id","outbox_event_id") REFERENCES "app"."outbox_events"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."idempotency_records" ADD CONSTRAINT "idempotency_records_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."internal_notes" ADD CONSTRAINT "internal_notes_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "app"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."job_revisions" ADD CONSTRAINT "job_revisions_shop_id_job_id_jobs_shop_id_id_fk" FOREIGN KEY ("shop_id","job_id") REFERENCES "app"."jobs"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."job_revisions" ADD CONSTRAINT "job_revisions_shop_id_service_version_id_service_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","service_version_id") REFERENCES "app"."service_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."job_revisions" ADD CONSTRAINT "job_revisions_shop_id_price_rule_version_id_price_rule_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","price_rule_version_id") REFERENCES "app"."price_rule_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."job_revisions" ADD CONSTRAINT "job_revisions_shop_id_actor_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","actor_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."jobs" ADD CONSTRAINT "jobs_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "app"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_access_grants" ADD CONSTRAINT "order_access_grants_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "app"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_activity_entries" ADD CONSTRAINT "order_activity_entries_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "app"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_drafts" ADD CONSTRAINT "order_drafts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_reference_counters" ADD CONSTRAINT "order_reference_counters_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."outbox_events" ADD CONSTRAINT "outbox_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_acceptances" ADD CONSTRAINT "price_acceptances_shop_id_job_revision_id_job_revisions_shop_id_id_fk" FOREIGN KEY ("shop_id","job_revision_id") REFERENCES "app"."job_revisions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_acceptances" ADD CONSTRAINT "price_acceptances_shop_id_customer_actor_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","customer_actor_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_rule_versions" ADD CONSTRAINT "price_rule_versions_shop_id_service_id_services_shop_id_id_fk" FOREIGN KEY ("shop_id","service_id") REFERENCES "app"."services"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_exceptions" ADD CONSTRAINT "production_exceptions_shop_id_job_id_jobs_shop_id_id_fk" FOREIGN KEY ("shop_id","job_id") REFERENCES "app"."jobs"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_artwork_sources" ADD CONSTRAINT "proof_artwork_sources_shop_id_proof_version_id_proof_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","proof_version_id") REFERENCES "app"."proof_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_artwork_sources" ADD CONSTRAINT "proof_artwork_sources_shop_id_artwork_version_id_artwork_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","artwork_version_id") REFERENCES "app"."artwork_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_decisions" ADD CONSTRAINT "proof_decisions_shop_id_proof_version_id_proof_versions_shop_id_id_fk" FOREIGN KEY ("shop_id","proof_version_id") REFERENCES "app"."proof_versions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_versions" ADD CONSTRAINT "proof_versions_shop_id_job_id_jobs_shop_id_id_fk" FOREIGN KEY ("shop_id","job_id") REFERENCES "app"."jobs"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_versions" ADD CONSTRAINT "proof_versions_shop_id_job_revision_id_job_revisions_shop_id_id_fk" FOREIGN KEY ("shop_id","job_revision_id") REFERENCES "app"."job_revisions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_versions" ADD CONSTRAINT "proof_versions_shop_id_stored_object_id_stored_objects_shop_id_id_fk" FOREIGN KEY ("shop_id","stored_object_id") REFERENCES "app"."stored_objects"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quote_lifecycle_events" ADD CONSTRAINT "quote_lifecycle_events_shop_id_quote_revision_id_quote_revisions_shop_id_id_fk" FOREIGN KEY ("shop_id","quote_revision_id") REFERENCES "app"."quote_revisions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quote_lines" ADD CONSTRAINT "quote_lines_shop_id_quote_revision_id_quote_revisions_shop_id_id_fk" FOREIGN KEY ("shop_id","quote_revision_id") REFERENCES "app"."quote_revisions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quote_lines" ADD CONSTRAINT "quote_lines_shop_id_job_revision_id_job_revisions_shop_id_id_fk" FOREIGN KEY ("shop_id","job_revision_id") REFERENCES "app"."job_revisions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quote_responses" ADD CONSTRAINT "quote_responses_shop_id_quote_revision_id_quote_revisions_shop_id_id_fk" FOREIGN KEY ("shop_id","quote_revision_id") REFERENCES "app"."quote_revisions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quote_revisions" ADD CONSTRAINT "quote_revisions_shop_id_quote_thread_id_quote_threads_shop_id_id_fk" FOREIGN KEY ("shop_id","quote_thread_id") REFERENCES "app"."quote_threads"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quote_threads" ADD CONSTRAINT "quote_threads_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "app"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rate_limit_counters" ADD CONSTRAINT "rate_limit_counters_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."service_versions" ADD CONSTRAINT "service_versions_shop_id_service_id_services_shop_id_id_fk" FOREIGN KEY ("shop_id","service_id") REFERENCES "app"."services"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."services" ADD CONSTRAINT "services_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shop_activity_entries" ADD CONSTRAINT "shop_activity_entries_shop_id_actor_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","actor_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shop_memberships" ADD CONSTRAINT "shop_memberships_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stored_objects" ADD CONSTRAINT "stored_objects_shop_id_upload_intent_id_upload_intents_shop_id_id_fk" FOREIGN KEY ("shop_id","upload_intent_id") REFERENCES "app"."upload_intents"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_intents" ADD CONSTRAINT "upload_intents_shop_id_upload_session_id_upload_sessions_shop_id_id_fk" FOREIGN KEY ("shop_id","upload_session_id") REFERENCES "app"."upload_sessions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "app"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_deliveries_expiry_idx" ON "app"."capability_deliveries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_records_retention_idx" ON "app"."idempotency_records" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "internal_notes_order_created_idx" ON "app"."internal_notes" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_order_state_idx" ON "app"."jobs" USING btree ("order_id","workflow_state");--> statement-breakpoint
CREATE INDEX "order_access_grants_order_state_idx" ON "app"."order_access_grants" USING btree ("order_id","state");--> statement-breakpoint
CREATE INDEX "order_activity_order_occurred_idx" ON "app"."order_activity_entries" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "orders_shop_state_created_idx" ON "app"."orders" USING btree ("shop_id","terminal_state","created_at");--> statement-breakpoint
CREATE INDEX "orders_shop_due_idx" ON "app"."orders" USING btree ("shop_id","confirmed_due_at");--> statement-breakpoint
CREATE INDEX "orders_shop_phone_idx" ON "app"."orders" USING btree ("shop_id","contact_phone_search");--> statement-breakpoint
CREATE INDEX "orders_shop_email_idx" ON "app"."orders" USING btree ("shop_id","contact_email_search");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "app"."outbox_events" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "security_events_expiry_idx" ON "app"."security_events" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "shop_activity_shop_occurred_idx" ON "app"."shop_activity_entries" USING btree ("shop_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_memberships_one_active_admin" ON "app"."shop_memberships" USING btree ("shop_id") WHERE "app"."shop_memberships"."active" and "app"."shop_memberships"."role" = 'admin';
--> statement-breakpoint
ALTER TABLE "app"."jobs" ADD CONSTRAINT "jobs_current_revision_shop_fk" FOREIGN KEY ("shop_id", "current_revision_id") REFERENCES "app"."job_revisions"("shop_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "app"."jobs" ADD CONSTRAINT "jobs_current_proof_shop_fk" FOREIGN KEY ("shop_id", "current_proof_version_id") REFERENCES "app"."proof_versions"("shop_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "app"."artwork_items" ADD CONSTRAINT "artwork_items_current_version_shop_fk" FOREIGN KEY ("shop_id", "current_version_id") REFERENCES "app"."artwork_versions"("shop_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "app"."artwork_items" ADD CONSTRAINT "artwork_items_production_version_shop_fk" FOREIGN KEY ("shop_id", "production_version_id") REFERENCES "app"."artwork_versions"("shop_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "app"."quote_threads" ADD CONSTRAINT "quote_threads_current_revision_shop_fk" FOREIGN KEY ("shop_id", "current_revision_id") REFERENCES "app"."quote_revisions"("shop_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION "app"."reject_immutable_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'immutable table % cannot be changed', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "catalog_version_events_immutable" BEFORE UPDATE OR DELETE ON "app"."catalog_version_events" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "job_revisions_immutable" BEFORE UPDATE OR DELETE ON "app"."job_revisions" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "price_acceptances_immutable" BEFORE UPDATE OR DELETE ON "app"."price_acceptances" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "artwork_versions_immutable" BEFORE UPDATE OR DELETE ON "app"."artwork_versions" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "artwork_review_decisions_immutable" BEFORE UPDATE OR DELETE ON "app"."artwork_review_decisions" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "proof_versions_immutable" BEFORE UPDATE OR DELETE ON "app"."proof_versions" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "proof_artwork_sources_immutable" BEFORE UPDATE OR DELETE ON "app"."proof_artwork_sources" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "proof_decisions_immutable" BEFORE UPDATE OR DELETE ON "app"."proof_decisions" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "quote_lines_immutable" BEFORE UPDATE OR DELETE ON "app"."quote_lines" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "quote_lifecycle_events_immutable" BEFORE UPDATE OR DELETE ON "app"."quote_lifecycle_events" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "quote_responses_immutable" BEFORE UPDATE OR DELETE ON "app"."quote_responses" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "production_exceptions_immutable" BEFORE UPDATE OR DELETE ON "app"."production_exceptions" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "internal_notes_immutable" BEFORE UPDATE OR DELETE ON "app"."internal_notes" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "shop_activity_entries_immutable" BEFORE UPDATE OR DELETE ON "app"."shop_activity_entries" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "order_activity_entries_immutable" BEFORE UPDATE OR DELETE ON "app"."order_activity_entries" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
CREATE TRIGGER "security_events_immutable" BEFORE UPDATE OR DELETE ON "app"."security_events" FOR EACH ROW EXECUTE FUNCTION "app"."reject_immutable_change"();
--> statement-breakpoint
CREATE FUNCTION "app"."enforce_aggregate_pointers"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'jobs' THEN
    IF NEW.current_revision_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM app.job_revisions r WHERE r.shop_id = NEW.shop_id AND r.job_id = NEW.id AND r.id = NEW.current_revision_id
    ) THEN RAISE EXCEPTION 'current revision must belong to the job' USING ERRCODE = '23514'; END IF;
    IF NEW.current_proof_version_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM app.proof_versions p WHERE p.shop_id = NEW.shop_id AND p.job_id = NEW.id AND p.id = NEW.current_proof_version_id
    ) THEN RAISE EXCEPTION 'current proof must belong to the job' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'artwork_items' THEN
    IF NEW.current_version_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM app.artwork_versions v WHERE v.shop_id = NEW.shop_id AND v.artwork_item_id = NEW.id AND v.id = NEW.current_version_id
    ) THEN RAISE EXCEPTION 'current artwork must belong to the item' USING ERRCODE = '23514'; END IF;
    IF NEW.production_version_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM app.artwork_versions v WHERE v.shop_id = NEW.shop_id AND v.artwork_item_id = NEW.id AND v.id = NEW.production_version_id
    ) THEN RAISE EXCEPTION 'production artwork must belong to the item' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'quote_threads' AND NEW.current_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.quote_revisions r WHERE r.shop_id = NEW.shop_id AND r.quote_thread_id = NEW.id AND r.id = NEW.current_revision_id
  ) THEN RAISE EXCEPTION 'current quote must belong to the thread' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "jobs_aggregate_pointers" AFTER INSERT OR UPDATE OF "current_revision_id", "current_proof_version_id" ON "app"."jobs" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "app"."enforce_aggregate_pointers"();
CREATE CONSTRAINT TRIGGER "artwork_items_aggregate_pointers" AFTER INSERT OR UPDATE OF "current_version_id", "production_version_id" ON "app"."artwork_items" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "app"."enforce_aggregate_pointers"();
CREATE CONSTRAINT TRIGGER "quote_threads_aggregate_pointer" AFTER INSERT OR UPDATE OF "current_revision_id" ON "app"."quote_threads" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "app"."enforce_aggregate_pointers"();
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'printflow_app') THEN CREATE ROLE printflow_app NOINHERIT LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'printflow_backup') THEN CREATE ROLE printflow_backup NOINHERIT NOLOGIN; END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "app" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM PUBLIC;
GRANT USAGE ON SCHEMA "app" TO printflow_app, printflow_backup;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA "app" TO printflow_app;
GRANT UPDATE ON "app"."shops", "app"."shop_memberships", "app"."admin_sessions", "app"."order_reference_counters", "app"."order_drafts", "app"."draft_jobs", "app"."upload_sessions", "app"."upload_intents", "app"."stored_objects", "app"."services", "app"."service_versions", "app"."price_rule_versions", "app"."orders", "app"."order_access_grants", "app"."jobs", "app"."artwork_items", "app"."quote_threads", "app"."quote_revisions", "app"."capability_deliveries", "app"."idempotency_records", "app"."outbox_events", "app"."external_effect_attempts", "app"."rate_limit_counters" TO printflow_app;
GRANT SELECT ON ALL TABLES IN SCHEMA "app" TO printflow_backup;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE USAGE ON SCHEMA app FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE USAGE ON SCHEMA app FROM authenticated; END IF;
END;
$$;
