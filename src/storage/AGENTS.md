# Storage

## Overview

This area owns server side access to private artwork in Cloudflare R2. It keeps upload authorization, quarantine, validation, final object keys, downloads, and retention behind one storage boundary.

## Key files

| File                                          | Owns                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `docs/specs/0001-stack-architecture/index.md` | Current storage security and lifecycle decisions |

## Conventions

- Keep every bucket private and keep R2 credentials in server only code.
- Let browsers upload through short lived presigned URLs after the server validates the draft capability and reserves the requested bytes.
- Put new uploads in a quarantine prefix. Accept an object only after checking authoritative metadata and required signature bytes.
- Copy an accepted object to a fresh server chosen key. Persist its key, ETag, measured size, and content type before removing the quarantine object.
- Treat every file as untrusted. Downloads use attachment disposition, and browser previews never replace the original.
- Keep validation reads bounded. Expensive file transformation needs a separate worker decision.

## Gotchas

- An upload intent can complete once. A reused URL must never alter an accepted object.
- The current limits are 250 MB per file, 500 MB per draft, a 24 hour draft lifetime, and a 15 minute upload URL lifetime.
- Retention work must not delete files for active orders.

## Agent skills

- [cloudflare-r2](../../.agents/skills/cloudflare-r2/): `secondsky/claude-skills`, private buckets, uploads, CORS, and presigned URLs for this area

## Related specs

- [Stack and architecture](../../docs/specs/0001-stack-architecture/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
