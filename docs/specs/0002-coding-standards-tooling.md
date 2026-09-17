# 0002. Coding standards and tooling

**Date**: 2026-09-17
**Status**: Accepted

## Summary

Prettier will provide one repository wide format, while ESLint will remain responsible for code quality rules. Local scripts and GitHub Actions will run the same formatting, lint, type, test, and production build checks. This gives every later slice a fast and repeatable quality gate before merge.

## Context

The scaffold already has strict TypeScript, Next.js ESLint rules, Vitest, Playwright, and a production build command. It has no formatter, no aggregate local check, and no continuous integration workflow. A contributor can therefore produce a passing local change whose layout differs from nearby files, or forget one of the required checks before review.

The source is still small and mostly follows generated Next.js conventions. There is no costly legacy formatting split to preserve. This is the lowest risk point to establish a repository wide standard and format existing supported files once.

The routine gate must be useful to a small team. It should catch deterministic failures without adding local hook maintenance, duplicate lint systems, production secrets, or a browser test cost to every change.

## Requirements

**User stories**:

- As a contributor, you want one formatting command and one complete quality command so you can prepare a change without remembering separate tool details.
- As a maintainer, you want pull requests and changes to `master` checked in a clean environment so broken formatting, lint, types, tests, or production builds cannot pass unnoticed.
- As a future contributor, you want the repository guidance to name the same commands that automation runs so local and remote expectations stay aligned.

**Acceptance criteria**:

- **AC-1**: `prettier` is pinned at exactly `3.9.7`. `pnpm format` rewrites every supported file discovered by `prettier .` after Prettier defaults, root `.gitignore`, and root `.prettierignore` are applied. `pnpm format:check` passes immediately afterward without changing files.
- **AC-2**: On a clean checkout with dependencies installed from the committed lockfile, `pnpm check` runs formatting validation, ESLint, TypeScript validation, Vitest, and the production build in that order, and all five checks pass.
- **AC-3**: With a temporary root `format-check-fixture.md` whose contents differ from Prettier output, both `pnpm format:check` and `pnpm check` exit unsuccessfully and report that file. Its byte hash is identical before and after each command, proving that neither check rewrites it. The fixture is removed after verification and is never committed.
- **AC-4**: The `CI` workflow runs one `quality` job for pull requests targeting `master` and pushes to `master`. It uses the exact runner, permissions, cancellation, required action major tags, repository declared Node.js and pnpm versions, pnpm cache, frozen lockfile install, timeout, and credential boundary defined in this spec.
- **AC-5**: The CI `quality` job invokes `pnpm check`, then `git diff --exit-code` proves that no tracked file changed. The job completes successfully for the formatted scaffold from a clean dependency install. Ignored generated output may be created during checks.
- **AC-6**: Root `AGENTS.md` lists `pnpm format`, `pnpm format:check`, `pnpm test`, and `pnpm check`, and identifies `pnpm check` as the routine local quality gate. Existing framework, type, test location, and server boundary guidance remains intact.
- **AC-7**: Playwright, mandatory Git hooks, ESLint formatting rules, and a Tailwind formatting plugin are not added to the routine quality gate.

## Options considered

### Option 1: Prettier with independent ESLint

Prettier owns file layout. ESLint keeps semantic and framework rules, with no formatter rules added to ESLint.

**Pros**:

- Mature support for the repository's TypeScript, React, CSS, JSON, YAML, and Markdown files
- Clear ownership between formatting and code quality checks
- Small change to the existing Next.js scaffold

**Cons**:

- Adds another development dependency and command
- Formatting and linting remain two separate checks

### Option 2: Biome for formatting with ESLint retained

Biome formats supported files while the existing Next.js ESLint setup remains in place.

**Pros**:

- Fast formatter with one configuration surface if more Biome features are adopted later
- Can format the main TypeScript and JavaScript source set

**Cons**:

- Introduces a broader tool whose lint features overlap with ESLint
- Support and output across repository documentation and configuration files require more exceptions

### Option 3: dprint with plugins

dprint formats each file family through selected plugins while ESLint remains unchanged.

**Pros**:

- Fast and explicit plugin based formatting
- Good control over which file families are handled

**Cons**:

- Adds plugin selection and update work for a small repository
- Is less familiar in the existing Next.js and pnpm toolchain

## Decision

**Chosen option**: Option 1, Prettier with independent ESLint

Use Prettier `3.9.7` defaults for files discovered by the root `prettier .` invocation. Pin the dependency exactly and treat later upgrades as reviewed formatting migrations. Root `.gitignore`, root `.prettierignore`, and Prettier defaults are the authoritative formatting scope. Run formatting as its own check before the existing lint, type, test, and build checks.

**Implementation skills**: `pnpm` (`antfu/skills`, `.agents/skills/pnpm/`) · `github-actions-templates` (`wshobson/agents`, `.agents/skills/github-actions-templates/`)

## Rationale

The project already trusts the Next.js ESLint configuration for semantic rules, so replacing or duplicating it would create migration work without solving a present problem. Prettier adds the missing deterministic layout layer with little configuration and covers the mix of code, styles, configuration, and documentation in this repository.

One local aggregate command and one CI job keep the first implementation easy to understand. Separate jobs could shorten feedback later, but they would repeat setup and dependency installation for a scaffold whose full suite is currently small. Biome is the runner up if the project later chooses to replace ESLint as well, since adopting only its formatter leaves two broad code analysis tools in the project.

## Standard definition

