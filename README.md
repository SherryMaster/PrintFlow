# PrintFlow

PrintFlow is a responsive web application for accepting digital print jobs and managing them through pickup.

## Local development

Use Node.js 24.21.0 and pnpm 12.4.2.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The product scope lives in [`docs/scope/scope.md`](docs/scope/scope.md). The stack and architecture decision lives in [`docs/specs/0001-stack-architecture/index.md`](docs/specs/0001-stack-architecture/index.md).
