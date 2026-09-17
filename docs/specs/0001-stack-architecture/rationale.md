# 0001. Stack and architecture rationale

## Context

PrintFlow is a new web application for one Lahore print shop. Guests submit orders and artwork without accounts. One admin manages the work through pickup. The first production target is up to 50 orders per day and 10 simultaneous users.

The project starts with no source code and no established stack. Private contact details, order links, and large customer artwork need clear access boundaries. The team wants free services during development, but accepts the minimum paid hosting needed when the commercial pilot opens. There is no named compliance framework or Pakistan only data residency rule.

The architecture must support a real order from the public form through admin work, private file access, email, and pickup. It must also preserve a practical path to more shops, staff accounts, customer identities, and payments without building those deferred capabilities now.

## Options considered

### Option 1: Managed TypeScript modular monolith

One Next.js app contains public, guest, and admin surfaces. Managed Postgres, identity, object storage, email, durable jobs, and monitoring sit behind server only boundaries. (basis: `docs/scope/scope.md`, monolith first, [Next.js App Router](https://nextjs.org/docs/app))

**Pros**

* The smallest deployable shape covers the complete pilot.
* TypeScript contracts span forms, server work, jobs, and persistence.
* Managed providers reduce custom security and operations work.

**Cons**

* Several provider accounts and secrets still need ownership.
* Commercial Vercel use creates a production cost floor.
* Serverless execution is a poor fit for long file processing.

### Option 2: Vercel centered stack

Use Next.js with Vercel hosting, Vercel Blob, a marketplace Postgres database, and separate hosted identity. This gives a close hosting integration. (basis: managed platform simplicity, [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing))

**Pros**

* Deployment and file management share one dashboard.
* Preview environments are straightforward.

**Cons**

* The current free Blob allowance is only 1 GB, which is too small for print artwork.
* Identity and database decisions remain separate.
* Private file delivery can pass through billed application bandwidth.

### Option 3: Supabase centered client application

Use Supabase database, identity, storage, and direct browser data access, with a lighter application server. This minimizes server code for ordinary data work. (basis: backend as a service pattern, [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control))

**Pros**

* Database, identity, and storage policies share one platform.
* Realtime data is available if the product later needs it.

**Cons**

* Browser data access makes authorization policy design a larger part of every feature.
* The current free storage limit is 1 GB and free uploads are capped at 50 MB, which does not fit artwork well. (basis: [Supabase Storage limits](https://supabase.com/docs/guides/storage/uploads/file-limits))
* Business rules become easier to split between client code, database functions, and policies.

### Option 4: Separate frontend and container API

Use a React frontend with a separately deployed Node.js API and worker containers. This gives full runtime control and clean service boundaries. (basis: service boundary pattern)

**Pros**

* Long running file work and persistent processes have a natural home.
* Frontend and backend can scale or deploy independently.

**Cons**

* Two applications, cross origin security, container operations, and duplicated deployment work add cost before the pilot needs them.
* A small team must debug failures across more moving parts.

## Rationale

Option 1 matches the product and operating reality. The workload is small, the customer and admin journeys share one domain, and no team ownership boundary requires separate services. A modular monolith keeps those paths in one transaction and one deployment while preserving internal seams.

Supabase Postgres and Auth solve relational data and admin identity together. Cloudflare R2 is the deliberate exception because print files need more than the 50 MB upload ceiling and 1 GB storage allowance on the current Supabase free plan. The server remains the sole authority, so using a second storage provider does not split business rules across clients.

The outbox is preferred to direct event publishing because saving an order and requesting its email must succeed as one business decision. Inngest is preferred to a home grown scheduled worker because retry state and failed work need visibility. A database scheduled worker was the runner up, but it would require more custom leasing, retry, and monitoring code.

Vercel remains the best deployment fit for Next.js. Its free plan cannot serve the commercial pilot, so the architecture treats free hosting as a development convenience and Vercel Pro as a launch cost. This is more honest than designing around a free tier that does not permit the intended use.

The same rule applies to artwork storage. R2 has the best current free allowance of the compared managed choices, but 90 days of artwork at the target capacity cannot remain free. The design therefore enables billing before commercial use, maintains an application byte ledger, and treats the free allowance as development headroom rather than a production promise.

## Landscape evidence

The current official limits that materially changed the choice are recorded here for later review.

* Supabase Free currently includes 1 GB of file storage, 5 GB ordinary egress, 5 GB cached egress, and a 50 MB maximum upload. Free projects can pause after one week of inactivity.
* Vercel Blob Hobby currently includes 1 GB of storage and 10 GB of transfer, but Vercel Hobby is restricted to personal, noncommercial use.
* Cloudflare R2 Standard currently includes 10 GB month of storage, one million write class operations, ten million read class operations, and free internet egress.
* Provider limits and terms can change. The launch review in the main spec is required.

## References

**Project sources**

* `docs/scope/scope.md`, product boundaries, Tracer Bullet approach, and future readiness
* Installed community skills listed in the main spec, implementation conventions

**Practices and standards**

* Monolith first for a small team and one product domain
* Relational database default for transactional, connected business data
* ORM for routine data access and SQL for complex reporting
* Transactional outbox for reliable side effects
* Object storage for customer files
* Least privilege and server only secrets
* Test pyramid with browser verification for the main journey

**Links**

* Next.js App Router: https://nextjs.org/docs/app
* Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs
* Vercel plan rules: https://vercel.com/docs/plans/hobby
* Vercel Blob pricing: https://vercel.com/docs/vercel-blob/usage-and-pricing
* Supabase Auth: https://supabase.com/docs/guides/auth
* Supabase pricing: https://supabase.com/pricing
* Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
* Supabase Storage limits: https://supabase.com/docs/guides/storage/uploads/file-limits
* Drizzle PostgreSQL: https://orm.drizzle.team/docs/get-started-postgresql
* Drizzle migrations: https://orm.drizzle.team/docs/migrations
* Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
* Resend API: https://resend.com/docs/api-reference/introduction
* Resend templates: https://resend.com/docs/dashboard/templates/introduction
* Inngest Functions: https://www.inngest.com/docs/learn/inngest-functions
* Vercel Observability: https://vercel.com/docs/observability
* Playwright: https://playwright.dev/docs/intro
