# 0004. Design system and UI foundation

**Date**: 2026-09-23
**Status**: Accepted

## Summary

PrintFlow will use one project owned interface foundation for customer and admin pages. It combines accessible Base UI primitives from shadcn, semantic Tailwind tokens, shared state and formatting helpers, and two responsive shells. The pilot theme is seeded with the researched OkPrints red and white identity, while the theme contract stays scoped to each shop for later multi shop support.

## Decision

**Chosen option**: Option 1: Project owned semantic foundation with Base UI primitives

Build source owned shadcn components on Base UI, styled with Tailwind CSS v4 semantic tokens, CVA variants, a shared class merge helper, and Lucide icons. Both shells consume the same primitives and a server resolved theme. The first rollout exercises the foundation with fixture compositions shaped like the one standard job journey, while the separate standard job feature owns the live journey. (basis: `src/ui/AGENTS.md`, spec 0001, the Tracer Bullet build approach, and the shadcn Base UI documentation)

**Implementation skills**: `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `shadcn-baseui` (`thunderboltdev/shadcn-baseui`, `.agents/skills/shadcn-baseui/`) · `lucide-icons` (`aksuharun/skills`, `.agents/skills/lucide-icons/`) · `web-styling-cva` (`agents-inc/skills`, `.agents/skills/web-styling-cva/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.agents/skills/tailwind-css-patterns/`) · `react-hook-form` (`pproenca/dot-skills`, `.agents/skills/react-hook-form/`) · `react-testing-library` (`itechmeat/llm-code`, `.agents/skills/react-testing-library/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) · `zod` (`pproenca/dot-skills`, `.agents/skills/zod/`) · `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Standard definition

**Required outcomes**:

1. Shared interface code lives under `src/ui`, with primitives, patterns, shells, theme helpers, status helpers, and formatters used by both customer and admin compositions.
2. Tailwind v4 semantic CSS custom properties provide the complete light theme and a later dark theme seam. Component code does not contain raw brand colors or page specific color classes.
3. The pilot uses the researched OkPrints profile with primary `#ED3237`, supporting red `#C52F33`, ink `#0A0500`, paper `#FDFDFD`, optional accent `#504E4A`, and a local logo asset with useful alternative text.
4. `shops.settings.branding` uses `shop_branding.v1` inside `shop_settings.v2`. Existing `shop_settings.v1` rows remain readable with the safe app theme, while new bootstrap and reviewed settings writes use strict `shop_settings.v2`. Zod validation, approved assets, contrast checks, safe fallback, and structured warnings protect the boundary. No branding table or pilot theme editor is added.
5. Shared primitives meet WCAG 2.2 AA goals for the first journey, including semantic HTML, keyboard access, visible focus, labels, error association, useful touch targets, contrast, reduced motion, and correct overlay focus behavior.
6. Forms provide labels, descriptions, required state, errors, summaries, server error regions, preserved values, `data-invalid`, and `aria-invalid`. Native forms handle simple actions, React Hook Form handles complex client state, and server validation remains authoritative.
7. Loading, empty, error, success, blocked, upload progress, and status components use typed labels, tones, icons, explanations, and next actions. Important outcomes are inline and announced when needed. Toasts remain noncritical.
8. The customer shell is mobile first. The admin shell supports shop laptops and tablets. Tables, uploads, navigation, store identity, order context, and progress have explicit narrow screen behavior.
9. PKR formatting receives integer paisa, date formatting receives an explicit `Asia/Karachi` timezone, and English text has a later localization seam. Pages do not format these values ad hoc.
10. UI receives only a serializable resolved theme from trusted server context. A missing or invalid theme keeps the page usable with a safe app theme and a structured warning.
11. Development only `/dev/ui` shows the tokens, primitives, states, and representative customer and admin compositions with static fixtures and no customer data. It is unavailable in production.
12. Testing Library, user event semantics, Vitest, Playwright, targeted Axe checks, and manual keyboard review cover the showcase and the later first journey, including long content, logo failure, theme failure, upload interruption, repeated submission, delayed JavaScript, and narrow layouts.

**Canonical pattern**:

