# Shop commands

## Overview

This area owns validated pilot shop bootstrap and the first administrator membership.

## Conventions

1. Accept only the pilot timezone, currency, reference prefix, and validated settings.
2. Make bootstrap idempotent through the canonical request fingerprint and a retained result snapshot.
3. Create the shop, administrator membership, actor snapshot, reference counter, activity entry, and idempotency record in one transaction.
4. Reject a changed request that reuses an existing bootstrap key.
5. Validate theme branding on bootstrap and settings updates; require the expected shop version for later settings writes.

## Key files

`commands.ts` bootstraps the shop. `authorization.ts` checks active administrator sessions within the shop.

`commands.ts` also updates validated settings with an expected version. `theme.ts` resolves approved public shops and shop themes from trusted administrator, guest, or public context.

## Related spec

[Shop and order data model](../../../docs/specs/0003-shop-order-data-model/index.md)

[Design system and UI foundation](../../../docs/specs/0004-design-system-ui-foundation/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
