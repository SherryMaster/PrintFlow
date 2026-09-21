# Verify: Shop and order data model · spec 0003 · updated 2026-09-21

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Database and commands

- [x] Run `pnpm check` and expect formatting, lint, types, unit tests, and the production build to pass. → AC-1 through AC-16
- [x] Run `pnpm db:preflight` with the reviewed Supabase migration environment and expect the matching direct endpoint, migration role, CA certificate, and IPv6 connection to pass. Try a pooler URL and a different project URL and expect rejection before database access. → AC-16
- [x] Run `pnpm db:migrate` against the reviewed direct Supabase connection, then inspect the live `app` schema and expect 41 tables, composite shop ownership keys, current pointer constraints, operational indexes, immutable fact protection, and restricted role grants. → AC-1, AC-9, AC-10, AC-14, AC-16
- [x] Connect through the Supabase transaction pooler and complete a multi statement Drizzle transaction. Confirm one module scoped client, at most one connection per process, prepared statements disabled, verified TLS, idle reconnection, and no migration through the pooler. → AC-11, AC-12, AC-16
- [x] Bootstrap the shop twice with the same slug, administrator, and idempotency key. Expect one shop, one active administrator membership, one counter seed, one shop activity entry, and the saved result on retry. Change the request while keeping the key and expect a conflict. → AC-1, AC-11, AC-15
- [x] Change bootstrap input for slug, timezone, currency, reference prefix, quote validity, and rounding rule. Expect each accepted value to come from validated input and persist in `shops.settings`, with `Asia/Karachi` and `PKR` enforced for the pilot. → AC-8, AC-15
- [x] Create an online draft using the configured `SHOP_ID`. Expect a server generated 32 byte capability, a 24 hour expiry from database time, a 500 MB upload quota, only a capability hash in the draft, and an encrypted delivery payload. → AC-1, AC-10, AC-11
- [x] Repeat draft creation with the same high entropy key and identical request. Expect the original capability while its encrypted delivery remains valid. Advance beyond 24 hours or erase the ciphertext and expect an expired result. Change the request and expect a conflict. → AC-10, AC-11, AC-13
- [x] Publish a service and price rule from validated operator input. Expect immutable versioned definitions, append only lifecycle facts, and shop activity. Retire them and confirm a submitted order still reads its original versions and calculation. → AC-2, AC-9
- [x] Add a draft job and vary the published service requirements and explicit recorded override. Expect quote, artwork, and proof requirements to come only from those sources. Reject an unpublished or cross shop version. → AC-1, AC-2, AC-11
- [x] Submit online orders immediately before and after Lahore New Year. Expect `{prefix}-{year}-{sequence}` from the shop prefix, database time in the shop timezone, and the locked six digit counter. Concurrent submissions must receive different references. → AC-7, AC-8, AC-11
- [x] Submit online, walk in, and phone orders with varied contact input. Expect name and phone for all sources, email for online orders, normalized search values, and the entered display values. Reject invalid or ambiguous phone numbers. → AC-7, AC-8
- [x] Submit one standard job and expect its exact service version, price rule version, configuration, measurements, requirements, calculation components, currency, tax, and rounded total to remain immutable. Change the catalog later and expect no historical change. → AC-2, AC-8, AC-9
- [x] Submit one assisted order without email and expect no guest grant. Submit one online order and expect a pending grant plus encrypted confirmation delivery. Confirm that guest access becomes active only after accepted delivery. → AC-7, AC-10, AC-12
- [x] Calculate money above `Number.MAX_SAFE_INTEGER` through SQL, raw SQL, JSON snapshots, command fingerprints, and API safe output. Expect exact decimal paisa strings with no floating point loss or native JSON `bigint` failure. → AC-2, AC-8, AC-11, AC-16
- [x] Convert equal measurements entered in millimetres, centimetres, inches, and feet. Expect exact normalized decimal millimetres while retaining each entered value and unit. → AC-8
- [x] Use amounts immediately below, at, and above half a rupee. Expect positive half values to round up, each final job total to round once, and every final total to be a multiple of 100 paisa. → AC-4, AC-8
- [x] Read an order with requested Lahore dates and confirmed UTC times. Expect the requested date to retain the shop calendar value and the confirmed time to render through `shops.timezone`. → AC-8
- [x] Create several active jobs at different workflow states. Expect order progress from the least advanced active job, blockers listed separately, known totals summed from current facts, and quoted jobs without accepted current prices listed as unknown rather than zero. → AC-3, AC-6, AC-8
- [x] Move a job through every valid forward transition and one reasoned adjacent reversal. Attempt a skipped state, an unreasoned reversal, work after a terminal state, and production with a current blocker. Expect typed rejection and unchanged versions. → AC-6, AC-11
- [x] Cancel the final active job and expect the order to cancel in the same transaction. Cancel a whole order and expect all active jobs, terminal activity, and outbox intent to commit together. → AC-3, AC-6, AC-9, AC-12
- [x] Collect an order with every active job ready and no blocker. Expect collection to succeed once. Add a pending price, artwork, proof, scan, or production hold and expect collection to fail. → AC-3, AC-5, AC-6, AC-11
- [x] Revise a job and vary configuration and measurement input. Expect a new immutable revision, normalized measurements, stale earlier commercial and proof facts, a production hold, and incremented order and job versions. → AC-2, AC-5, AC-6, AC-11
- [x] Send a complete quote covering every active current quoted job revision. Vary its explicit deadline and the shop default validity days and expect the correct source. Attempt partial coverage and expect rejection. → AC-4, AC-11
- [x] Allocate positive and negative quote adjustments across several jobs, including equal subtotals and all zero subtotals. Expect proportional allocation, remainder order by job line number, one rounding per job, and quote total equal to the rounded job totals. → AC-4, AC-8
- [x] Accept the current sent quote before its database deadline. Expect the response actor and channel from the guest grant and contact snapshot, or from the assisted customer snapshot and recorder membership. Retry identically and expect the saved fact. Send conflicting concurrent responses and expect one effective fact. → AC-4, AC-9, AC-11
- [x] Supersede, expire, revise a covered job, or cancel a covered job after quote acceptance. Expect the prior response to stay historical while every active quoted job returns to unknown price until a complete replacement is accepted. → AC-3, AC-4, AC-9
- [x] Add a valid numbered correction to a price acceptance, artwork review, proof decision, or quote response. Expect the original fact to remain, the correction to name the prior effective fact, and the highest valid sequence to control current behavior. → AC-9, AC-11
- [x] Create draft and order upload sessions through the correct capability, guest scope, or administrator membership. Expect owner, purpose, 24 hour expiry, 250 MB file limit, 500 MB session limit, and byte reservations from the authorized aggregate and fixed limits. → AC-1, AC-10, AC-11
- [x] Complete an upload using authoritative R2 size, media type, ETag, checksum, and signature bytes. Expect one immutable accepted object under a server chosen final key. Reuse the intent, exceed the reservation, fail validation, or fail a required scan and expect rejection without replacing an accepted object. → AC-5, AC-10, AC-11
- [x] Attach artwork to the exact order job, replace it, review the exact current version, and select production artwork. Attempt a cross order attachment and expect rejection. Expect replacement to stale an earlier proof and set a production hold. → AC-1, AC-5, AC-6, AC-11
- [x] Create a proof from the exact current job revision and complete current artwork source set. Expect the new proof pointer to change in the same transaction. Revise the job or replace a source and expect the proof and decision to become stale. → AC-5, AC-6, AC-11
- [x] Clear a production hold using the exact current revision, artwork versions, proof, decisions, administrator reason, and expected versions. Omit one requirement or leave validation or scanning pending and expect rejection. Confirm a production exception can bypass only an exact proof approval blocker. → AC-5, AC-6, AC-9, AC-11
- [x] Present active, grace, expired, revoked, wrong scope, and unknown guest tokens. Expect only token hashes in storage, narrow order context for valid tokens, unchanged expiry after use, and the same generic denial for every invalid case. → AC-10
- [x] Rotate an active grant and simulate accepted and failed email delivery. Expect a pending replacement, activation only after accepted delivery, a 15 minute grace period for the prior token, and no disruption to the current grant after failed delivery. → AC-10, AC-12
- [x] Read the same order as administrator and guest. Expect administrator private fields only in the administrator projection. Expect the guest projection to include customer visible configuration, prices, due information, progress, blockers, messages, and visible activity, with no internal notes, administrator identities, security events, outbox data, private keys, or unrelated contact data. → AC-1, AC-10
- [x] Request a private file through an authorized exact order and file context. Expect a five minute signed URL only for an accepted object. Reject quarantine, failed validation, a failed required scan, cross order ownership, or erased bytes. → AC-5, AC-10
- [x] Commit a mutation that needs background work and crash after commit. Expect its outbox row in the same transaction and one stable event identifier. Crash after claim, let the five minute lease expire, reclaim it with a higher fence, and reject completion from the stale worker. → AC-11, AC-12
- [x] Simulate a provider accepting an effect while its response is lost. Expect an `uncertain` attempt, reconciliation through the provider using the stable outbox identifier, and no second logical effect. Exercise the fixed retry schedule through dead state. → AC-12
- [x] Vary an event type and expect its strict versioned Zod payload schema, active template version, and customer visibility from the exhaustive event registry. Add an unknown field or private contact value and expect rejection. → AC-9, AC-10, AC-12
- [x] Record bootstrap, catalog, order, and unresolved authorization actions. Expect shop actions in shop activity, order actions in order activity, and unresolved failures in privacy safe security events, all with actor snapshots and no raw tokens or contact data in generic JSON or logs. → AC-9, AC-10
- [x] Advance database time 90 days after collection or cancellation. Expect eligible file bytes to be deleted without affecting active orders. Advance 24 months and expect contact values and original filenames erased while anonymous history remains readable. → AC-13
- [x] Retain completed idempotency records for 30 days, reclaim a five minute processing lease only for the same canonical request fingerprint, and reject a changed payload using the same key. → AC-11, AC-12, AC-13
- [x] Load five years at 100 orders per day, with the agreed average and maximum jobs and artwork versions. Run representative reference, due queue, contact, order, and activity queries and expect bounded reads using the intended indexes without partitioning. → AC-14

