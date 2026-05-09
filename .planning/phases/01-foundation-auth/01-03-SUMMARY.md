---
phase: "01-foundation-auth"
plan: "03"
subsystem: "core-rls"
tags: ["rls", "multi-tenant", "postgres", "migration", "testcontainers", "integration-test", "security"]
dependency_graph:
  requires:
    - "01-01 (withRls helper + @testcontainers/postgresql dep)"
    - "01-02 (auth boundary providing session userId)"
  provides:
    - "prisma/migrations/20260510000000_add_rls_and_app_role — RLS policies + foray_app role"
    - "tenantDb FND-01 mutation matrix (application CRUD+aggregate; email CRUD+count; event findMany+create; company CRUD+upsert; stage CRUD+parent-check)"
    - "tests/integration/setup.ts — Testcontainers Postgres 16 globalSetup"
    - "tests/integration/rls-escape.test.ts — 4 escape-attempt proofs"
    - "tests/integration/tenant-db-cross-tenant-leak.test.ts — application-model isolation proof"
    - "SETUP.md role-split docs — DATABASE_URL_OWNER vs DATABASE_URL"
  affects:
    - "src/core/db/tenant.ts (extended with full FND-01 matrix)"
    - "vitest.config.ts (forks pool + globalSetup + maxWorkers=1)"
    - "SETUP.md (role-split section added)"
tech_stack:
  added: []
  patterns:
    - "NULLIF(current_setting('app.user_id', true), '')::int in all RLS policies — handles both NULL (unset GUC) and '' (empty-string GUC) safely"
    - "FORCE ROW LEVEL SECURITY on all 9 tenant-scoped tables — owner bypass prevention"
    - "Testcontainers PostgreSqlContainer(.withUsername('foray_owner')) as migration role; process.env.DATABASE_URL switched to foray_app for test run"
    - "Omit<...CreateInput, 'user'> on tenantDb create methods — type-system enforces auto-inject"
    - "Stage/Document parent-scope check: verify application.userId before mutate"
key_files:
  created:
    - path: "prisma/migrations/20260510000000_add_rls_and_app_role/migration.sql"
      lines: 110
      note: "foray_app role + ENABLE/FORCE RLS on 9 tables + 9 tenant_isolation policies using NULLIF pattern"
    - path: "tests/integration/setup.ts"
      lines: 72
      note: "Testcontainers globalSetup: Postgres 16, migrations as foray_owner, seed alice+bob+apps, switch to foray_app"
    - path: "tests/integration/rls-escape.test.ts"
      lines: 90
      note: "4 tests: WHERE+RLS both filter alice's context; raw SQL inside withRls denied; raw SQL outside withRls denied; structural FORCE check"
    - path: "tests/integration/tenant-db-cross-tenant-leak.test.ts"
      lines: 55
      note: "application-model isolation test (1 passing + 4 todo for Phase 2)"
  modified:
    - path: "src/core/db/tenant.ts"
      note: "Extended: application CRUD+aggregate; email findMany/findUnique/findFirst/create/update/count; event findMany/create; company findMany/findUnique/findFirst/upsert/update; stage findMany/create/update/delete"
    - path: "vitest.config.ts"
      note: "forks pool, maxWorkers: 1, globalSetup: tests/integration/setup.ts"
    - path: "SETUP.md"
      note: "Role-split section: DATABASE_URL_OWNER vs DATABASE_URL, foray_app password setup"
decisions:
  - "NULLIF(current_setting('app.user_id', true), '')::int instead of current_setting(...)::int — handles empty-string GUC returned by Postgres when parameter exists but has no value; prevents 22P02 cast error"
  - "vitest 4 removed poolOptions.forks.singleFork; replaced with maxWorkers: 1 at top level"
  - "Test 1 (tenantDb isolation) uses withRls + tx.application.findMany rather than bare tenantDb — foray_app with FORCE RLS blocks all queries without app.user_id set; tenantDb must operate inside a withRls context in production"
  - "setup.ts uses direct prisma binary path (../../node_modules/.bin/prisma) instead of pnpm prisma — pnpm not in subprocess PATH during test globalSetup"
  - "Application seed uses INSERT SELECT from companies (not NULL for company_id) — applications.company_id is NOT NULL FK"
