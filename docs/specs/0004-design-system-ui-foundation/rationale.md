# 0004. Design system and UI foundation rationale

## Context

> ⚠️ Premise note: A global design system can become a premature component library if it is built without a real journey. That failure mode creates unused abstractions and delays the shop workflow. This decision therefore defines the smallest shared contract that can carry one real order, then expands only when the tracer bullet proves a repeated need.

PrintFlow has two audiences with different pressures. Customers need a calm mobile path for configuration, price, artwork, and pickup. The shop admin needs compact views that support review and production work on a laptop or tablet. Both audiences must understand the same order and job states, even though their navigation and density differ.

The repository has a Next.js App Router scaffold, Tailwind v4, Geist fonts, and a default global stylesheet, but no established shared component source. The existing interface guidance already requires project owned shadcn components, server safe boundaries, native forms for simple actions, React Hook Form for complex client state, Zod at server boundaries, and accessible responsive behavior. The stack spec makes this a modular monolith with Server Components by default, while the data model gives each shop a versioned settings JSON document.

The first shop is OkPrints in Barkat Market, Lahore. Its public site and logo establish a red and white identity, while its later product role requires the interface to work for more shops. A theme editor, per store typography, and arbitrary layout overrides would add operational and security surface before the pilot needs them. The decision must preserve the shop identity now without making future shop support a rewrite.

Without a standard, each feature could invent its own field errors, loading states, status colors, table behavior, date formatting, upload feedback, and navigation. Those differences would be especially costly in the customer to admin journey because the same domain state would look different at each handoff. Invalid or raw store settings reaching the browser would also turn a future branding change into a security and reliability problem.

## Options considered

### Option 1: Document and enforce for new UI now

Define the shared contract, enforce it with types, lint restrictions, schema tests, component tests, browser checks, and a development showcase. Use the tracer bullet to replace the starter surface and make the next real screens comply, while tracking no broad migration because production UI does not yet exist. (basis: the Tracer Bullet build approach, `src/ui/AGENTS.md`, and the Beta verification workflow)

**Pros**:

1. It puts the strongest rules in the path of the first real order.
2. It keeps the first change small enough to verify on phones, tablets, and shop laptops.
3. It allows the component inventory to grow from observed repetition.

**Cons**:

1. The codebase carries a short transition while the starter page is replaced.
2. Some enforcement remains a focused review and showcase responsibility until more components exist.

### Option 2: Document and migrate every surface in one coordinated change

