# User interface

## Overview

This area owns shared interface primitives used by customer and admin pages. It keeps accessible interaction patterns and complex client form behavior consistent without moving trusted validation into the browser.

## Key files

| File                                          | Owns                                                      |
| --------------------------------------------- | --------------------------------------------------------- |
| `src/app/globals.css`                         | Global Tailwind CSS import, theme tokens, and page colors |
| `docs/specs/0001-stack-architecture/index.md` | Current interface, form, and data loading decisions       |

`src/ui/primitives/` owns source owned Base UI primitives. `patterns/` contains shared fields, feedback, status, and table patterns. `shells/` owns responsive customer and admin layouts. `theme/` owns branding schemas and trusted theme resolution. `formatters/` and `status/` centralize local presentation rules.

## Conventions

- Use Tailwind CSS and project owned shadcn/ui components for shared interface primitives.
- Build on the source owned Base UI primitives in `src/ui/primitives` and pass trusted presentation data through props.
- Keep shared UI independent of database, storage, and job modules; resolve that data in trusted server adapters.
- Prefer Server Components. Add a Client Component only where browser state or interaction requires it.
- Use native forms for simple actions and React Hook Form for complex client form state.
- Validate all untrusted input with Zod at the server boundary. Client validation is guidance, not authority.
- Build keyboard access, visible focus, clear labels, useful feedback, and responsive layouts into shared components.
- Use targeted Axe checks and keyboard review for representative interactive UI compositions.
- Keep customer facing text in English, currency in PKR, and dates in Lahore local time unless a later spec changes the rule.

## Gotchas

- A valid client form can still contain untrusted data. Server Actions and Route Handlers must validate again and enforce authorization.
- Shared components must work on customer phones and in the admin workspace.

## Agent skills

- [react-hook-form](../../.agents/skills/react-hook-form/): `pproenca/dot-skills`, complex client form state and performance for this area

## Related specs

- [Stack and architecture](../../docs/specs/0001-stack-architecture/index.md)
- [Design system and UI foundation](../../docs/specs/0004-design-system-ui-foundation/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