metrics:
  duration_seconds: 840
  completed_date: "2026-05-09"
  tasks_completed: 5
  files_created: 4
  files_modified: 3
---

# Phase 01 Plan 03: RLS Migration + tenantDb Extension + Integration Test Harness Summary

**One-liner:** Postgres RLS with FORCE + non-superuser foray_app role + 9 tenant_isolation policies (NULLIF-safe) + tenantDb FND-01 matrix + Testcontainers escape-proof test suite.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write RLS migration SQL (role + ENABLE/FORCE + policies + grants) | 97c7ae0 | prisma/migrations/20260510000000_add_rls_and_app_role/migration.sql |
| 2 | Extend tenantDb with FND-01 mutation matrix | 8ad9942 | src/core/db/tenant.ts |
| 3 | Create vitest.config.ts + Testcontainers globalSetup + SETUP.md role-split docs | 4b5a574 | vitest.config.ts, tests/integration/setup.ts, SETUP.md |
| 4 | Apply RLS migration to local Docker Postgres | (no files; DB-only) | verified: 9 tables × (t,t), foray_app role exists, 9 policies |
| 5 | Write rls-escape.test.ts + tenant-db-cross-tenant-leak.test.ts | 15dcd8f | tests/integration/rls-escape.test.ts, tests/integration/tenant-db-cross-tenant-leak.test.ts |

## Locked Invariants

