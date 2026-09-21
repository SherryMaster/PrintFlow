# Catalog commands

## Overview

This area owns publication of immutable service and price rule versions for a shop.

## Conventions

1. Parse service definitions and price rules through the shared order validation schemas.
2. Publish only matching draft versions inside the requested shop and service.
3. Record catalog lifecycle facts and shop activity in the same transaction as the publication.
4. Retire or publish catalog versions without mutating submitted order snapshots.

## Key files

`commands.ts` publishes a service version and its price rule version.

## Related spec

[Shop and order data model](../../../docs/specs/0003-shop-order-data-model/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
