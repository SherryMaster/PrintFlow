# Scope: PrintFlow

PrintFlow helps your digital print shop accept printing jobs and manage them through pickup. Your first pilot is one shop in Lahore, with guest customers and one protected admin account.

**Build approach:** Tracer Bullet (make one real order work through the whole app, then expand that working path).
**Workflow:** Beta (after `/develop`, verify the real app with `/check verify`, then add appropriate tests with `/test`). Features tagged GA also get a fresh model `/check review` and `/document`.

These are recommendations for your build. You can adjust the order or skip a workflow step when you already have the evidence you need. Technical choices belong in feature specs, not this scope.

## Pilot boundaries

Your V1 covers panaflex, stickers, signs, colour and B&W printing, maps, and print and cut work. Standard configurations receive instant prices. Unusual work receives a manual quote. The admin reviews artwork and confirms production, including customer proof approval when needed.

Customers can combine several jobs in one order, with artwork attached to each job. They order without accounts, receive private order links and automatic email updates, and provide a phone number for shop contact. Pickup is the only fulfillment option. Delivery arrangements stay outside the app.

Your admin can also enter walk in and phone orders. One workspace holds services, prices, orders, job progress, due dates, internal notes, and basic reporting. English, PKR, and Lahore local time apply throughout. Customer accounts and staff accounts are outside V1, with the single admin account as the explicit exception.

**Pilot success:** a customer can complete a real order through pickup, and your admin can manage online, walk in, and phone orders without a separate order spreadsheet. Basic order counts and turnaround show whether the workflow is useful. There is no fixed launch deadline. Budget, team capacity, expected volume, and file limits remain inputs for design, not assumed commitments.

**Future readiness:** shop ownership is explicit for services, prices, orders, and artwork. V1 runs with one configured shop. Future shops, customer identities, and payments should be addable without losing existing order history. V1 does not include shop registration, tenant switching, subscriptions, or a platform administration console.

## At a glance

| #   | Feature                                       | Phase      | Status  |
| --- | --------------------------------------------- | ---------- | ------- |
| 1   | Stack and architecture                        | Foundation | done    |
| 2   | Coding standards and tooling                  | Foundation | done    |
| 3   | Shop and order data model                     | Foundation | planned |
| 4   | Design system and UI foundation               | Foundation | planned |
| 5   | One standard job through pickup               | Slice 1    | planned |
| 6   | Full service catalog and configurable pricing | Slice 2    | planned |
| 7   | Multiple jobs in one order                    | Slice 3    | planned |
| 8   | Custom quotes and customer acceptance         | Slice 4    | planned |
| 9   | Artwork replacements and proof approval       | Slice 5    | planned |
| 10  | Daily shop order management                   | Slice 6    | planned |
| 11  | Public shop and service discovery             | Slice 7    | planned |
| 12  | Pilot reliability and operating readiness     | Slice 8    | planned |

## Foundations

### 1. Stack and architecture · done

Choose a maintainable structure for your medium sized app and create a runnable project. Keep the one shop pilot simple while allowing later shop ownership, accounts, and payment additions.

**Done when:** a spec records the architecture and operating choices, including admin access, private guest access, uploads, email, and deployment boundaries; the minimal project runs locally and builds; budget and capacity assumptions are explicit.

**Spec:** [0001](../specs/0001-stack-architecture/index.md)
**Code:** [application scaffold](../../src/) and [project manifest](../../package.json)

- [x] Decide the stack (spec): `/architect stack and architecture`
- [x] Scaffold from the decision: `/develop stack and architecture`
- [x] Verify it: `/check verify stack and architecture`
- [x] Test it: `/test stack and architecture`

### 2. Coding standards and tooling · done

Capture conventions from the real scaffold, then establish routine checks so later slices follow the same standards.

**Done when:** project guidance reflects the actual scaffold, and formatting, linting, type checks where applicable, and automated build checks run successfully.

**Spec:** [0002](../specs/0002-coding-standards-tooling.md)
**Code:** [quality scripts](../../package.json), [format scope](../../.prettierignore), and [CI workflow](../../.github/workflows/ci.yml)

- [x] Choose the formatter and automated checks (spec): `/architect coding standards and tooling`
- [x] Capture conventions and tooling choices: `/audit`
- [x] Build it: `/develop coding standards and tooling`
  - [x] Establish the local and CI quality path with the pinned formatter, ordered checks, least privilege workflow, and clean tree assertion (**AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-7**)
  - [x] Format the accepted repository scope and prove clean, failing, and non rewriting check behavior (**AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-7**)
  - [x] Align root contributor guidance with the implemented scripts and workflow (**AC-6**)
