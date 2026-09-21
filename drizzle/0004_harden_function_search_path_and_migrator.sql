DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'printflow_migrator'
  ) THEN
    CREATE ROLE printflow_migrator NOINHERIT LOGIN;
  END IF;
END;
$$;--> statement-breakpoint

GRANT printflow_migrator TO postgres;--> statement-breakpoint

ALTER FUNCTION app.reject_immutable_change() SET search_path = pg_catalog, app;--> statement-breakpoint
ALTER FUNCTION app.enforce_aggregate_pointers() SET search_path = pg_catalog, app;--> statement-breakpoint
ALTER FUNCTION app.enforce_artwork_proof_aggregate() SET search_path = pg_catalog, app;--> statement-breakpoint
ALTER FUNCTION app.reject_security_event_change() SET search_path = pg_catalog, app;--> statement-breakpoint

ALTER SCHEMA app OWNER TO printflow_migrator;--> statement-breakpoint

DO $$
DECLARE
  object_name text;
BEGIN
  FOR object_name IN
    SELECT quote_ident(tablename)
    FROM pg_tables
    WHERE schemaname = 'app'
  LOOP
    EXECUTE format('ALTER TABLE app.%s OWNER TO printflow_migrator', object_name);
  END LOOP;
END;
$$;--> statement-breakpoint

DO $$
DECLARE
  object_identity text;
BEGIN
  FOR object_identity IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app'
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO printflow_migrator', object_identity);
  END LOOP;
END;
$$;--> statement-breakpoint

DO $$
DECLARE
  type_name text;
BEGIN
  FOR type_name IN
    SELECT quote_ident(t.typname)
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app'
      AND t.typtype = 'e'
  LOOP
    EXECUTE format('ALTER TYPE app.%s OWNER TO printflow_migrator', type_name);
  END LOOP;
END;
$$;--> statement-breakpoint

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT, CREATE ON DATABASE %I TO printflow_migrator',
    current_database()
  );
END;
$$;