```ts
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const shopBrandingSchema = z.object({
  schema_version: z.literal("shop_branding.v1"),
  logo: z.object({
    key: z.string().min(1),
    alt: z.string().min(1),
  }),
  tagline: z.string().trim().min(1).max(120).optional(),
  palette: z.object({
    primary: hexColor,
    supporting_red: hexColor,
    ink: hexColor,
    paper: hexColor,
    accent: hexColor.optional(),
  }),
});

type SemanticToken =
  | "background"
  | "foreground"
  | "surface"
  | "surfaceForeground"
  | "muted"
  | "mutedForeground"
  | "border"
  | "input"
  | "ring"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "accent"
  | "accentForeground"
  | "destructive"
  | "destructiveForeground"
  | "success"
  | "successForeground"
  | "warning"
  | "warningForeground"
  | "info"
  | "infoForeground";

type ResolvedTheme = {
  meta: { schemaVersion: "resolved_theme.v1"; colorScheme: "light" };
  identity: {
    name: string;
    tagline?: string;
    logo?: { src: string; alt: string };
  };
  tokens: Record<SemanticToken, string>;
};

const theme = await resolveShopThemeForContext({
  source: trustedContext,
});

return (
  <ServerThemeBoundary theme={theme}>
    <CustomerShell identity={theme.identity}>{children}</CustomerShell>
  </ServerThemeBoundary>
);
```

**Replaces**:

1. The default starter background, foreground, and dark media query as the product interface contract.
2. Page level raw colors, untyped class conditionals, and one off control markup.
3. Direct browser access to `shops.settings`, database records, private asset keys, or provider data.
4. String only statuses, page specific loading and error markup, and ad hoc PKR or date formatting.
5. Radix `asChild` composition copied into Base UI components.

**Implementation boundary**:

1. This standard owns semantic tokens, source owned primitives, shared patterns, shells, formatters, status adapters, theme resolution, and fixture based compositions.
2. The standard does not own the live standard job route, order commands, admin production commands, catalog queries, upload authorization, or domain specific copy. Those belong to the standard job feature and later feature specs.
3. The live feature route supplies typed domain presentation objects. It does not make `src/ui` query Postgres, read R2, select a shop from browser input, or infer authorization from visible actions.

**Ownership and layout**:

1. `src/ui/primitives` owns source copied from the selected shadcn registry and small project owned primitives.
2. `src/ui/patterns` owns reusable field, status, feedback, upload, table, and identity compositions.
3. `src/ui/shells` owns the customer and admin layout boundaries. Shells accept typed navigation, active location, identity, order context, and action slots. They do not own authorization or domain mutations.
4. `src/ui/theme` owns the branding schema, safe theme resolver, semantic token names, contrast checks, and CSS variable application.
5. `src/ui/formatters` owns PKR and Lahore time formatting. `src/ui/status` owns domain agnostic presentation types and tone mappings.
6. Tests sit beside their source files. Browser journeys remain in `e2e/`.

**Theme and branding contract**:

1. The existing `shops` row remains the owner. `shops.settings.branding` is the only pilot branding source. There is no new table, foreign key, branding history, or runtime request to the current OkPrints website.
2. Existing `shop_settings.v1` data remains readable. The shop validation module exposes a read union for v1 and v2, a strict v2 write schema, and the nested `shop_branding.v1` schema. Missing branding on a v1 row resolves to the safe app theme and does not silently rewrite the row.
3. The pilot bootstrap writes `shop_settings.v2` with the OkPrints profile. Any later reviewed settings update requires the current `shops.version`, writes the full validated settings document, increments `shops.version`, and updates `updated_at` in the same transaction. A stale expected version returns a domain conflict.
4. The pilot seed uses the reviewed local asset at `public/branding/okprints/ok-prints.png`. Store display name comes from `shops.name`. The tagline and logo alternative text come from branding settings. The asset key is checked against an approved public asset allowlist and the local file is admitted during the build.
5. Trusted shop selection is explicit. A public route resolves its approved shop slug to a server shop row. An admin request gets `shopId` from `authorizeAdminSession`. A guest request gets `shopId` from the validated guest grant. `resolveShopThemeForContext` accepts only that trusted server context, never a browser supplied shop id.
6. The closed semantic token map is the `SemanticToken` union above. The resolver applies these rules for the pilot: `background` is paper, `foreground` and primary foreground are ink, surfaces are white, muted surface is `#EDEFF2`, supporting foreground is paper, focus and links use supporting red, and status roles use fixed semantic status colors. Borders and inputs use a neutral mix of ink and paper. Primary and supporting foreground choices are selected only from ink and paper and are rejected if the required contrast is not met.
7. The resolver checks every text role at 4.5 to 1 or better, large text at 3 to 1 or better, focus and non text indicators at 3 to 1 or better, and interactive states against their adjacent surface. For OkPrints, primary red uses dark ink and supporting red uses paper. Red text on paper is not used for normal body copy because it does not meet the normal text target.
8. Theme resolution parses the versioned settings, validates the derived roles, and sets CSS variables once at the server rendered theme boundary. Descendant components use semantic classes and do not receive shop id or shop version. Only visible identity data and the resolved token values cross into browser rendering. An invalid or missing object keeps the page usable with the safe app theme and records a warning with shop id and schema version when safe to do so. It never turns invalid business settings into a successful write.
9. If a logo cannot load or decode, the shell omits the image and renders `shops.name` plus the optional tagline in the reserved identity space. It records an asset warning and does not block the page.
10. A future admin editor may write the same contract only after a second store or a real operational need exists. That editor requires its own feature spec, authenticated shop membership, expected version checks, and an audit decision.