- [x] Verify it: `/check verify coding standards and tooling`
- [x] Test it: `/test coding standards and tooling`

### 3. Shop and order data model · planned · needs a decision

Define shop ownership and the relationships between services, pricing, orders, jobs, artwork versions, quotes, approvals, and production history. Guest contact details belong to orders without requiring a customer account.

**Done when:** the model supports several jobs per order, immutable submitted configurations and price snapshots, quote revisions, exact artwork approvals, separate job and order progress, and admin activity history; later catalog changes cannot rewrite existing orders; money, units, rounding, and time rules are recorded.

- [ ] Design it (spec): `/architect shop and order data model`

### 4. Design system and UI foundation · planned · needs a decision

Establish a professional, consistent interface for customers on phones and the admin at the shop. Keep configuration, prices, artwork issues, and production states easy to understand.

**Done when:** shared forms, navigation, tables, status indicators, and feedback states cover both surfaces; keyboard use, focus, contrast, clear labels, and responsive layouts have concrete acceptance criteria; English text, PKR amounts, and local dates follow consistent rules.

- [ ] Design it (spec): `/architect design system and UI foundation`

## Slice 1: Prove one real order

### 5. One standard job through pickup · planned · needs a decision · GA

Build the walking skeleton using one simple standard service chosen during design. A customer configures it, receives a real price, uploads artwork, submits contact details, and follows the order while your admin reviews and produces it.

**Done when:** the complete path works with saved data and real email; one protected admin can review artwork and move the job through received, review, production, ready, and collected states; a private guest link shows customer facing progress; unauthorized access to orders, files, and admin actions is blocked; confirmation and pickup emails work; upload failures and repeated submissions do not create broken or duplicate orders.

- [ ] Design it (spec): `/architect one standard job through pickup`

This slice includes real admin sign in, sign out, session protection, and a recovery path. Guest link access and file access rules are designed explicitly, including link loss, revocation, and abuse protection. Internal notes and other customers' information never appear in the guest view. There is no separate throwaway skeleton.

## Slice 2: Expand configuration and pricing

### 6. Full service catalog and configurable pricing · planned · needs a decision

Expand the working service path to every named service family. Your admin controls availability, valid options, pricing rules, and which configurations need a manual quote.

**Done when:** customers can configure panaflex, stickers, signs, colour and B&W printing, maps, and print and cut; applicable dimensions, units, material or paper, page or sheet counts, quantity, sides, colour, and finishing affect the price; admin changes produce consistent customer prices; invalid combinations are rejected and unsupported work is clearly marked for quotation.

- [ ] Design it (spec): `/architect full service catalog and configurable pricing`

Use the shop's real rate cards and representative jobs during design. Record area versus sheet or page calculations, minimum charges, quantity bands, finishing charges, rounding, and any tax presentation before implementing them. Do not invent rates. Maps retain requested size and scale instructions; cut work captures requirements for manual review without promising automatic print readiness checks.

## Slice 3: Combine jobs

### 7. Multiple jobs in one order · planned · needs a decision

Extend the working order path with a cart containing different configurations and artwork per job. Keep one customer reference while showing the progress of each job.

**Done when:** customers can add, edit, and remove jobs, attach the correct files, and submit one order; each job keeps its own configuration and price snapshot; totals distinguish known charges from amounts awaiting quotation; the guest and admin views agree on job progress and whether the whole order is ready for pickup.

- [ ] Design it (spec): `/architect multiple jobs in one order`

## Slice 4: Handle work that needs a quote

### 8. Custom quotes and customer acceptance · planned · needs a decision

Add manual quoting to the existing order path, including orders mixing standard and custom jobs. Your admin sends a clear price proposal and the customer responds through the private order link.

**Done when:** the admin can issue and revise itemized quotes with validity terms; customers receive email and can accept or decline the current quote; expired or superseded quotes cannot be accepted; accepted prices remain recorded; price changes require fresh acceptance; production waits for the required price and artwork approvals.

- [ ] Design it (spec): `/architect custom quotes and customer acceptance`

Design records whether a pending custom job holds the whole order or only that job. Customer requested dates remain requests until the admin confirms a due date. Declines, expiry, and cancellation have visible outcomes, with no payment or refund workflow.

## Slice 5: Resolve artwork before production

### 9. Artwork replacements and proof approval · planned · needs a decision · GA

Extend the initial upload and review path with replacement requests and optional proofs. Keep the approved production file unambiguous for both the customer and your admin.

**Done when:** the admin can request replacements with a reason, upload a proof, and email the customer; customers can securely upload replacements and approve or reject the current proof; version history records who approved which file and when; replacement files invalidate affected approvals; production is blocked until required reviews and approvals are complete.