| Invariant | Location | Value | Reason |
|-----------|----------|-------|--------|
| `NULLIF(current_setting(...), '')` | migration.sql all policies | wraps all `current_setting` calls | Postgres can return `''` (empty string) in addition to NULL when GUC is unset; `''::int` throws 22P02; NULLIF converts to NULL safely |
| `FORCE ROW LEVEL SECURITY` | migration.sql:38-59 | all 9 tenant tables | Without FORCE, table owner bypasses policies (Pitfall #2) |
| `is_local = true` in `set_config` | with-rls.ts:35 | third arg to set_config | Transaction-local GUC; prevents pool-reuse leak (Pitfall #2) |
| `foray_app` is non-superuser | pg_roles | `rolsuper=f, rolbypassrls=f` | Superuser / BYPASSRLS bypasses RLS silently (Pitfall #9) |
| `foray_owner` as Testcontainers username | setup.ts:17 | migration role | Separation of concerns; tests switch to foray_app after seed |
| Stage parent-scope check | tenant.ts stage.create/update/delete | verify `application.userId === numericUserId` | Belt before RLS suspenders for parent-scoped tables |

## Migration Summary

| Section | Content |
|---------|---------|
| Role | `foray_app` (idempotent DO block), LOGIN, non-superuser, `'CHANGE_ME_VIA_ENV'` placeholder password |
| Grants | USAGE on schema, SELECT/INSERT/UPDATE/DELETE on all tables + sequences; DEFAULT PRIVILEGES for future tables |
| ENABLE/FORCE | 9 tables: `users, companies, applications, stages, events, emails, recruiters, application_recruiters, documents` |
| Policies | 9 × `tenant_isolation` — direct user_id (users/companies/applications/events/emails/recruiters), parent-join (stages/application_recruiters/documents) |
| Policy expression | `user_id = NULLIF(current_setting('app.user_id', true), '')::int` |
| users exception | `id = NULLIF(...)::int` (no `user_id` column; `id` IS the user) |

## tenantDb Extension Matrix (Lean scope)

| Model | Methods added |
|-------|--------------|
| `application` | `create`, `update`, `delete`, `aggregate` (added to existing `findMany/findUnique/findFirst/count`) |
| `email` | `findMany`, `findUnique`, `findFirst`, `create`, `update`, `count` |
| `event` | `findMany`, `create` (no update — append-only) |
| `company` | `findMany`, `findUnique`, `findFirst`, `upsert`, `update` |
| `stage` | `findMany`, `create`, `update`, `delete` (parent-scope pre-flight check) |
| `recruiter`, `applicationRecruiter`, `document` | Deferred (full milestone) |

## Test Harness

| Component | Detail |
|-----------|--------|
| Testcontainers image | `postgres:16` |
| Migration role | `foray_owner` (Testcontainers default superuser) |
| Runtime role | `foray_app` (switched via `process.env.DATABASE_URL`) |
| Pool | `forks`, `maxWorkers: 1` (Vitest 4 API — no poolOptions) |
| Seed | alice (id=1) + bob (id=2) users + 1 Company + 1 Application each |
| RLS escape tests | 4 passing |
| Cross-tenant isolation tests | 1 passing (application) + 4 todo (email/event/company/stage — Phase 2) |

## RLS Escape Test Results

| Test | Assertion | Result |
|------|-----------|--------|
| alice's context sees only her rows (WHERE + RLS) | `apps.every(a => a.userId === alice) && apps.length ≥ 1` | PASS |
| raw $queryRaw inside withRls for bob's rows | `result.isOk() && result._unsafeUnwrap() === []` | PASS |
| raw $queryRaw OUTSIDE withRls | `rows === []` (no error, no data) | PASS |
| structural: all 9 tables have FORCE RLS | `rows.length === 9 && all rls=true && all force=true` | PASS |

## Downstream Consumers

| Consumer | Phase | What it reads |
|----------|-------|--------------|
| Capture + Applications slice | Phase 2 | `tenantDb.application.create/update/delete` |
| Gmail ingestion pipeline | Phase 4 | `tenantDb.email.create/update`, `tenantDb.event.create` |
| Company upsert on capture | Phase 2 | `tenantDb.company.upsert` |
| Stage management | Phase 3 | `tenantDb.stage.create/update/delete` |
| FND-03 full escape suite | Phase 5 | `rls-escape.test.ts` as baseline; adds categories (b)-(f) |
| Phase 5 structural CI check | Phase 5 | Test 4 (FORCE structural) catches new tables missing FORCE |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NULLIF required for empty-string GUC cast**

- **Found during:** Task 5 — Test 3 threw `22P02: invalid input syntax for type integer: ""` instead of returning `[]`
- **Issue:** `current_setting('app.user_id', true)::int` throws when the GUC parameter exists but contains `""` (empty string). Postgres GUC custom parameters can be set to `""` vs being truly absent (NULL). The `missing_ok=true` flag returns NULL only when the parameter doesn't exist at all, not when it's set to empty.
- **Fix:** Changed all 9 policies to use `NULLIF(current_setting('app.user_id', true), '')::int`. `NULLIF` converts `""` to `NULL` before the `::int` cast; both NULL and empty string now safely deny all rows.
- **Files modified:** `prisma/migrations/20260510000000_add_rls_and_app_role/migration.sql`
- **Commit:** 01a82b8

**2. [Rule 1 - Bug] vitest.config.ts used removed poolOptions API**

- **Found during:** Task 5 — vitest 4.1.5 deprecated and removed `poolOptions.forks.singleFork`
- **Issue:** RESEARCH.md's vitest config used Vitest 3 API. Vitest 4 moved pool options to top-level.
- **Fix:** Replaced `poolOptions: { forks: { singleFork: true } }` with `maxWorkers: 1` at test config root.
- **Files modified:** `vitest.config.ts`
- **Commit:** 4d4449a

**3. [Rule 1 - Bug] setup.ts seed SQL had multiple issues**

- **Found during:** Task 5 — `apps.length = 0` in Test 1 even with correct RLS context
- **Issues:**
  a) `applications.company_id` is `NOT NULL` FK — seed used `NULL` which would fail at DB level
  b) Multi-statement SQL in single `client.query()` call may only execute first statement
  c) `pnpm prisma migrate deploy` failed: `pnpm` not in subprocess PATH
