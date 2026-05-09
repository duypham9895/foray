# ADR-0002: Multi-tenant-ready schema, single-user implementation

**Status**: Accepted
**Date**: 2026-05-09

## Context

The owner wants a personal tool first, with the option to flip to public SaaS later. Two architectural shapes:

1. **Single-user, hard-coded**: no `userId` columns, single config singleton. Simpler now, painful migration later.
2. **Multi-tenant-ready, single-user runtime**: `userId` on every row from day one, but no auth UI and a hard-coded user record. Slightly more discipline now, zero schema migration on flip.

## Decision

Schema has `userId` on every user-owned table (Application, Company, Stage, Event, Email, Document, Recruiter) from day one. Runtime gate is a single env-var password (`APP_PASSWORD`) and a single seeded user with `id=1`. Auth UI is deferred to v2.

## Consequences

### Positive

- **Future flip is non-disruptive.** Going public requires: replace password gate with Clerk, remove `id=1` defaults, add OAuth signup flow. No schema migration, no data backfill.
- **Discipline now, dividends later.** Forces every query to think about tenant boundaries from day one. Common multi-tenancy bugs (missing `userId` filter) get caught early.
- **Safe queries by default.** A helper `getCurrentUser()` returns the single user; all queries `WHERE userId = currentUser.id`. When real auth lands, only `getCurrentUser()` changes.

### Negative

- **A handful of `userId = 1` defaults in Prisma schema.** Slightly noisy but harmless.
- **Cognitive overhead for v1.** Developer (and AI agents) must remember to include `userId` on creates. Mitigated by Prisma's required-field enforcement.

## Alternatives rejected

- **Skip `userId` entirely until going public.** Migrating a populated DB to add `userId` everywhere is fragile (NULL handling, constraint adds, RLS retrofits). Cheaper to add it now even if it's redundant.
- **Build full auth from day one.** Wastes time on UI and OAuth verification for a single user. See [ADR-0003](./0003-local-first.md) for hosting-related context.

## References

- Pattern: similar to how Plane.so, Cal.com self-host their multi-tenant primitives even for solo deployments.
