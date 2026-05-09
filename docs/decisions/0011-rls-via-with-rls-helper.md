# ADR-0011: RLS via `withRls()` helper, not Prisma client extension, until SaaS flip

**Status**: Accepted
**Date**: 2026-05-09

## Context

Phase 1 (Foundation + Auth) requires a multi-tenant safety net beyond the
existing `tenantDb(userId)` wrapper. PRINCIPLES.md commits us to RLS as
"belt-and-suspenders". Two paths:

1. **`withRls(userId, tx => …)` helper** — explicit transaction wrapper,
   `set_config('app.user_id', X, true)` as the first statement, callsite-driven.
2. **Prisma client extension `$extends({ query })`** — global hook that wraps
   every operation in a transaction and sets the GUC automatically.

Architecture research (`.planning/research/ARCHITECTURE.md` HIGH confidence)
documented:

- `$extends` doubles round-trips per query (every query becomes a transaction).
- Prisma Issue #23583 (interactive transactions in extensions cause blocking
  under load) is open and known.
- `tenantDb`'s existing tests assume non-transactional reads — the extension
  would silently break them.
- The `$extends` route makes sense only when *every* query path needs RLS
  set automatically — which is true for SaaS (untrusted code might forget),
  but not for single-user Lean where every callsite is reviewed.

## Decision

Use `withRls(userId, async tx => …)` for any multi-statement tenant operation.
Use `tenantDb(userId)` for single-row reads (RLS is the safety net via the
policy on the table; the policy fires on raw SQL even outside `withRls` —
returning zero rows when `app.user_id` is unset, which is the correct
failure mode).

Do NOT add a `$extends({ query })` block to `core/db/client.ts` for Lean.

## Consequences

### Positive

- No double round-trip on simple reads.
- No conflict with existing `tenantDb` test surface.
- Avoids the open Prisma Issue #23583 blocking risk.
- Explicit `withRls` callsites make the "this op is multi-statement and atomic"
  intent visible at the call site.

### Negative

- Two layers of safety, two callsite shapes (`tenantDb` vs `withRls`). Document
  the split in `core/db/README.md`. Code review must catch any raw `prisma.*`
  outside `core/db/` (already enforced by `dependency-cruiser:no-direct-prisma`).
- A future contributor unfamiliar with the split could write a Server Action
  that uses neither — RLS catches it (returns zero rows; query fails fast),
  but the failure surface is "your query mysteriously returns nothing" rather
  than "compile error". Mitigation: ESLint rule + grep audit at code review.

## When we'd reconsider

- **SaaS flip** — when the codebase is no longer single-author and every
  Prisma access is no longer code-reviewed by the architect, the global
  `$extends` extension becomes worth its cost.
- **Prisma fixes Issue #23583** — re-evaluate the blocking concern.
- **Connection pool exhaustion under multi-user load** — if `withRls`
  transactions become the bottleneck, switch to a hybrid: keep `withRls`
  for explicit multi-statement work, add `$extends` for single-statement
  reads to amortize the GUC set across many queries.

## References

- `.planning/research/ARCHITECTURE.md` §"Where RLS hooks in (concrete) — Step 3"
- `.planning/research/PITFALLS.md` §"Pitfall 2"
- [Prisma Issue #23583](https://github.com/prisma/prisma/issues/23583)
- [Prisma Issue #17948](https://github.com/prisma/prisma/issues/17948)
- [PostgreSQL Docs — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## Supersedes

None. Establishes the RLS implementation pattern locked by Phase 1.
