import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve("drizzle");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sql = (
  await Promise.all(
    migrationFiles.map((name) =>
      readFile(resolve(migrationDirectory, name), "utf8"),
    ),
  )
).join("\n");

const requiredPatterns = [
  /REVOKE ALL ON SCHEMA "app" FROM PUBLIC/,
  /REVOKE USAGE ON SCHEMA app FROM anon/,
  /REVOKE USAGE ON SCHEMA app FROM authenticated/,
  /CREATE TRIGGER "job_revisions_immutable"/,
  /CREATE TRIGGER "quote_responses_immutable"/,
  /CREATE TRIGGER "order_activity_entries_immutable"/,
  /CREATE TRIGGER "security_events_immutable"/,
  /security events are immutable until retention expiry/,
  /GRANT UPDATE \("display_label", "stable_identity", "display_erased_at"\)/,
  /GRANT DELETE ON "app"\."idempotency_records", "app"\."security_events", "app"\."rate_limit_counters"/,
  /CREATE INDEX "outbox_events_claim_idx"/,
  /CREATE INDEX "orders_terminal_retention_idx"/,
  /CREATE INDEX "external_effect_attempts_reconcile_idx"/,
  /CREATE ROLE printflow_migrator NOINHERIT LOGIN/,
  /GRANT printflow_migrator TO postgres/,
  /GRANT CONNECT, CREATE ON DATABASE %I TO printflow_migrator/,
  /ALTER SCHEMA app OWNER TO printflow_migrator/,
  /ALTER FUNCTION app\.reject_immutable_change\(\) SET search_path = pg_catalog, app/,
];

const missing = requiredPatterns.filter((pattern) => !pattern.test(sql));
if (missing.length > 0) {
  throw new Error(
    `Migration review failed, missing ${missing.map(String).join(", ")}`,
  );
}

process.stdout.write(
  `Reviewed ${migrationFiles.length} migrations for private schema grants, repeatable migrator access, immutable history, retention permissions, and operational indexes\n`,
);
