ALTER TABLE "app"."artwork_review_decisions" ADD CONSTRAINT "artwork_review_decisions_sequence_positive" CHECK ("app"."artwork_review_decisions"."sequence_number" > 0);--> statement-breakpoint
ALTER TABLE "app"."order_access_grants" ADD CONSTRAINT "order_access_grants_scopes_valid" CHECK (cardinality("app"."order_access_grants"."scopes") > 0 and "app"."order_access_grants"."scopes" <@ array['order:read', 'artwork:upload', 'quote:respond', 'proof:respond', 'link:rotate']::text[]);--> statement-breakpoint
ALTER TABLE "app"."proof_decisions" ADD CONSTRAINT "proof_decisions_sequence_positive" CHECK ("app"."proof_decisions"."sequence_number" > 0);
--> statement-breakpoint
CREATE FUNCTION "app"."enforce_artwork_proof_aggregate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'artwork_review_decisions' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM app.artwork_versions version
      JOIN app.artwork_items item
        ON item.shop_id = version.shop_id
       AND item.id = version.artwork_item_id
      WHERE version.shop_id = NEW.shop_id
        AND version.id = NEW.artwork_version_id
        AND item.job_id = NEW.job_id
    ) THEN
      RAISE EXCEPTION 'artwork review target must belong to the job' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'proof_versions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM app.job_revisions revision
      WHERE revision.shop_id = NEW.shop_id
        AND revision.id = NEW.job_revision_id
        AND revision.job_id = NEW.job_id
    ) OR NOT EXISTS (
      SELECT 1
      FROM app.stored_objects object
      JOIN app.upload_intents intent
        ON intent.shop_id = object.shop_id
       AND intent.id = object.upload_intent_id
      JOIN app.upload_sessions session
        ON session.shop_id = intent.shop_id
       AND session.id = intent.upload_session_id
      JOIN app.jobs job
        ON job.shop_id = session.shop_id
       AND job.order_id = session.order_id
       AND job.id = session.job_id
      WHERE object.shop_id = NEW.shop_id
        AND object.id = NEW.stored_object_id
        AND session.purpose = 'proof'
        AND job.id = NEW.job_id
    ) THEN
      RAISE EXCEPTION 'proof revision and object must belong to the job' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'proof_artwork_sources' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM app.proof_versions proof
      JOIN app.artwork_versions version ON version.shop_id = proof.shop_id
      JOIN app.artwork_items item
        ON item.shop_id = version.shop_id
       AND item.id = version.artwork_item_id
      WHERE proof.shop_id = NEW.shop_id
        AND proof.id = NEW.proof_version_id
        AND version.id = NEW.artwork_version_id
        AND item.job_id = proof.job_id
    ) THEN
      RAISE EXCEPTION 'proof artwork source must belong to the proof job' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "artwork_review_decisions_aggregate"
AFTER INSERT ON "app"."artwork_review_decisions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."enforce_artwork_proof_aggregate"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "proof_versions_aggregate"
AFTER INSERT ON "app"."proof_versions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."enforce_artwork_proof_aggregate"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "proof_artwork_sources_aggregate"
AFTER INSERT ON "app"."proof_artwork_sources"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."enforce_artwork_proof_aggregate"();
