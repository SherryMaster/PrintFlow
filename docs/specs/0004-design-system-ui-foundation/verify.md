# Verify: Design system and UI foundation · spec 0004 · updated 2026-09-23

_These steps follow the six numbered items in the spec's verification contract. `/check verify` may run them, and `/test` may lock durable behavior._

## UI and manual

- [x] Open `/dev/ui` at 390 pixels and 1440 pixels. Confirm the customer form, order summary, admin navigation, queue, status labels, and mobile cards are readable without horizontal scrolling. Check a long store name and long order content. (V6)
- [x] Use Tab, Shift Tab, Enter, and Escape through fields, navigation, dialog, and drawer. Confirm visible focus, accessible titles, focus trapped inside an open overlay, and focus restored to its trigger. (V6)
- [x] Open the showcase with reduced motion enabled. Confirm the same information and controls remain available without essential animation. (V6)
- [x] Block the logo request. Confirm the store name appears in the reserved identity space and the page still works. (V1, V6)
- [x] Delay JavaScript. Confirm headings, order context, fixture rows, labels, and inline recovery guidance remain readable before hydration. (V6)
- [x] Interrupt an upload in the fixture. Confirm the progress label changes to an interruption message, the important failure remains inline, and retry guidance is clear. (V6)
- [x] Open `/dev/ui` in a production build and confirm a 404 response. Open `/` and confirm a usable page with no fixture customer data. (V6)

## Contract and source checks

- [x] Resolve a `shop_settings.v1` row. Confirm it remains unchanged and displays the safe app theme with its shop name. Resolve a `shop_settings.v2` OkPrints row. Confirm the approved local logo, identity, complete semantic token map, and contrast safe foreground choices. (V1)
- [x] Try an invalid settings version, missing branding field, malformed hex color, unapproved asset key, and unsafe foreground pairing. Confirm each fails validation or resolves to the safe theme with a structured warning. (V2)
- [x] Try a reviewed settings update with the current `shops.version`, then repeat with the stale version. Confirm only the current version writes the full validated settings, increments the version, and changes `updated_at`; the stale attempt returns a conflict. (V2)
- [x] Resolve the public shop through its approved slug, the admin through `authorizeAdminSession`, and a guest through a validated grant. Vary each shop context and confirm its theme belongs only to that shop. Submit a browser supplied shop id and confirm it cannot select a theme. (V3)
- [x] Inspect rendered customer and admin markup. Confirm CSS variables appear at the shell boundary and no shop id, shop version, raw settings document, private asset key, provider credential, or database row crosses into the browser output. (V4)
- [x] Vary integer paisa input across zero, grouping, decimals, and a value larger than JavaScript's safe integer. Confirm exact `PKR` formatting. Pass a null quote value and confirm `Quote required`. (V5)
- [x] Compare a requested local calendar date with a UTC instant near midnight. Confirm the date keeps its calendar day and the instant displays in `Asia/Karachi`. Reject an invalid date and an instant without a timezone. (V5)
- [ ] Vary catalog configuration, order status, admin queue row, upload session, and form error inputs when the standard job route is built. Confirm each visible value comes from its named domain adapter or Zod issue path, not a fixture or ad hoc page calculation. (V3, V4, V6)

## Commands

- [x] `pnpm check` passes formatting, lint, types, unit tests, and production build. (V1, V2, V5, V6)
- [x] `pnpm exec playwright test` passes the showcase, phone layout, Axe, dialog focus, and logo fallback checks. (V6)

## Verification contract coverage

V1: theme fixtures and logo. V2: invalid branding and settings version conflicts. V3: trusted shop selection. V4: server theme boundary and browser output. V5: PKR and local time formatting. V6: responsive, accessible, resilient interface behavior.
