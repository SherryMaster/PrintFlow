# Jobs

## Overview

This area owns durable background work and the dispatcher that connects committed outbox records to external effects. Jobs may retry, so every step must be safe to run again after a crash or uncertain provider result.

## Key files

| File | Owns |
|---|---|
| `docs/specs/0001-stack-architecture/index.md` | Current outbox, retry, lease, and failure decisions |

## Conventions

- Record required background work in the Postgres outbox inside the same transaction as the business change.
- Use the outbox UUID as the event and effect idempotency key.
- Keep Inngest steps bounded and put external calls inside retry safe steps.
- Record each attempted external effect before calling its provider. Reconcile an uncertain result before another attempt.
- The dispatcher runs each minute, claims at most 100 committed rows, and uses `FOR UPDATE SKIP LOCKED` with a five minute lease.
- Retry transient failures at most eight times across 24 hours. Mark permanent or exhausted failures as `dead`, keep them visible, and alert the operator.

## Gotchas

- A provider may accept work even when its response is lost. A retry must not create a second logical email or file operation.
- An expired claim returns to pending. Code must tolerate another worker continuing the same outbox item.

## Agent skills

- [inngest-setup](../../.agents/skills/inngest-setup/): `inngest/inngest-skills`, client setup, serve endpoints, and local development for this area
- [inngest-durable-functions](../../.agents/skills/inngest-durable-functions/): `inngest/inngest-skills`, retry safe steps, idempotency, cancellation, and observability for this area

## Related specs

- [Stack and architecture](../../docs/specs/0001-stack-architecture/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
