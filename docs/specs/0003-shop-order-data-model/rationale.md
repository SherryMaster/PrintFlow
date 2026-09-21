# 0003. Shop and order data model rationale

## Context

PrintFlow must preserve the exact work a customer submitted while the shop continues changing services, prices, files, quotes, and production state. The pilot combines standard and custom jobs in one order, supports guests and assisted customers, and must keep current work easy to query without losing the history behind it.

The domain is relational and transactional. An order contains several jobs, each job may have several commercial and artwork revisions, and customer decisions must point to the exact version they accepted. Contact data and artwork are private. External email and file work can fail after a business transaction commits.

The first shop is small, but shop ownership cannot be added later without rewriting every relationship. The agreed model targets up to 100 orders per day, 20 jobs per order, 20 artwork versions per job, and five years of order history. This does not justify table partitioning, event sourcing, a separate search service, or a second database.

## Options considered

### Option 1: Versioned relational aggregates with current projections

Postgres stores normalized ownership and relationships. Submitted facts become immutable revisions, while orders and jobs keep narrow current pointers and states for operational reads.

**Pros**:

1. Database constraints protect relationships and shop isolation.
2. Historical prices, files, and decisions remain exact.
3. Current queue queries do not require replaying history.

**Cons**:

1. Revisions, pointers, and composite foreign keys create more schema and transaction work.
2. Some domain changes require coordinated writes across several tables.

### Option 2: Mutable records with an activity log

Orders, jobs, quotes, and file pointers remain editable. A general activity table records what the application says changed.

**Pros**:

1. Fewer tables and simpler basic create and update code.
2. Current rows are easy to read.

**Cons**:

1. The activity log cannot prove the exact configuration, price, or file that a customer accepted if application code misses a snapshot.
2. Catalog edits and concurrent updates can silently rewrite historical meaning.

### Option 3: Event sourced domain model

Every change is an event. Current orders and jobs are rebuilt into projections from those events.

**Pros**:

1. Complete event history is the primary record.
2. New projections can be created later from past events.

**Cons**:

1. Replay, event evolution, projection repair, and operational tooling are disproportionate for one shop.
2. Relational reporting and corrective workflows become harder for the current team.

### Option 4: Document centered order snapshots

Each order stores most jobs, configurations, quotes, files, and decisions inside JSON documents.

**Pros**:

1. A complete order can be loaded with few joins.
2. Diverse service configuration fits naturally inside documents.

**Cons**:

1. Cross record constraints, precise version references, and shop safe relationships weaken.
2. Queue filters, reporting, and partial updates become harder as documents grow.

### PostgreSQL driver option A: Postgres.js

Use the `postgres` package through Drizzle's Postgres.js adapter. Configure one connection per warm Vercel process and disable prepared statements for the Supabase transaction pooler.

**Pros**:

1. Drizzle and Supabase both document this combination directly.
2. One package provides typed parameter handling, transactions, pooling, and explicit SQL without a separate type package.
3. Its `max` and `prepare` settings map directly to the runtime limits.

**Cons**:

1. Prepared statements are enabled by default, so a missed setting can fail under transaction pooling.
2. Postgres.js type conversion differs from `node-postgres`, so a later driver swap would require value boundary tests.

### PostgreSQL driver option B: node-postgres

Use `pg` through Drizzle's node Postgres adapter and install `@types/pg` for TypeScript declarations.

**Pros**:

1. It is mature, widely used, and supported directly by Drizzle.
2. It offers per query type parsers and an optional native extension.

**Cons**:

1. It needs an additional type package and more pool configuration for this small serverless application.
2. Supabase's current serverless connection example maps more directly to Postgres.js settings.

## Rationale

Option 1 fits the strongest forces. PrintFlow needs exact commercial and artwork history, but its daily work also needs ordinary indexed queries. Immutable revisions protect customer commitments, while current projections avoid the operational cost of replaying an event stream.

Postgres transactions keep a business change, activity entry, idempotency result, and outbox intent consistent. Direct shop ownership on every record costs some repetition, but prevents the far more expensive future migration that appears when tenant ownership is inferred only through long relationship chains.

Validated JSONB is limited to shapes that genuinely vary across print services, such as configuration definitions and calculation snapshots. Stable identity, money, state, ownership, and decisions remain relational. A fully normalized option model was the runner up for catalog data, but it would create many sparse tables before the real rate cards are known.

The model deliberately does not store normal order totals or progress. Those values are cheap to derive at the agreed scale, and a second mutable copy would drift. The outbox is stored because it is not a cache. It is the committed intent for an external effect and is required to recover after a crash.

Immutable content is separate from operational lifecycle. A sent quote or published catalog definition never changes, while append only events and narrow current projections record expiry, supersession, acceptance, decline, and retirement. This keeps historical meaning exact without forcing ordinary queue reads to replay every event.

The order is the concurrency boundary because job revisions, quotes, artwork, blockers, readiness, and collection affect one another. Locking the order first costs some write concurrency inside one customer order, but the pilot does not need parallel writes to the same order more than it needs coherent decisions. Upload sessions and catalog publication keep their own narrower locks because they exist before or outside an order.

Postgres.js is the driver choice because the application already uses Drizzle, runs on Vercel functions, and connects to Supabase transaction pooling. Its explicit connection limit, prepared statement, timeout, and TLS settings match that environment without another abstraction. `node-postgres` is the runner up and would also work, but it adds configuration and a separate type package without solving a PrintFlow requirement that Postgres.js misses.

Pinning `postgres@3.4.9`, `drizzle-orm@0.45.2`, and `drizzle-kit@0.31.10` makes the first database build repeatable as one tested adapter set. The lockfile records their full dependency graphs. Later upgrades must repeat numeric round trips, pooled transactions, idle reconnection, unknown commit recovery, and direct migration checks. Verified TLS and a true direct migration endpoint add certificate and IPv6 setup, but they avoid silently treating encryption without identity checking or a session pooler as the stronger connection contract.