- [ ] Design it (spec): `/architect artwork replacements and proof approval`

Design sets supported file formats, size limits, safe handling, download permissions, retention, and deletion behavior. Preserve original files even when a browser preview is unavailable. Automated preflight, file repair, and an online artwork editor remain deferred.

## Slice 6: Run the shop from one queue

### 10. Daily shop order management · planned · needs a decision

Expand the minimal admin order view into the daily workspace. Bring walk in and phone work into the same job and production flow as online orders.

**Done when:** the admin can create assisted orders, search and filter by reference, customer, status, source, and due date, manage job progress and internal notes, record cancellations with reasons, and see overdue or blocked work; basic counts and defined turnaround measures reflect saved history; printable job summaries identify configuration and production artwork; collected orders remain searchable.

- [ ] Design it (spec): `/architect daily shop order management`

Assisted orders can serve customers who do not have email. Design defines how the admin records in person or phone quote and proof acceptance, including the actor, channel, and time, without pretending the customer used a guest link. This is order management, not inventory, machine scheduling, payroll, or accounting.

## Slice 7: Make the shop discoverable

### 11. Public shop and service discovery · planned · needs a decision

Expand the initial service entry page into the shop's public storefront. Let your admin maintain branding, contact details, opening hours, pickup instructions, and useful service information.

**Done when:** mobile visitors can browse the available services and enter the correct configuration flow; public pages have useful titles, descriptions, share previews, and search discovery metadata; shop details are editable; privacy and order terms explain review, quotes, pickup, contact data, and artwork handling; private order and admin pages stay outside public indexing.

- [ ] Design it (spec): `/architect public shop and service discovery`

## Slice 8: Prepare the complete pilot

### 12. Pilot reliability and operating readiness · planned · needs a decision

Prove the expanded workflow with the Lahore shop's real examples and make routine failures recoverable. Earlier slices already include access protection and error handling; this slice verifies the complete operating path.

**Done when:** representative jobs from every service family complete through pickup, including a mixed order, revised quote, rejected proof, replacement file, and assisted order; agreed mobile performance and capacity targets pass; email failures are visible and retryable; monitoring identifies actionable errors; a backup restore succeeds; agreed file retention and deletion rules work without silently breaking active jobs or order history.

- [ ] Design it (spec): `/architect pilot reliability and operating readiness`

Pilot checks include accessible keyboard and mobile flows, interrupted uploads, repeated approval actions, stale prices, private link misuse, and customer versus internal visibility. Measure order counts and turnaround without adding a marketing analytics program. Set measurable performance, volume, storage, and recovery targets during design using the shop's expected workload.

## Deferred

These eight areas stay outside the current build. Revisit them through `/scope` when the pilot shows a concrete need.

1. **Customer and staff accounts:** customer history, saved artwork, reorders, multiple staff identities, invitations, and role permissions. The pilot's single admin account is already included.
2. **Multiple shops and SaaS operations:** shop registration, separate shop workspaces, tenant switching, platform administration, subscriptions, and commercial plans.
3. **Payments and financial operations:** online checkout payments, deposits, refunds, payment reconciliation, invoicing, tax reporting, and accounting integrations.
4. **Delivery operations:** address based delivery checkout, delivery pricing, dispatch, courier integrations, and delivery tracking.
5. **ERP functions:** inventory, procurement, suppliers, machine capacity planning, staff scheduling, payroll, and detailed costing.
6. **Advanced artwork tools:** automatic print readiness checks, repairs, nesting, automated cut preparation, and an online design editor.
7. **Additional communication and languages:** automated WhatsApp or SMS, customer chat, Urdu and right to left layouts, and additional currencies.
8. **Growth and integration features:** advanced conversion analytics, campaigns, loyalty, promotions, a public API, marketplace integrations, and complex business reporting.

## Legend

**Status:** `planned` means work has not started. Specs and builds advance to `in-progress`, then `done` after the chosen verification. `existing` marks work that predates this workflow. `dropped` preserves a removed feature's history.

**Needs a decision:** the first checkbox points to `/architect`. Specs capture implementation decisions and acceptance criteria. After design, the scope gains a spec link, a build command with a few milestones, and the applicable verification commands. Atomic build tasks stay in the spec.

**Next step:** the first unticked checkbox in build order. Coding standards starts with `/audit` after the scaffold exists, then advances to tooling implementation. All other initial boxes are design entry points.

**Workflow:** features inherit Beta unless tagged GA. Beta uses real app verification and tests. GA adds a fresh model review and change documentation, including for admin access and guest files. Record skipped steps and any unratified design assumptions explicitly rather than treating them as verified.