**Data source boundary**:

1. Configuration labels, valid choices, and standard price previews come from the catalog service and price calculator using the published service and price rule versions. The route adapter converts them to typed UI options and calculation snapshots.
2. Customer order reference, known total, quote pending state, requested local date, confirmed due time, job rows, progress, blockers, and collection readiness come from `getOrderAggregate` under guest authority. The order presentation adapter maps `workflowState` and blocker types to `StatusPresentation` and next action.
3. Admin queue rows, counts, columns, pagination cursor, and permitted actions come from a dedicated authorized admin list query over order and job projections. The foundation defines the typed table input and mobile priority fields. The daily shop feature owns the query and its filters.
4. Upload quota, reserved bytes, accepted bytes, file name, upload URL expiry, validation state, and scan state come from upload sessions and upload intents in the storage boundary. Browser byte progress is controlled client state and is never treated as authoritative.
5. Navigation labels, links, active location, and permitted action slots come from the route or application layer. The shell renders them and never derives authorization from whether a button is visible.
6. Field errors come from Zod issue paths. Form level failures use the existing `DomainErrorCode` values and their centralized plain English message map. The UI does not show raw database or provider errors.
7. PKR values use the existing integer `bigint` contract or its canonical decimal paisa string. `formatMoney` accepts no floating point number, groups rupees with `Intl.NumberFormat("en-PK")`, and emits a stable English form such as `PKR 1,234.00`. A quote required job displays `Quote required`, not a zero total.
8. A requested local date is a calendar date from `orders.requestedLocalDate` and is formatted without converting it through UTC. A due or activity timestamp is a UTC instant from the database and is formatted with the shop timezone, which is `Asia/Karachi` in the pilot. These are separate formatter functions.

**Component and behavior rules**:

1. Use Base UI APIs. Use `render` for composition and `nativeButton={false}` when a Button wraps a link. Do not use Radix `asChild` patterns.
2. Use semantic Tailwind tokens such as `bg-background`, `text-foreground`, `text-muted-foreground`, and `ring-ring`. Use `cva` for finite visual variants, `VariantProps` for their types, and the shared merge helper for class conflicts. Responsive changes belong to CSS breakpoints, not runtime variants.
3. Import individual Lucide icons through a project owned wrapper. Icons that convey meaning receive accessible text. Status mappings pass icon components, not string names.
4. Use the shadcn field system for form layout. Put `data-invalid` on the field and `aria-invalid` plus `aria-describedby` on the control. Use live regions for asynchronous outcome changes. Preserve values after server errors.
5. Use `Alert`, `Empty`, `Skeleton`, `Progress`, `Spinner`, `Badge`, and the project toast wrapper for their respective states. Important errors and blocked production work cannot appear only in a toast.
6. Use semantic tables with explicit narrow screen priorities. Do not add a full data grid, client side sorting system, or general client data cache in this foundation.
7. Use short functional transitions and honor `prefers-reduced-motion`. Dialogs and drawers have accessible titles, trap and restore focus, and offer inline or native alternatives when the action can be completed without an overlay.
8. Render meaningful semantic HTML and native form paths while JavaScript is delayed. Interactive enhancement may wait for hydration. A page must not become a blank shell because a client component has not loaded.

**Enforcement**:

