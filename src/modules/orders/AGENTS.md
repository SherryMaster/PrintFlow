# Order commands

## Overview

This area owns order drafts and submission, job lifecycle, quote revisions, artwork and proofs, guest grants, order projections, and shared order validation.

## Conventions

1. Keep every command shop scoped and protect mutations with idempotency keys or expected aggregate versions.
2. Preserve submitted configurations, measurements, catalog references, prices, approvals, and corrections as immutable facts or versioned snapshots.
3. Derive current progress and blockers from current job revisions and decisions, while recording meaningful mutations in append only activity.
4. Keep administrator and guest authority narrow. Store guest token hashes and encrypt capabilities only for delivery.
5. Keep database commands behind server only boundaries and use the shared schemas for input and event payload validation.

## Key files

`commands.ts` handles drafts and order submission. `lifecycle.ts` handles jobs, cancellation, collection, notes, and production exceptions. `quotes.ts` handles quote replacement and responses. `artwork.ts` handles artwork and proofs. `grants.ts` handles guest links. `queries.ts` builds administrator and guest projections. `model.ts` contains pure lifecycle and amount rules. `validation.ts` contains versioned data contracts.

Shop settings schemas are defined in `src/ui/theme/branding.ts` and re-exported by `validation.ts` for existing domain callers.

## Related spec

[Shop and order data model](../../../docs/specs/0003-shop-order-data-model/index.md)

[Design system and UI foundation](../../../docs/specs/0004-design-system-ui-foundation/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
