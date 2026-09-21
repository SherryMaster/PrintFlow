ALTER TABLE "app"."upload_sessions" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "app"."jobs" ADD CONSTRAINT "jobs_shop_order_id_id_unique" UNIQUE("shop_id","order_id","id");--> statement-breakpoint
ALTER TABLE "app"."order_access_grants" ADD CONSTRAINT "order_access_grants_shop_order_id_id_unique" UNIQUE("shop_id","order_id","id");--> statement-breakpoint
ALTER TABLE "app"."proof_versions" ADD CONSTRAINT "proof_versions_stored_object_id_unique" UNIQUE("stored_object_id");--> statement-breakpoint
ALTER TABLE "app"."artwork_review_decisions" ADD CONSTRAINT "artwork_review_decisions_shop_id_actor_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","actor_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_decisions" ADD CONSTRAINT "proof_decisions_shop_id_customer_actor_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","customer_actor_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_decisions" ADD CONSTRAINT "proof_decisions_shop_id_recorded_by_membership_id_shop_memberships_shop_id_id_fk" FOREIGN KEY ("shop_id","recorded_by_membership_id") REFERENCES "app"."shop_memberships"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."proof_versions" ADD CONSTRAINT "proof_versions_shop_id_creator_snapshot_id_actor_snapshots_shop_id_id_fk" FOREIGN KEY ("shop_id","creator_snapshot_id") REFERENCES "app"."actor_snapshots"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_shop_id_order_draft_id_order_drafts_shop_id_id_fk" FOREIGN KEY ("shop_id","order_draft_id") REFERENCES "app"."order_drafts"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_shop_id_order_id_orders_shop_id_id_fk" FOREIGN KEY ("shop_id","order_id") REFERENCES "app"."orders"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_shop_id_order_id_job_id_jobs_shop_id_order_id_id_fk" FOREIGN KEY ("shop_id","order_id","job_id") REFERENCES "app"."jobs"("shop_id","order_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_shop_id_order_id_authorizing_grant_id_order_access_grants_shop_id_order_id_id_fk" FOREIGN KEY ("shop_id","order_id","authorizing_grant_id") REFERENCES "app"."order_access_grants"("shop_id","order_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_shop_id_authorizing_membership_id_shop_memberships_shop_id_id_fk" FOREIGN KEY ("shop_id","authorizing_membership_id") REFERENCES "app"."shop_memberships"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."upload_sessions" ADD CONSTRAINT "upload_sessions_owner_shape" CHECK ((
        "app"."upload_sessions"."owner_type" = 'draft'
        and "app"."upload_sessions"."order_draft_id" is not null
        and "app"."upload_sessions"."order_id" is null
        and "app"."upload_sessions"."job_id" is null
        and "app"."upload_sessions"."purpose" is null
        and "app"."upload_sessions"."capability_hash" is not null
        and "app"."upload_sessions"."authorizing_grant_id" is null
        and "app"."upload_sessions"."authorizing_membership_id" is null
      ) or (
        "app"."upload_sessions"."owner_type" = 'order'
        and "app"."upload_sessions"."order_draft_id" is null
        and "app"."upload_sessions"."order_id" is not null
        and "app"."upload_sessions"."job_id" is not null
        and "app"."upload_sessions"."purpose" in ('artwork', 'proof')
        and "app"."upload_sessions"."capability_hash" is null
        and num_nonnulls("app"."upload_sessions"."authorizing_grant_id", "app"."upload_sessions"."authorizing_membership_id") = 1
      ));
