# Database scripts

## Overview

This area owns the safety checks that run before migrations and the review of data model migrations.

## Conventions

1. Validate the direct Supabase endpoint, migration role, certificate, and project match before opening database access.
2. Reject pooler and cross project migration URLs before any migration work.
3. Review migration SQL for required tables, ownership constraints, indexes, immutable fact triggers, and runtime grants.
4. Keep checks deterministic and avoid printing credentials or certificate contents.

## Key files

`check-migration-connection.mjs` validates migration environment and connectivity. `review-data-model-migrations.mjs` audits the generated migration set.

## Related spec

[Shop and order data model](../docs/specs/0003-shop-order-data-model/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
