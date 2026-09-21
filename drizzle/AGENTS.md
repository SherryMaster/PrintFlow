# Database migrations

## Overview

This area owns versioned Drizzle migrations and their schema snapshots for the `app` Postgres schema.

## Conventions

1. Generate migrations from the Drizzle schema and review them before applying them.
2. Run migrations only against the verified direct Supabase endpoint and migration role.
3. Keep runtime application traffic on the pooled connection and never migrate through the pooler.
4. Preserve shop ownership keys, immutable fact protections, operational indexes, and restricted runtime grants in migration review.

## Commands

Use `pnpm db:generate`, `pnpm db:check`, `pnpm db:review`, `pnpm db:preflight`, and `pnpm db:migrate` from the project root.

## Related spec

[Shop and order data model](../docs/specs/0003-shop-order-data-model/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
