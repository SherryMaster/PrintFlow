# 0001. Stack and architecture

**Date**: 2026-09-17
**Status**: Accepted

## Summary

PrintFlow will be one TypeScript web application with clear internal modules. Next.js runs the customer and admin pages, Supabase provides Postgres and admin identity, Cloudflare R2 stores private artwork, and managed services handle email, background work, and monitoring. This keeps the one shop pilot small while leaving clear seams for later shops, accounts, and payments.

## Decision

**Chosen option**: Option 1: Managed TypeScript modular monolith

Build one deployable Next.js application. Keep domain modules separate inside `src`, and keep database, files, email, and background work behind server only service boundaries. (basis: `docs/scope/scope.md`, monolith first, [Next.js App Router](https://nextjs.org/docs/app))

**Implementation skills**: `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`) · `drizzle` (`bobmatnyc/claude-mpm-skills`, `.agents/skills/drizzle/`) · `cloudflare-r2` (`secondsky/claude-skills`, `.agents/skills/cloudflare-r2/`) · `inngest-setup` (`inngest/inngest-skills`, `.agents/skills/inngest-setup/`) · `inngest-durable-functions` (`inngest/inngest-skills`, `.agents/skills/inngest-durable-functions/`) · `zod` (`pproenca/dot-skills`, `.agents/skills/zod/`) · `react-hook-form` (`pproenca/dot-skills`, `.agents/skills/react-hook-form/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `react-testing-library` (`itechmeat/llm-code`, `.agents/skills/react-testing-library/`) · `github-actions-templates` (`wshobson/agents`, `.agents/skills/github-actions-templates/`) · `sentry-sdk-setup` (`getsentry/sentry-for-ai`, `.agents/skills/sentry-sdk-setup/`) · `typescript-advanced-types` (`wshobson/agents`, `.agents/skills/typescript-advanced-types/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.agents/skills/tailwind-css-patterns/`)

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Product shape | Responsive customer and admin web app | One web app covers the pilot without native mobile or a public API. |
| Architecture | Modular monolith in one repository | One deployable unit is simplest for a small team, while domain modules keep future extraction possible. |
| Language | TypeScript in strict mode | Shared types reduce drift across forms, server actions, jobs, and database records. |
| Runtime and package manager | Current supported Node.js release and pnpm with a committed lockfile | This is the direct Next.js path and gives reproducible dependency installs. |
| Framework | Current stable Next.js App Router | Server Components, Server Actions, and Route Handlers cover public, guest, and admin surfaces in one framework. |
| User interface | Tailwind CSS and shadcn/ui | The project owns its components while starting from accessible primitives. |
| Forms and validation | React Hook Form for complex forms, native forms for simple actions, and Zod at server boundaries | Complex print configuration needs good field state, while all trusted validation remains on the server. |
| Primary database | Supabase Postgres | The domain is relational and needs transactions, constraints, reporting, and future shop ownership. (basis: relational database default, [Supabase Auth](https://supabase.com/docs/guides/auth)) |
| Data access | Drizzle ORM for routine work, SQL for complex reporting, and versioned SQL migrations | Drizzle keeps types close to SQL without hiding database behavior. (basis: ORM for CRUD and SQL for complexity, [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)) |
| Admin identity | Supabase Auth with email and password, recovery email, and optional TOTP | A managed identity service avoids custom authentication and supports future staff identities. |
| Guest identity | Random private order token, with only its SHA 256 hash retained after delivery | Guests need private access without an account, and the shop needs safe delivery, rotation, and revocation. |
| File storage | Private Cloudflare R2 bucket with direct presigned uploads | R2 supports large files, S3 compatible access, 10 GB of current free storage, and free direct egress. (basis: object storage for files, [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)) |
| Email | Resend with React Email templates in the repository | Email content stays versioned with the application and uses a focused transactional provider. (basis: [Resend API](https://resend.com/docs/api-reference/introduction)) |
| Background work | Postgres outbox plus Inngest durable functions | The outbox records intent with the business transaction, while Inngest provides retries and execution visibility. (basis: transactional outbox, [Inngest Functions](https://www.inngest.com/docs/learn/inngest-functions)) |
| Data loading | Server Components by default with targeted revalidation | Database access stays on the server and the pilot avoids a second general purpose client cache. |
| Live updates | Refresh and light polling for active order pages | Status changes are infrequent, so persistent realtime connections add no useful value yet. |
| Hosting | Vercel previews and Vercel Pro for the commercial pilot | This is the lowest friction Next.js deployment, but commercial use requires a paid plan. (basis: [Vercel plan rules](https://vercel.com/docs/plans/hobby)) |
| Observability | Structured Vercel logs plus Sentry errors and traces | Logs retain request context while Sentry groups failures into actionable incidents. (basis: observability from day one, [Vercel Observability](https://vercel.com/docs/observability)) |
| Tests | Vitest, Testing Library, and Playwright | Fast logic tests cover rules, component tests cover behavior, and browser tests prove real customer and admin journeys. (basis: test pyramid, [Playwright](https://playwright.dev/docs/intro)) |
| Delivery | GitHub Actions checks, Vercel previews, and reviewed production promotion | Pull requests get repeatable checks and a real preview before release. |

## Architecture boundaries

### Application modules

Use one application under `src`. Organize business code by domain, such as `shop`, `catalog`, `orders`, `pricing`, `artwork`, `identity`, and `notifications`. Each module exposes an application service. Pages, Server Actions, Route Handlers, and jobs call those services instead of querying another module's tables directly.

Shared code is limited to database setup, configuration, UI primitives, observability, and small cross domain types. A module is not a separate deployed service. A service can be extracted later only when measured load or team ownership requires it.

### Request and data flow

1. Server Components read through application services.
2. Server Actions handle application forms and mutations.
3. Route Handlers handle presigned uploads, provider webhooks, recovery links, and any explicit HTTP interface.
4. Zod validates untrusted input. Application services enforce authorization and business rules. Postgres constraints protect final invariants.
5. Only server code uses Drizzle or privileged provider credentials. Browser code never receives database, R2, Resend, Inngest, or backup secrets. Keep business tables in a private Postgres schema. Revoke Data API access from browser roles, and connect the application with a constrained server role. Migration and backup roles remain separate and more privileged.

All private guest and admin reads are dynamic and uncached. Every application service entry point performs its own authorization check. A page or Route Handler cannot rely on an earlier middleware check as its only protection.

Application services share one explicit transaction context. A service can join its caller's transaction, which allows an order change and its outbox record to commit together without crossing module boundaries incorrectly.

### Shop ownership

The detailed schema belongs to the shop and order data model spec. Its foundation is fixed here. One seeded shop exists in V1, and every shop owned record carries `shop_id` from its first migration. Every query resolves the current shop on the server. There is no shop registration, tenant switcher, or platform admin in V1.

### Admin and guest access

The admin uses Supabase Auth through the supported server cookie flow. Public signup is disabled. An operator provisions the first identity through a reviewed setup script, then creates its shop membership in the same setup procedure.

The application stores the session in secure, HTTP only cookies. A server side admin session record binds the Supabase session identifier to the shop membership and fixes the original sign in time. The application requires a fresh sign in after seven days even when Supabase refreshes its access token. Logout, password recovery, membership removal, and operator revocation invalidate the application session. TOTP is available but not mandatory. Every admin action checks the authenticated identity, active application session, and configured shop membership on the server.

An online order receives a random 32 byte token. Store its SHA 256 hash with the order access record. The raw token exists only in memory and as an encrypted outbox payload while its email is pending. Erase the encrypted payload when Resend accepts the message or after 24 hours. The access record never stores the raw token.

The token remains valid while the order is active and expires 90 days after collection or cancellation. An admin can revoke or rotate it at any time. Recovery requires the order reference and original email, always returns a neutral response, and applies rate limits. Recovery creates a pending replacement token while leaving the current token valid. When Resend accepts the recovery email, activate the replacement and expire the old token after a 15 minute grace period. If delivery is not accepted, delete the pending replacement and keep the current token valid.

Cloudflare Turnstile protects draft creation, order submission, and upload authorization. Shared rate counters live in Postgres. Reads ignore counters after `expires_at`, and a daily job deletes expired rows. They use the guest token hash, admin identity, order recovery identity hash, or an HMAC of the platform verified client IP, never the raw private token or raw IP address. Ignore client supplied forwarding headers. Authorization never relies on Turnstile alone. (basis: least privilege and server only secrets)

Apply these initial limits. Draft creation allows 5 attempts per IP each hour. Order submission allows 5 attempts per draft and 10 attempts per IP each hour. Upload authorization allows 20 attempts per draft each hour and never exceeds the reserved 500 MB order quota. Link recovery allows 5 attempts per IP each hour and 3 attempts per order and email identity each day. Guest reads allow 120 requests per token and 300 requests per IP each minute. Later feature specs may lower a limit but cannot remove it without revising this decision.

### Artwork handling

Before an order exists, the server creates a draft upload session bound to the configured shop. The browser receives a random capability whose hash is stored with the draft. The draft expires after 24 hours, accepts at most 250 MB per file and 500 MB in total, and tracks reserved bytes transactionally before issuing an upload URL. A daily cleanup removes expired drafts, unused reservations, rejected objects, and abandoned multipart uploads.

The server validates the draft capability and creates a presigned upload that expires after 15 minutes. The browser sends bytes directly to a unique key in a private R2 quarantine prefix. An upload intent can complete once. Reusing an unexpired URL can alter only the quarantine object and can never alter an accepted object.

After upload, a bounded job reads authoritative R2 metadata and the required signature bytes. It rejects and deletes files whose measured size exceeds the reservation or whose signature fails the format allowlist defined by the artwork feature spec. For a valid file, the server conditionally copies the exact quarantined object to a fresh server only key, persists that final key, ETag, measured size, and content type, then deletes the quarantine object. Order submission atomically attaches only these immutable accepted object records to the new order.

Files are never executed. Admin downloads use attachment disposition. A browser preview is optional and never replaces the original file. Automated malware scanning is deferred until the pilot has a budget, so every file remains untrusted even after validation. File validation must stay within bounded metadata and signature reads. Expensive transformation requires a later container worker decision.

File bytes remain for 90 days after collection or cancellation, then a scheduled job deletes them. Active order files are not deleted by retention work. Keep customer contact details and original filenames for 24 months after collection or cancellation, then erase them. Keep the order reference, configuration, price snapshot, status history, timestamps, and anonymous file size and format metadata as the permanent operating record.

### Reliable background work

A business transaction that needs email or file processing writes an outbox row in the same Postgres transaction. A scheduled Inngest dispatcher runs each minute, scans committed pending rows, and claims at most 100 rows with `FOR UPDATE SKIP LOCKED`. A claim has a five minute lease. An expired lease returns to pending automatically.

The outbox UUID is the event and effect idempotency key. A consumer records each attempted external effect before calling its provider, passes the same key when the provider supports idempotency, and reconciles an uncertain result before trying the effect again. A crash after a provider accepts work cannot silently create a second logical email or file operation. Retry transient failures with exponential delay for at most eight attempts across 24 hours. A permanent failure or exhausted retry becomes `dead`, stays visible to the admin, and alerts the operator.

### Environments and releases

Use local Supabase for development, one hosted Supabase project for shared previews, and one for production. Vercel keeps local, preview, and production variables separate. Choose concrete matching South Asia regions during provisioning and record them in project guidance. R2 manages object placement.

Preview uses separate R2 buckets, an Inngest nonproduction environment, a Sentry preview environment, and separate callback URLs and keys. Resend preview delivery is restricted to approved test recipients. Privileged preview secrets never run for untrusted fork pull requests. The shared preview database supports one migration line at a time. GitHub Actions serializes preview migrations, and simultaneous previews that need incompatible schemas are unsupported.

GitHub Actions runs formatting, linting, type checks, unit tests, component tests, the production build, and the selected Playwright smoke journey. Pull requests receive Vercel previews. Reviewed, backward compatible migrations run in GitHub Actions before the matching production deployment is promoted. Promote the application only after migration and smoke checks succeed. The application never runs migrations at startup. A failed application promotion leaves a backward compatible schema in place and is retried or rolled forward.

Use free plans during private development. Move Vercel to Pro before the shop starts commercial use. Provider limits and terms must be checked again at launch.

### Recovery and operations

A trusted scheduled GitHub workflow writes an encrypted logical Postgres backup and encrypted Supabase identity export to a private R2 bucket that is separate from artwork each night. Retain 14 daily copies and 8 weekly copies. Keep the encryption key outside R2 in GitHub encrypted secrets, with a recovery copy in the project operator's password manager. The recovery target is at most 24 hours of lost database work and restoration within 4 hours after the operator starts recovery.

Test a complete restore into a fresh Supabase project before launch and during the operating readiness slice. Restore migrations first, then application data, identities, memberships, and session revocation state. Artwork uses immutable R2 keys but has no second provider copy in V1. A provider loss can therefore require customer reupload. Only the retention workflow may delete accepted artwork, and paid cross provider replication remains a launch risk decision for the operating readiness spec.

Sentry receives exceptions and selected traces without customer artwork, private tokens, passwords, or full contact details. Structured logs use request and job identifiers. Send alerts to the configured project operator.

Alert on any dead outbox row, no dispatcher heartbeat for 5 minutes, pending outbox work older than 10 minutes, no successful backup for 30 hours, 3 order submission server errors within 10 minutes, or 20 rejected upload authorization attempts from one IP hash within 10 minutes. The operator acknowledges each alert and records recovery action for dead jobs and stale backups.

## Capacity and cost assumptions

* The pilot supports up to 50 orders per day and 10 simultaneous users without an architecture change.
* R2 currently includes 10 GB at no charge, but the upload and retention limits do not guarantee that the pilot stays inside it. At the full design capacity, storage becomes paid.
* Use 25 MB of accepted artwork per order as the initial planning average. At 50 orders per day with 90 day retention, steady artwork alone is about 112.5 GB before backups and active work.
* Maintain an application byte ledger from accepted object sizes and reconcile it daily with R2 provider measurements. Alert at 7.5 GB and require billing to be enabled before 9 GB or before the commercial pilot opens, whichever comes first.
* Set an initial R2 storage budget alert at USD 5 per month. Passing it triggers an operator review, not automatic deletion of active or retained files.
* Development should use free provider plans where their terms allow it.
* Commercial production includes at least Vercel Pro, currently USD 20 per month before tax and extra usage. Other providers may require paid plans as volume, backup needs, email volume, or support expectations grow.
* The pilot has no named compliance framework or Pakistan only residency requirement. Contact details and artwork are private customer data and follow least privilege, explicit retention, and secure deletion rules.

## Configuration required

Validate configuration at startup. Keep local values in ignored files, hosted values in Vercel, and workflow values in GitHub encrypted secrets.

* `DATABASE_URL`: pooled application connection
* `DATABASE_DIRECT_URL`: direct migration and backup connection
* `NEXT_PUBLIC_SUPABASE_URL`: browser safe Supabase project URL
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser safe Supabase public key
* `SUPABASE_SERVICE_ROLE_KEY`: server only administration key
* `R2_ACCOUNT_ID`: private object storage account
* `R2_ARTWORK_ACCESS_KEY_ID`, `R2_ARTWORK_SECRET_ACCESS_KEY`: runtime credentials limited to artwork buckets
* `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`: workflow credentials limited to the backup bucket
* `R2_ARTWORK_BUCKET`: quarantined and approved customer artwork
* `R2_BACKUP_BUCKET`: encrypted database backups, isolated from artwork access
* `RESEND_API_KEY`, `EMAIL_FROM`: transactional email access and verified sender on a dedicated shop subdomain
* `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`: background event and request verification
* `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`: error delivery and release source maps
* `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: public abuse checks
* `RATE_LIMIT_HASH_KEY`: HMAC key for IP and recovery identity hashes
* `LINK_PAYLOAD_ENCRYPTION_KEY`: encryption for raw guest links waiting for email acceptance
* `BACKUP_ENCRYPTION_KEY`: encryption for database backups, stored only in trusted workflow secrets
* `OPERATIONS_ALERT_EMAIL`: project operator who receives actionable alerts
* `APP_BASE_URL`: canonical origin used in links and callback validation
* `SHOP_ID`: the configured V1 shop identity

## Consequences

**Positive**

* One application is fast to build, debug, and deploy.
* Postgres fits orders, jobs, prices, approvals, and reporting without a future data migration caused by the database category.
* Explicit shop ownership, server only access, and portable object storage preserve the main future paths.
* Managed identity, email, jobs, and monitoring reduce custom security and operations work.

**Negative and tradeoffs**

* The stack depends on Vercel, Supabase, Cloudflare, Resend, Inngest, and Sentry. Provider outages and dashboard work become part of operations.
* Vercel requires a paid plan for the commercial pilot. The development target is free, not the production business.
* The free Supabase plan lacks managed backups and may pause after inactivity. The project therefore owns backup automation and restoration testing.
* R2 usage is expected to exceed its free allowance at the full pilot capacity. Production needs billing enabled and a small explicit storage budget.
* Automated malware scanning is absent at first. Quarantine, signature checks, download controls, and human review reduce risk but do not prove a file is clean.
* Optional TOTP leaves password compromise as a larger risk than mandatory second factor authentication.
* Serverless limits make Vercel unsuitable for long file processing. Inngest steps must stay bounded, and future heavy file work may need a container worker.

**Neutral**

* There is no general cache, dedicated search engine, realtime subscription layer, public API, or microservice boundary in V1.
* Pricing and order details remain the responsibility of later domain specs.
* The scaffold follows the Tracer Bullet approach. It should establish the smallest real path across app, database, auth, storage, email, jobs, and deployment before adding breadth.

## Follow-up

* [ ] Record `pnpm`, `drizzle`, `zod`, `typescript-advanced-types`, `vitest`, `react-testing-library`, `github-actions-templates`, and `tailwind-css-patterns` conventions in root `AGENTS.md`, because they affect the whole project.
* [ ] Record `cloudflare-r2` conventions in `src/storage/AGENTS.md`, with a pointer from root `AGENTS.md`.
* [ ] Record `inngest-setup` and `inngest-durable-functions` conventions in `src/jobs/AGENTS.md`, with a pointer from root `AGENTS.md`.
* [ ] Record `react-hook-form` conventions in `src/ui/AGENTS.md`, with a pointer from root `AGENTS.md`.
* [ ] Record `sentry-sdk-setup` conventions in `src/observability/AGENTS.md`, with a pointer from root `AGENTS.md`.
* [ ] Confirm the shop controls a domain and can publish DNS records for the dedicated transactional email subdomain before real email testing.
* [ ] Recheck provider prices, free allowances, commercial terms, and South Asia region availability immediately before pilot launch.
* [ ] Add a paid malware scanning service when the pilot budget permits it, or before accepting risky formats identified by the artwork spec.
* [ ] The scaffold should pin compatible Node.js, Next.js, pnpm, Drizzle, and database driver versions, then record the pooled application connection mode and direct migration connection.
* [ ] The shop and order data model spec should name the authoritative timestamps for session creation, order completion, cancellation, retention, outbox terminal state, and storage usage.
* [ ] The first order flow spec should set a 30 second starting poll interval for active guest status pages, a 5 minute private download URL, and signature verification for every provider webhook.
* [ ] The operating readiness spec should decide whether active artwork needs paid replication outside R2 before launch.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
