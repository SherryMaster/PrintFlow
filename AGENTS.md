<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack

Managed TypeScript modular monolith: Next.js App Router, Tailwind CSS and shadcn/ui, Supabase Postgres and Auth, Drizzle ORM, Cloudflare R2, Resend, Inngest, Vercel, Sentry, Vitest, Testing Library, Playwright, and GitHub Actions.

The current scaffold uses Node.js 24.x, pnpm 12.4.2, Next.js 16.3.5, and React 19.2.8. Other services in the selected stack are planned but not installed yet.

## Build approach

Tracer Bullet (make one real order work through the whole app, then expand that working path).

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm exec vitest run
pnpm exec playwright test
```

## Rules

- Keep TypeScript in strict mode.
- Use `@/*` for imports rooted at `src`.
- Keep unit tests beside source files as `*.test.ts` or `*.test.tsx`.
- Keep browser tests in `e2e/`.
- Keep database, file, email, and background work behind server only boundaries.

## Agent skills

- [playwright-cli](.agents/skills/playwright-cli/): `microsoft/playwright-cli`, browser automation and Playwright testing.
- [pnpm](.agents/skills/pnpm/): `antfu/skills`, package management and workspace conventions.
- [drizzle](.agents/skills/drizzle/): `bobmatnyc/claude-mpm-skills`, type safe database access.
- [cloudflare-r2](.agents/skills/cloudflare-r2/): `secondsky/claude-skills`, private object storage and uploads.
- [inngest-setup](.agents/skills/inngest-setup/): `inngest/inngest-skills`, durable execution setup.
- [inngest-durable-functions](.agents/skills/inngest-durable-functions/): `inngest/inngest-skills`, retry safe background work.
- [zod](.agents/skills/zod/): `pproenca/dot-skills`, schema validation.
- [react-hook-form](.agents/skills/react-hook-form/): `pproenca/dot-skills`, complex client form state.
- [vitest](.agents/skills/vitest/): `antfu/skills`, unit test conventions.
- [react-testing-library](.agents/skills/react-testing-library/): `itechmeat/llm-code`, accessible component tests.
- [github-actions-templates](.agents/skills/github-actions-templates/): `wshobson/agents`, GitHub Actions workflows.
- [sentry-sdk-setup](.agents/skills/sentry-sdk-setup/): `getsentry/sentry-for-ai`, error monitoring setup.
- [typescript-advanced-types](.agents/skills/typescript-advanced-types/): `wshobson/agents`, advanced TypeScript type design.
- [tailwind-css-patterns](.agents/skills/tailwind-css-patterns/): `giuseppe-trisciuoglio/developer-kit`, Tailwind CSS layout and styling patterns.

MCP servers: Playwright (`@playwright/mcp@latest`, connected).
