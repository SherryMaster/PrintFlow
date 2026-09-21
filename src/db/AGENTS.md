# Database

## Overview

This area owns the Postgres schema, the Drizzle runtime client, database environment checks, numeric contracts, and transaction boundaries for PrintFlow.

## Conventions

1. Keep business tables in the `app` schema and preserve composite shop ownership keys on child relationships.
2. Use `DATABASE_URL` for the pooled runtime client and `DATABASE_DIRECT_URL` for reviewed migration commands.
3. Create one module scoped Postgres.js client with one connection, prepared statements disabled, verified TLS, and bounded lifetime settings.
4. Store money as integer `bigint` values in SQL and decimal strings in JSON. Canonicalize typed values before request fingerprinting.
5. Keep expected version checks, idempotency, and outbox writes inside the same command transaction.

## Key files

`schema.ts` defines the tables and relations. `client.ts` defines the runtime connection. `contracts.ts` defines money, measurements, fingerprints, and rounding. `environment.ts` validates runtime and migration endpoints. `transaction.ts` classifies transaction outcomes.

## Related spec

[Shop and order data model](../../docs/specs/0003-shop-order-data-model/index.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
