# Development UI showcase

## Overview

This area owns the `/dev/ui` showcase for customer and admin interface patterns. It uses fixture data and shared UI components, not live order journeys.

## Conventions

- Keep the production `notFound()` guard in `page.tsx` so the showcase is unavailable in production.
- Use fixture data only; do not query shop or order records or mutate domain state.
- Exercise shared components from `src/ui` while preserving responsive, keyboard, and accessibility behavior.
- Keep component tests beside showcase components and maintain the browser coverage in `e2e/ui-foundation.spec.ts`.

## Checks

- `pnpm test`
- `pnpm exec playwright test e2e/ui-foundation.spec.ts`

## Related spec

- [Design system and UI foundation](../../../../docs/specs/0004-design-system-ui-foundation/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