## Acceptance criteria coverage

- AC-1 is covered by live schema inspection, bootstrap, catalog, draft, order, upload, artwork, grant, and projection checks.
- AC-2 is covered by immutable job snapshots, catalog change, numeric, and standard price checks.
- AC-3 is covered by multi job progress, totals, cancellation, and collection checks.
- AC-4 is covered by complete quote, adjustment, concurrency, expiry, and invalidation checks.
- AC-5 is covered by upload, artwork, proof, file delivery, and production hold checks.
- AC-6 is covered by job transition, reversal, blocker, hold, cancellation, and collection checks.
- AC-7 is covered by contact, reference, online grant, and assisted order checks.
- AC-8 is covered by money, measurement, timezone, quote allocation, and rounding checks.
- AC-9 is covered by immutable history, corrections, activity, and registry checks.
- AC-10 is covered by role grants, token, projection, file access, security event, and privacy checks.
- AC-11 is covered by idempotency, expected versions, cross shop rejection, concurrency, and typed failure checks.
- AC-12 is covered by transactional outbox, lease fencing, recovery, retry, and uncertain effect checks.
- AC-13 is covered by byte deletion, private value erasure, permanent history, and retention schedule checks.
- AC-14 is covered by the five year capacity data and representative query plan checks.
- AC-15 is covered by validated and idempotent shop bootstrap checks.
- AC-16 is covered by exact dependencies, endpoint preflight, TLS, migration, pooler, connection reuse, and numeric round trip checks.

## Runtime evidence

- `pnpm check` passed formatting, lint, type checking, 33 unit tests, and the production build.
- `pnpm db:review`, `pnpm db:check`, `pnpm db:preflight`, and `pnpm db:migrate` passed against the reviewed Supabase environment.
- `RUN_DATABASE_TESTS=1 pnpm exec vitest run --silent=true src/db/integration.test.ts src/db/operations.integration.test.ts` passed 7 live database tests through the runtime pooler.
- The direct connection capacity proof passed one five year fixture test with 182,500 orders, 365,000 jobs, 730,000 artwork versions, and representative indexed plans. The fixture transaction rolled back.
- The live schema audit found 41 business tables, 71 foreign keys, 128 indexes, all required operational indexes, five deferred current pointer constraints, enabled immutable fact triggers, and restricted runtime grants.
- The running app returned `GET / 200` at `http://localhost:3000/` and rendered the PrintFlow scaffold page.