- **Fix:**
  a) Added explicit Companies INSERT before Applications seed
  b) Split application INSERTs into separate `client.query()` calls
  c) Used direct prisma binary path resolved from worktree root
- **Files modified:** `tests/integration/setup.ts`
- **Commit:** 4d4449a

**4. [Rule 1 - Bug] Test 1 design: tenantDb + withRls interaction**

- **Found during:** Task 5 — `tenantDb(ALICE).application.findMany()` returned `[]` when connected as foray_app
- **Issue:** `tenantDb` uses global `prisma` client (no `app.user_id` GUC set). With `FORCE RLS` active as `foray_app`, ALL queries via global `prisma` return zero rows unless wrapped in `withRls`. The plan's Test 1 example called `tenantDb` without `withRls` which would always return empty.
- **Fix:** Test 1 uses `withRls(ALICE, async tx => tx.application.findMany({where: {userId: Number(ALICE)}}))` to properly test that alice's authenticated context only sees her own rows. This is the correct production usage pattern. The test name updated to reflect this accurately.
- **Impact:** This documents the production usage contract: tenant data access MUST be inside `withRls` for RLS to work correctly. `tenantDb` provides belt (WHERE filter); `withRls` provides suspenders (GUC + transaction).
- **Files modified:** `tests/integration/rls-escape.test.ts`, `tests/integration/tenant-db-cross-tenant-leak.test.ts`
- **Commit:** 15dcd8f

## Known Stubs

None. All files are fully implemented. The 4 `it.todo` markers in `tenant-db-cross-tenant-leak.test.ts` are explicit Phase 2 placeholders (seed data not yet available), not stubs blocking plan goals.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All T-01-03-* threats are mitigated:
- T-01-03-01: FORCE ROW LEVEL SECURITY on all 9 tables (structural test verifies)
- T-01-03-02: foray_app is non-superuser, rolsuper=f, rolbypassrls=f (verified via pg_roles)
- T-01-03-03: set_config with is_local=true inside $transaction (withRls invariant)
- T-01-03-04: NULLIF(current_setting(...), '')::int handles empty string + NULL safely
- T-01-03-05: Omit<...CreateInput, 'user'> blocks caller from supplying user on creates
- T-01-03-06: Test 4 (structural) catches future migrations missing FORCE on new tables
- T-01-03-07: RLS denies (zero rows) — ESLint no-direct-prisma already blocks easier case
- T-01-03-08: Parent-join policy performance accepted; re-evaluate with EXPLAIN ANALYZE in Phase 4

## Pre-Commit Gate Result

```
pnpm lint        no errors (3 warnings on boundaries deprecation — pre-existing)
pnpm typecheck   clean (0 errors)
pnpm test:run    4 test files, 15 passing, 4 todo
pnpm build       Next.js build clean
pnpm depcheck    1 warning (src/middleware.ts orphan — pre-existing from Plan 02)
```

## Self-Check: PASSED

Files exist:
- prisma/migrations/20260510000000_add_rls_and_app_role/migration.sql: FOUND
- src/core/db/tenant.ts: FOUND
- vitest.config.ts: FOUND
- tests/integration/setup.ts: FOUND
- tests/integration/rls-escape.test.ts: FOUND
- tests/integration/tenant-db-cross-tenant-leak.test.ts: FOUND
- SETUP.md: FOUND

Commits exist:
- 97c7ae0: FOUND (Task 1 — RLS migration)
- 8ad9942: FOUND (Task 2 — tenantDb extension)
- 4b5a574: FOUND (Task 3 — vitest config + Testcontainers setup + SETUP.md)
- 01a82b8: FOUND (fix — NULLIF for empty-string GUC)
- 4d4449a: FOUND (fix — vitest 4 API + seed fixes)
- 15dcd8f: FOUND (Task 5 — RLS escape + isolation tests)

Docker RLS structural check:
- 9 tenant-scoped tables with relrowsecurity=t AND relforcerowsecurity=t: CONFIRMED