Build the whole component catalogue, both shells, every state, and all future feature layouts before the first order journey is wired. (basis: the scope feature's broad shared coverage goal)

**Pros**:

1. The visual migration would appear uniform immediately.
2. All planned primitives could be reviewed in one batch.

**Cons**:

1. It delays the real order path and increases the chance of unused abstractions.
2. A large UI change is harder to review for keyboard behavior, focus, contrast, and mobile overflow.
3. It assumes patterns for quotes, multiple jobs, reporting, and public discovery that have not yet been designed.

### Option 3: Document the standard and rely on review

Record the intended tokens and component rules, but leave enforcement to individual feature authors and manual review. (basis: the current scaffold has only a small amount of UI)

**Pros**:

1. It adds little tooling or setup work.
2. It leaves authors free to choose the fastest local implementation.

**Cons**:

1. The most important rules, such as error association and theme boundaries, would be easy to bypass.
2. Review would repeatedly rediscover the same accessibility and formatting problems.
3. It does not create a reliable contract for future shops.

## Rationale

Option 1 is the right enforcement level for a small pilot with a clear end to end build strategy. It makes the first real journey use the hard parts, but keeps the foundation itself limited to tokens, primitives, shells, adapters, and fixture compositions. The separate standard job feature owns live order screens and production actions. The type boundary and server resolver prevent raw settings from leaking into UI, while the showcase and targeted tests make visual and accessibility behavior easy to inspect.

The component choice is intentionally source owned. A complete runtime design system would reduce initial assembly work but would make the application dependent on an external visual contract. Hand built controls would preserve ownership but repeat difficult focus, keyboard, dialog, select, and drawer behavior. shadcn with Base UI provides source ownership while starting from accessible primitives, and current shadcn documentation supports Base UI as a first class path. The project must use Base UI `render` composition, not Radix `asChild` examples. (basis: the installed `shadcn`, `shadcn-baseui`, Tailwind, CVA, and Lucide skills; [shadcn Base UI guidance](https://ui.shadcn.com/docs/changelog/2026-01-base-ui))

The OkPrints theme is a small validated seed, not a general styling language. The official site declares the primary red `#ED3237`, supporting red `#C52F33`, dark neutral `#0A0500`, warm gray `#504E4A`, near paper `#FDFDFD`, and white. The reviewed logo uses the same red and a near black mark. The stored semantic ink uses the official `#0A0500` because it gives a safe dark foreground on the primary red. Supporting red uses white as its foreground. The logo asset keeps its own exact pixels. The resolver checks every role rather than assuming a color works in every context, and it does not use red as normal body text on paper. (basis: the official OkPrints site, its reviewed logo asset, the researched Barkat Market listing, and the contrast calculation used during design)

The current `shopSettingsSchema` accepts only `shop_settings.v1`, and the bootstrap command passes that schema directly into the `shops.settings` column. That makes compatibility a real implementation decision, not a naming detail. The standard therefore separates v1 reads from v2 writes, keeps v1 rows readable without an automatic rewrite, and requires an expected shop version for any reviewed settings update. Public, admin, and guest requests also establish shop identity through different trusted sources, so the theme resolver accepts a server authority context rather than a browser supplied identifier. (basis: `src/modules/orders/validation.ts`, `src/modules/shop/commands.ts`, `src/modules/shop/authorization.ts`, and spec 0003)

The UI foundation cannot invent the values shown in domain screens. Existing order queries already return the reference, current job rows, derived progress, known total, quote pending identifiers, requested local date, confirmed due time, blockers, and collection readiness. Storage commands already own upload sessions, byte reservations, intent expiry, validation state, and scan state. The standard names the future catalog, admin queue, order, upload, status, and error adapters so the UI remains source owned without making the UI module a second domain query layer. (basis: `src/modules/orders/queries.ts`, `src/modules/orders/model.ts`, `src/storage/commands.ts`, and `src/db/contracts.ts`)

Money and time need stricter rules than a generic `Intl` wrapper. PrintFlow stores SQL money as integer `bigint` and JSON money as decimal strings, so a UI formatter must not convert a large amount through a floating point number. Requested dates are local calendar dates, while due dates and activity values are UTC instants. The standard gives them separate formatter contracts and reserves a plain `Quote required` label for a missing accepted quote. (basis: `src/db/AGENTS.md`, `src/db/contracts.ts`, and `src/modules/orders/queries.ts`)

The theme stays in `shops.settings` because the existing data model already has a versioned JSON boundary and the pilot has one shop. A separate branding table would add joins, migration, and history semantics without a current editor or rollback need. A later editor can reuse the same contract and add an audit and revision decision when a second shop makes that operationally valuable. (basis: spec 0003's versioned shop settings contract and future shop ownership rule)

The formatters, status presentation type, and feedback states are shared because they are cross domain language. Their inputs still come from the owning domain. That keeps the UI consistent without making the UI module query orders, jobs, catalog tables, or storage directly. (basis: spec 0001's modular monolith boundaries and `src/ui/AGENTS.md`)

## Supporting evidence

### Current repository shape

1. `src/app/globals.css` contains only the default background, foreground, dark media query, and font mappings.
2. `src/app/page.tsx` is the create Next app starter surface with raw utility colors and no product flow.
3. `src/app/layout.tsx` already provides Geist and Geist Mono, so the foundation keeps those fonts and defines a smaller type scale rather than adding another font dependency.
4. `package.json` already contains Tailwind v4, Zod, Testing Library, Vitest, and Playwright. Base UI, shadcn components, CVA, Tailwind merge, Lucide, and Axe Playwright support still need to be added during implementation.
5. `src/db/schema.ts` gives `shops` a required versioned `settings` JSON document, a shop version, `Asia/Karachi` and PKR checks, and an existing `name` field. No duplicate store display name is needed.
6. `src/modules/orders/validation.ts` currently accepts only `shop_settings.v1`, while `src/modules/shop/commands.ts` uses it for bootstrap. `src/modules/orders/queries.ts` and `src/storage/commands.ts` already expose the domain values that later adapters must present.

### OkPrints research

The official OkPrints site identifies the business as a digital printing shop and exposes the reviewed logo asset. A public directory places the store at Office 42, Lower Ground Floor, Central Plaza, Barkat Market, New Garden Town, Lahore. The public site contains placeholder contact text in some sections, so its logo and declared palette are treated as brand evidence only. Product contact details and copy must come from the shop data model when the public shop feature is designed.

### Tool selection

1. shadcn was selected because components are added as source code and can be composed with project tokens.
2. Base UI was selected over Radix for the primitive API agreed during design. `render` is the canonical composition mechanism.
3. Lucide supplies tree shaken individual icons and a predictable accessible default.
4. CVA provides typed finite variants and compound variants. It does not become a runtime theme engine.
5. Testing Library, Playwright, and targeted Axe checks cover user behavior, real browser journeys, and common accessibility regressions. Axe is a regression aid, not proof of complete WCAG conformance. Manual keyboard, reduced motion, and contrast review remain necessary.

## References

**Project sources**:

1. `AGENTS.md`, which fixes the TypeScript, Next.js, Tailwind, testing, package manager, and server boundary conventions.
2. `src/ui/AGENTS.md`, which fixes shared UI ownership, Server Component preference, form choices, Zod boundaries, and accessibility expectations.
3. `docs/specs/0001-stack-architecture/index.md`, which fixes the modular monolith, shared interface direction, Server Component default, and Testing Library plus Playwright stack.
4. `docs/specs/0003-shop-order-data-model/index.md`, which fixes shop ownership, versioned settings, PKR, Lahore time, private files, and order state sources.
5. `src/db/schema.ts`, which provides the existing `shops.settings`, `shops.name`, `shops.version`, `shops.currency`, and `shops.timezone` fields.
6. The installed `shadcn`, `shadcn-baseui`, `lucide-icons`, `web-styling-cva`, `tailwind-css-patterns`, `react-hook-form`, `react-testing-library`, `playwright-cli`, `zod`, and `pnpm` skills recorded in `skills-lock.json`.

**Practices and standards**:

1. WCAG 2.2 AA principles for keyboard access, focus, labels, error association, contrast, target size, and reduced motion.
2. Semantic HTML and progressive enhancement for meaningful content and native form behavior before client hydration.
3. Design tokens and semantic roles for stable component meaning across themes.
4. Defense in depth, least privilege, and server side validation for untrusted settings and private shop data.
5. Idempotent mutation behavior for repeated submissions and uncertain network outcomes.

**Links**:

1. OkPrints official site: https://okprints.pk/
2. OkPrints logo asset: https://okprints.pk/wp-content/uploads/2025/03/OK-PRINTS.png
3. OkPrints Barkat Market listing: https://www.lookup.pk/94248/ok-prints
4. shadcn Base UI announcement: https://ui.shadcn.com/docs/changelog/2026-01-base-ui
5. shadcn Base UI default announcement: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
6. shadcn theming guidance: https://ui.shadcn.com/docs/theming