**Canonical pattern**:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  },
  "devDependencies": {
    "prettier": "3.9.7"
  }
}
```

Prettier uses its defaults. `.prettierignore` contains these root relative exclusions:

```gitignore
/.agents/
/skills-lock.json
/.next/
/coverage/
/playwright-report/
/test-results/
/next-env.d.ts
/pnpm-lock.yaml
```

The formatting scope is exactly the supported files discovered by `prettier .` after Prettier defaults, root `.gitignore`, and root `.prettierignore` are applied. Those ignore files are the only repository sources for exclusions. When a new generated or vendored path should remain outside formatting, its introducing change must add that path to one of those files.

The GitHub Actions workflow is named `CI` and has one job named `quality`. It runs on pull requests targeting `master` and pushes to `master`. The job:

1. Uses the `ubuntu-24.04` runner.
2. grants only `contents: read` permission.
3. cancels an older run for the same workflow and Git reference.
4. checks out the repository with `actions/checkout@v4`.
5. enables pnpm with `pnpm/action-setup@v4`, reading the exact version from `package.json#packageManager`.
6. configures Node.js and pnpm dependency caching with `actions/setup-node@v4`, reading the exact Node.js version from `.node-version`.
7. treats `package.json#engines.node` as the supported Node.js compatibility range, not the CI version source.
8. runs `pnpm install --frozen-lockfile`.
9. runs `pnpm check`, then runs `git diff --exit-code` to prove that tracked files remain unchanged.
10. has a twenty minute timeout and receives no repository, environment, or production secrets. The read only ephemeral GitHub token used by checkout is allowed.

The three named action major versions are required until a reviewed tooling change updates them. Node.js and pnpm version changes update their repository declarations, which the workflow consumes without duplicate version literals.

**Replaces**:

- Manual layout choices that are not checked before merge
- Running only a convenient subset of lint, type, test, and build checks
- Formatting through ESLint rules or editor specific settings

**Enforcement**:

`pnpm format:check` fails when a supported file differs from Prettier output. `pnpm check` is the canonical local quality gate. The observed `CI / quality` status from GitHub Actions is the canonical merge gate and should be required on `master` once the workflow exists. CI reports differences and never rewrites a contributor's branch. The final `git diff --exit-code` step enforces that no tracked file changed during the job.

ESLint remains the only linter. TypeScript remains the type authority. Vitest provides routine automated tests. `next build` proves the production bundle. Playwright stays outside this routine job, including the existing scaffold smoke test, and may become a separate required job when product browser journeys justify its browser installation and runtime cost.

**Rollout**:

Use one migration change. Add the exact Prettier dependency, scripts, ignore rules, and CI workflow, then run `pnpm format` across the accepted file scope. Update the root `AGENTS.md` command list with `pnpm format`, `pnpm format:check`, `pnpm test`, and canonical `pnpm check`. Review the mechanical formatting separately from later product work.

**Exceptions**:

Unsupported files and paths excluded by Prettier defaults, root `.gitignore`, or root `.prettierignore` remain outside formatting. There are no prose based exceptions beyond those executable sources.

## Build plan

The project uses a Tracer Bullet approach. You may first establish one complete path from a contributor command through the remote quality job, then finish the repository wide migration on that proven path.

1. Add exact `prettier` `3.9.7`, the `format`, `format:check`, `test`, and ordered `check` scripts, plus the recorded `.prettierignore`. Add the single `CI` workflow with the specified triggers, least privilege permissions, cancellation, repository sourced runtime versions, cache, frozen lockfile install, timeout, credential boundary, `pnpm check`, and `git diff --exit-code`. This establishes the thin local to CI path, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, and **AC-7**.
2. Run `pnpm format` once across the files selected by Prettier defaults, root `.gitignore`, and root `.prettierignore`. Review the mechanical changes and prove that `pnpm format:check` is clean. Create temporary root `format-check-fixture.md` with deliberately unformatted content, record its byte hash, run `pnpm format:check` and `pnpm check` separately, confirm both commands fail and the hash remains identical after each, then remove the fixture. This completes the formatting migration, satisfies **AC-1** and **AC-3**.
3. Run `pnpm check` from the migrated tree and resolve only failures required by its five declared stages. Run `git diff --exit-code` afterward. Confirm that Playwright remains outside the command and that the workflow receives no repository, environment, or production secrets while allowing checkout's read only ephemeral GitHub token, satisfies **AC-2**, **AC-4**, **AC-5**, and **AC-7**.
4. Update the root `AGENTS.md` command list and quality gate guidance without weakening its existing rules, then compare every documented command with `package.json` and the workflow, satisfies **AC-6**.
5. Push the workflow and observe one successful run. Record the displayed `CI / quality` status context so the repository administrator can configure the matching branch protection follow up, satisfies **AC-4** and **AC-5**.

## Consequences

**Positive**:

- Contributors and automation use the same quality command.
- Reviews can focus on behavior because layout is deterministic.
- Pull requests and changes merged directly to `master` receive the same checks.

**Negative / tradeoffs**:

- The first formatting pass creates a mechanical repository diff.
- The sequential CI job returns the final result more slowly than highly parallel jobs as the suite grows.
- Prettier defaults may differ from individual editor preferences.
- Browser regressions are not covered by the routine quality job.

**Neutral**:

- No mandatory Git hook is added. Contributors may format on save, but the repository scripts and CI result are authoritative.
- The formatter does not sort Tailwind utility classes because no formatting plugin is part of this decision.

## Follow-up

- [ ] The repository administrator should make the observed GitHub `CI / quality` status required for `master` after the workflow has completed successfully at least once. This external branch protection setting owns prevention of unchecked direct pushes.
- [ ] Reconsider a dedicated Prettier Agent Skill if an official or strong project specific option becomes available. The current discovery found no high confidence Prettier specific skill.
- [ ] Move Playwright into its own CI job when product browser journeys replace or extend the scaffold smoke test.
