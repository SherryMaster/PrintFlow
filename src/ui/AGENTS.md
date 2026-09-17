# User interface

## Overview

This area owns shared interface primitives used by customer and admin pages. It keeps accessible interaction patterns and complex client form behavior consistent without moving trusted validation into the browser.

## Key files

| File | Owns |
|---|---|
| `src/app/globals.css` | Global Tailwind CSS import, theme tokens, and page colors |
| `docs/specs/0001-stack-architecture/index.md` | Current interface, form, and data loading decisions |

## Conventions

- Use Tailwind CSS and project owned shadcn/ui components for shared interface primitives.
- Prefer Server Components. Add a Client Component only where browser state or interaction requires it.
- Use native forms for simple actions and React Hook Form for complex client form state.
- Validate all untrusted input with Zod at the server boundary. Client validation is guidance, not authority.
- Build keyboard access, visible focus, clear labels, useful feedback, and responsive layouts into shared components.
- Keep customer facing text in English, currency in PKR, and dates in Lahore local time unless a later spec changes the rule.

## Gotchas

- A valid client form can still contain untrusted data. Server Actions and Route Handlers must validate again and enforce authorization.
- Shared components must work on customer phones and in the admin workspace.

## Agent skills

- [react-hook-form](../../.agents/skills/react-hook-form/): `pproenca/dot-skills`, complex client form state and performance for this area

## Related specs

- [Stack and architecture](../../docs/specs/0001-stack-architecture/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
