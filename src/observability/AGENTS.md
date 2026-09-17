# Observability

## Overview

This area owns structured application logging plus Sentry error and trace setup. It should make production failures actionable while keeping customer data, private tokens, and provider secrets out of telemetry.

## Key files

| File | Owns |
|---|---|
| `docs/specs/0001-stack-architecture/index.md` | Current logging, monitoring, and alerting decisions |

## Conventions

- Use structured Vercel logs for request context and Sentry for grouped errors and traces.
- Initialize monitoring at the framework boundaries recommended for the installed Next.js version.
- Include stable operation, order, outbox, and request identifiers when they help connect related events.
- Keep raw guest tokens, upload capabilities, customer contact details, artwork names, and provider secrets out of logs and Sentry payloads.
- Report exhausted background work and permanent provider failures so the operator can act on them.

## Gotchas

- Private guest links and recovery values are credentials. Redact them before recording request URLs or context.
- Monitoring code must not turn an application failure into a second failure.

## Agent skills

- [sentry-sdk-setup](../../.agents/skills/sentry-sdk-setup/): `getsentry/sentry-for-ai`, Next.js SDK setup and verification for this area

## Related specs

- [Stack and architecture](../../docs/specs/0001-stack-architecture/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