1. TypeScript types separate raw shop settings from `ResolvedTheme`, `StatusPresentation`, formatter inputs, and component variants. UI modules do not import database clients or raw settings.
2. Zod parses settings at the server boundary. A resolver test rejects invalid hex, missing required fields, unsafe derived contrast, and unapproved assets. It also proves the safe fallback path.
3. ESLint restrictions and code review prevent direct database imports, raw theme values, arbitrary provider data, and ad hoc formatting inside `src/ui` and route compositions. The token file is the only intentional home for global literal color values.
4. Testing Library queries by role, label, and visible text, and uses `userEvent` for interaction. Vitest covers pure contracts. The foundation uses Playwright for the showcase smoke path, and the standard job feature uses it for the real customer and admin journey. `@axe-core/playwright` is a targeted regression check, combined with manual keyboard, reduced motion, and contrast review, not a claim of complete conformance by itself.
5. The project quality gate remains `pnpm check`, with the browser suite and manual keyboard review added to the foundation verification path.

**Verification contract**:

1. A v1 shop fixture resolves the safe app theme without rewriting its settings, and a v2 OkPrints fixture resolves the approved local logo, identity, closed token map, and contrast safe foreground choices.
2. Invalid schema versions, missing required branding fields, malformed hex values, unapproved asset keys, unsafe text roles, and stale expected shop versions fail validation or return the documented safe error without a successful write.
3. A public shop slug, an authorized admin session, and a validated guest grant each resolve only their own server shop context. A browser supplied shop id cannot select a theme.
4. Theme variables are set once at the server rendered shell. Descendants render through semantic token classes, and browser output contains no shop id, shop version, raw settings, private key, database record, or provider credential.
5. Formatter tests prove exact integer paisa output, the `Quote required` label, local calendar date formatting, and UTC instant formatting in `Asia/Karachi`.
6. Fixture based component tests and the `/dev/ui` smoke path cover fields, statuses, feedback, upload progress, tables, overlays, logo fallback, long content, delayed JavaScript, keyboard focus, reduced motion, and narrow layouts. The live customer and admin journey is verified by the standard job feature.

**Rollout**:

New shared UI code follows this standard immediately. The foundation implementation replaces the starter page and builds tokens, primitives, shells, formatters, status adapters, and fixture based `/dev/ui` compositions. The live standard job route through pickup and the admin production workspace remain owned by the separate standard job feature, which must use this foundation. There is no broad migration because the repository has no existing production UI to migrate.

**Exceptions**:

1. Status colors may use the fixed status token family because they communicate workflow meaning, not store branding.
2. The theme resolver and fallback may contain literal palette values in the token source. Page and component code may not.
3. A dialog, drawer, or file picker may require client JavaScript, but the surrounding page still renders semantic content and an understandable recovery path.
4. A feature may add a new pattern when the standard job proves a repeated need. It must keep the same field, status, formatting, theme, and accessibility contracts.

## Consequences

**Positive**:

1. Customers get a trustworthy mobile path, and admins get an information dense workspace without separate visual systems.
2. Store branding is future ready without adding a new data table or coupling the browser to a provider website.
3. Accessibility, failure states, formatting, and status language become reusable contracts rather than review reminders.
4. Source owned components keep the application able to fix behavior and styling without waiting for a runtime library release.

**Negative and tradeoffs**:

1. The first UI slice takes longer because focus, contrast, server errors, loading, empty states, and mobile behavior are built together.
2. The team must learn Base UI composition, token resolution, and the project contracts. Radix examples cannot be copied without translation.
3. Store customization is deliberately narrow. There is no admin theme editor, arbitrary CSS, per store typography, or per store layout in the pilot.
4. The project must maintain contrast tests, approved assets, and fallback warnings as stores and tokens grow.

**Neutral**:

1. Dark mode is not shipped in the pilot, but component classes do not prevent it later.
2. The foundation adds UI dependencies and the Axe Playwright test dependency to the lockfile.
3. Storybook, a general data grid, a full design token editor, and a large pattern catalogue remain outside this slice.

## Follow-up

1. [ ] Capture `shadcn` conventions in `src/ui/AGENTS.md` because they affect shared interface code and are not yet recorded there.
2. [ ] Capture `shadcn-baseui` conventions in `src/ui/AGENTS.md`, especially the Base UI `render` API and the absence of Radix `asChild` patterns.
3. [ ] Capture `lucide-icons` conventions in `src/ui/AGENTS.md`, including tree shaken imports and accessible icon labels.
4. [ ] Capture `web-styling-cva` conventions in `src/ui/AGENTS.md`, including typed variants, defaults, and compound variants.
5. [ ] Design an admin branding editor as a separate feature only after a second store or a real pilot operating need makes it worthwhile.
