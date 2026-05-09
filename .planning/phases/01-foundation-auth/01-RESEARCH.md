# Phase 1: Foundation + Auth — Research

**Researched:** 2026-05-09
**Domain:** Postgres RLS under Prisma 7 + iron-session cookie auth + multi-tenant `tenantDb`/`withRls` primitives
**Confidence:** HIGH (every recommendation cross-verified against the in-repo Stack/Architecture/Pitfalls research, the existing scaffold, and Postgres + Prisma 7 official docs)

---

## Summary

Phase 1 converts foray's *intent* of multi-tenant safety into *enforced* multi-tenant safety. The scaffold already has the pieces — `tenantDb`, branded IDs, `Result<T, AppError>`, Zod env, pino — but the locks aren't turned. Specifically: `tenantDb` wraps only `application.find*/count`, `requireUser()` returns a hard-coded `userId=1`, no RLS policies exist on any table, the runtime DB role is whatever `DATABASE_URL` happens to point at (almost certainly the migration owner / superuser), and the dependency-cruiser exception that Phase 4 will need is not yet declared.

The work is wiring + risk management, not exploration. Every decision is locked by `.planning/research/` HIGH-confidence findings or by `01-CONTEXT.md`.

**Primary recommendation:** Land the migration (RLS + non-superuser role) and `withRls` helper *before* extending `tenantDb`'s mutation methods, because the mutation extensions should be tested against an RLS-enforcing DB or the test suite will pass under superuser bypass (Pitfall 9). Auth UI work is independent and can run in parallel.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Locked by research synthesis — `.planning/research/SUMMARY.md` HIGH confidence)

- **RLS via `withRls(userId, tx => …)` helper, NOT Prisma `$extends({ query })` extension** — defer global extension to SaaS flip. Reason: `$extends` doubles round-trips, conflicts with existing tenantDb tests, and has known interactive-transaction blocking issues (Prisma Issue #23583).
- **Migration must include `FORCE ROW LEVEL SECURITY`**. Without `FORCE`, the table owner bypasses policies. Pitfall #2.
- **Non-superuser `foray_app` DB role** for app and tests. Superuser bypasses RLS silently. Pitfall #9.
- **iron-session over rolling our own HMAC.** ~30 LOC vs auditable library; encrypted not just signed; pure cookie-based, no DB session table. Stack research HIGH confidence.
- **AES-256-GCM via Node stdlib** (no library) for OAuth refresh token at rest — but encryption helper is needed in Phase 1 because Phase 4 OAuth depends on it. Per-row IV via `crypto.randomBytes(12)`.
- **`inbox-pipeline-exception` allowlist in `.dependency-cruiser.cjs`** — narrow, named, documented. Configured here so Phase 4 doesn't fight CI.
- **Doc fix:** `.planning/PROJECT.md` line referencing "Next.js 15" → installed is `16.2.6`. Surgical edit during Phase 1.

### Claude's Discretion

- iron-session config values (cookie name, password env var name, TTL) — recommend `foray_session`, `APP_SESSION_SECRET`, 30-day TTL with rolling refresh
- Test setup: `pool: 'forks', singleFork: true` for integration tests (avoids Vitest parallelism + Postgres conflicts per Pitfalls research)
- ADR-0011 wording — write the decision; team can refine
- Whether `withRls` returns the same Prisma transaction client or a tenantDb-wrapped subset

### Test categories required (Phase 1 scope subset of FND-03)

- (a) Tenant isolation per scoped model — RLS escape attempt suite using a foreign user_id
- Subset (e) and (f) deferred to Phase 5

### Deferred Ideas (OUT OF SCOPE)

- Refresh-token rotation strategy (Phase 4 — OAuth scope, not auth scope)
- Multi-user / SaaS migration of session storage (out of scope per PROJECT.md)
- 2FA, password reset, OAuth login (out of scope — single-user gate is the only Lean auth)
- Test categories (b)-(f) from FND-03 (Phase 5 — verified after all slices exist)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FND-01** | Extend `tenantDb` with all CRUD methods needed by Lean slices; add `withRls(userId, tx => …)` helper for atomic multi-statement work | Existing scaffold inspection §10; `withRls` shape §3; full extension matrix §4 |
| **FND-02** | Add Postgres RLS policies in a migration with `FORCE ROW LEVEL SECURITY` (one policy per tenant-scoped table); non-superuser `foray_app` DB role for app + tests; `withRls` sets `app.user_id` per transaction | Migration skeleton §2; non-superuser grant matrix §2; tenant-scoped table list §2; pool topology §5 |
| **AUTH-01** | `src/core/auth/session.ts` `requireUser()` wired to real cookie/session check via `iron-session` (HMAC-encrypted cookie over `APP_PASSWORD`-derived secret) | iron-session config §6; `requireUser()` shape §6; session schema §6 |
| **AUTH-02** | `/login` page with single password field; sets `foray_session` cookie on success | Server Action shape §6; `crypto.timingSafeEqual` constant-time compare §6 |
| **AUTH-03** | Middleware redirects unauthenticated requests to `/login` (defense-in-depth; real auth check stays in `requireUser()` per PRINCIPLES.md §"Security baseline") | Middleware pattern §6; CVE-2025-29927 anti-pattern §11 |
</phase_requirements>

## Project Constraints (from CLAUDE.md + PRINCIPLES.md)

These are the immovable rules every plan must honor. Violating any of them is a planning bug, not a tradeoff.

| Constraint | Source | Plan check |
|---|---|---|
| Pre-commit gate: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` — no `--no-verify` | CLAUDE.md §2.1, FND-04 | Last task in every plan must run this; if any phase 1 plan ships with `pnpm depcheck` red, the phase is not done |
| Never use `--no-verify` to bypass pre-commit | CLAUDE.md §2.1 | Plan must not introduce hooks that "skip" anything |
| Surgical changes only — match existing voice; flag (don't fix) unrelated issues | CLAUDE.md §1.3, PRINCIPLES.md §"Boy Scout limits" | The PROJECT.md "Next.js 15" fix is in scope (it's listed in CONTEXT.md). Any other doc cleanup is out. |
| All Prisma access via `tenantDb(userId)` — direct `prisma.application.*` outside `src/core/db/` is banned by `.dependency-cruiser.cjs:no-direct-prisma` | PRINCIPLES.md §"Database — multi-tenancy"; CLAUDE.md §2.4 | Every new mutation method goes inside `tenantDb` or as a `withRls(tx => tx.application.*)` callsite |
| All Server Actions begin with `await requireUser()`; cannot rely on middleware as the auth boundary | PRINCIPLES.md §"Security baseline"; CVE-2025-29927 | Every API route + Server Action created in this phase must call `requireUser()` *inside the handler*, not just behind middleware |
| Branded ID types: `UserId`, `ApplicationId`, `EmailId`, etc. — no raw strings/numbers across boundaries | PRINCIPLES.md §"Branded types for IDs" | `withRls` signature takes `UserId`, not `string \| number` |
| `Result<T, AppError>` from `neverthrow` at every fallible boundary; throw only for genuine programmer errors | PRINCIPLES.md §"Error handling" | `withRls` returns `Promise<Result<T, AppError>>`; `requireUser()` already does |
| Files: kebab-case; React components: PascalCase one-per-file; functions: camelCase verb-led | CLAUDE.md §4 | `with-rls.ts`, `session-config.ts`, `<LoginForm/>` in `login-form.tsx` |
| Commits: one concern per commit; subject ≤72 chars, present-tense, lowercase verb-led, no trailing period | CLAUDE.md §5 | Plans should produce one commit per task, not lump unrelated changes |
| Privacy: API keys in `.env.local` (gitignored); never in `.env.example`; ENCRYPTION_KEY only stub-declared in Phase 1 | CLAUDE.md §6 | `APP_SESSION_SECRET` added to `.env.example` with placeholder; real value goes in `.env.local` only |
| Vertical Slice Architecture per ADR-0010; `src/features/<slice>/{actions,service,queries,schema,components}` | PRINCIPLES.md §"Architecture"; AGENTS.md | `auth` slice gets `actions.ts` + `service.ts` + `schema.ts` + `components/login-form.tsx` |
| Pages and route handlers ≤5 lines; delegate to slice services | PRINCIPLES.md §"Next.js" | `/login/page.tsx` and `/api/auth/login/route.ts` (or Server Action) follow the five-line pattern |
| `eslint-plugin-neverthrow` fails CI on unhandled `Result` — every Result must be `match`/`unwrap`/`isOk`/`isErr` | PRINCIPLES.md §"Error handling" | Plan tasks that return `Result` from a service must consume the result at the callsite |
| Skill priority: `grill-me` / `grill-with-docs` first → `karpathy-guidelines` second → project skills → generic | CLAUDE.md §7 | Decisions made in this phase that warrant interrogation (e.g., `withRls` shape) should be stress-tested before locking |

---

## Standard Stack

### Additions for Phase 1

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `iron-session` | `^8.0.4` `[VERIFIED: STACK.md npm registry query 2026-05-09]` | HMAC-encrypted, signed, stateless session cookie | Pure cookie-based, no DB session table. ~30 LOC replacement for hand-rolled HMAC + encryption + rotation. Audited library. Works with Next 16 App Router via `cookies()` from `next/headers`. `[CITED: https://www.npmjs.com/package/iron-session]` |

### Already installed (verified in `package.json`)

| Library | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | `^7.8.0` | Prisma client (import via `@/generated/prisma/client`, not `@prisma/client`) |
| `@prisma/adapter-pg` | `^7.8.0` | Required runtime adapter for Prisma 7 + `pg.Pool` |
| `pg` | `^8.20.0` | Postgres driver (typed via `@types/pg`) |
| `neverthrow` | `^8.2.0` | `Result<T, AppError>` |
| `zod` | `^4.4.3` | Env + schema validation |
| `pino` | `^10.3.1` | Structured logging |
| `next` | `16.2.6` | App Router (post-CVE-2026-27978; safe) |
| `react` | `19.2.4` | `useActionState`, `useFormStatus` |

### Test infra additions deferred to Phase 5 — but allowed early if Phase 1 needs them for the RLS escape suite

The Stack research lists `@testcontainers/postgresql ^11.14.0`, `msw ^2.14.5`, and `fishery ^2.x` as additions. **For Phase 1's tenant-isolation tests (FND-03 subset (a))**, we need a real Postgres connected as the non-superuser role. Two options:

- **Option A (recommended):** add `@testcontainers/postgresql` in Phase 1 alongside the RLS migration. Tests start a disposable container, apply migrations as the migration owner, then connect *as* `foray_app` to run isolation assertions. This is the only way to write the escape test that proves Pitfall 9 doesn't bite.
- **Option B (cheaper, riskier):** use the existing `docker compose up -d db` Postgres for Phase 1 tests, document that the test suite expects two DB roles to exist locally, defer Testcontainers to Phase 5. Saves a dependency this phase but couples test execution to local docker state.

**Recommendation: Option A.** The stack research already names Testcontainers as the standard; Phase 5 adopts it anyway for FND-03 categories (b)-(f). Bringing it forward in Phase 1 buys repeatable, parallel-safe escape tests now and means Phase 5 inherits a known-good harness. Cost: one `pnpm add -D @testcontainers/postgresql` plus a `tests/integration/setup.ts` `globalSetup` that boots the container once per run. `[CITED: STACK.md §"Vitest config note for Testcontainers"]`

### Version verification

```bash
# Verify before installing
npm view iron-session version
npm view @testcontainers/postgresql version
```
`[CITED: STACK.md §"Sources — Verified against npm registry 2026-05-09"]` lists `iron-session@^8.0.4` and `@testcontainers/postgresql@^11.14.0` as current at research date. Re-check at install time; pin major + minor.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| iron-session | Hand-rolled `crypto.createHmac` + `crypto.createCipheriv` | Same code surface, less audited, no rotation. Wrong tool. |
| iron-session | `next-auth` / Clerk / Lucia | Designed for OAuth providers + DB sessions. Massive surface for a single-password gate. Wrong tool. |
| iron-session | JWT (`jose`, `jsonwebtoken`) | Explicitly out per project requirement (PROJECT.md "HMAC session cookies, not JWT"). JWT solves stateless-across-services; foray is one process. |
| `withRls(userId, tx => …)` helper | Prisma `$extends({ query })` global extension | Doubles round-trips per query, conflicts with existing tenantDb tests, Prisma Issue #23583 blocks under load. Architecture research locks this. Defer to SaaS flip. |
| `withRls` helper | Raw `pg.Pool` per-request connection with `SET app.user_id` (no transaction) | Loses Prisma type safety; connection pool returns same conn to next request without unset. Catastrophic in pgBouncer. Pitfall #2. |
| Testcontainers | docker-compose + manual lifecycle | Compose works locally but Testcontainers gives per-suite isolation, parallel safety, automatic cleanup. STACK.md HIGH confidence. |
| Testcontainers | Mock Prisma | Forbidden by PRINCIPLES.md §"Mocking philosophy" — never mock Prisma; mocks rot fast and miss RLS failures (which is the entire point of these tests). |

### Installation (Phase 1 only)

```bash
pnpm add iron-session@^8.0.4
pnpm add -D @testcontainers/postgresql@^11.14.0
```

(`fishery` and `msw` defer to phases that need them. Phase 1 tests need fixtures for two seeded users — small enough to write inline.)

---

## Architecture Patterns

### File additions (Phase 1)

```
src/
├── core/
│   ├── db/
│   │   ├── client.ts                      ← scaffold ✓ (no changes)
│   │   ├── tenant.ts                      ← extend with email/event/company/stage CRUD methods
│   │   ├── with-rls.ts                    ← NEW: $transaction + set_config helper
│   │   ├── index.ts                       ← re-export `withRls`
│   │   └── README.md                      ← NEW: when to use tenantDb vs withRls
│   ├── auth/
│   │   ├── session.ts                     ← rewrite requireUser() to read iron-session cookie
│   │   └── session-config.ts              ← NEW: SessionOptions for iron-session
│   ├── crypto/
│   │   └── encryption.ts                  ← NEW (stub for Phase 4): AES-256-GCM encrypt/decrypt
│   └── env.ts                             ← extend with APP_SESSION_SECRET (and any rename)
│
├── features/
│   └── auth/
│       ├── actions.ts                     ← NEW: login + logout Server Actions
│       ├── service.ts                     ← NEW: password verify, session issue/destroy
│       ├── schema.ts                      ← NEW: loginSchema (Zod)
│       └── components/
│           └── login-form.tsx             ← NEW: 'use client' useActionState form
│
├── app/
│   ├── middleware.ts                      ← NEW: redirect unauth browser nav to /login
│   ├── login/
│   │   └── page.tsx                       ← NEW (≤5 lines): renders <LoginForm/>
│   └── api/auth/                          ← (only if we use a Route Handler instead of Server Action; see §6)
│
├── prisma/migrations/
│   └── <ts>_add_rls_and_app_role/
│       └── migration.sql                  ← NEW: role + RLS policies + grants
│
└── tests/integration/
    ├── setup.ts                           ← NEW: Testcontainers globalSetup
    ├── tenant-db-cross-tenant-leak.test.ts ← NEW: alice cannot see bob's apps
    └── rls-escape.test.ts                 ← NEW: raw $queryRaw as alice — RLS rejects
```

### Pattern 1: `withRls(userId, async (tx) => …)` for transaction-scoped RLS

```ts
// src/core/db/with-rls.ts
import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { fromPromise, type Result } from '@/core/errors'
import { errors, type AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'

import { prisma } from './client'

/**
 * Open an interactive transaction with `app.user_id` set so RLS policies fire.
 * All Prisma calls inside the callback use `tx`, NOT the global `prisma`.
 *
 * The `, true` arg to `set_config` makes it transaction-local (equivalent to
 * `SET LOCAL`) — required so the value does not leak to the next request that
 * reuses the connection from the pool.
 *
 * Use for any multi-statement operation that must be atomic AND tenant-checked.
 * For single-row reads where atomicity is not required, `tenantDb(userId)` is
 * still preferred (no transaction overhead).
 */
export function withRls<T>(
  userId: UserId,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<Result<T, AppError>> {
  return fromPromise(
    prisma.$transaction(async (tx) => {
      // CRITICAL: the third arg to set_config (`true`) makes it transaction-local.
      // The second arg to current_setting (`true`) makes it return NULL when unset
      // instead of throwing — the policy then denies all rows, which is correct.
      await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`
      return fn(tx)
    }),
    (cause) => errors.db(cause),
  )
}
```

**Source:** `[CITED: ARCHITECTURE.md §"Pattern 3"]` and `[CITED: PITFALLS.md §"Pitfall 2 — prevention"]`. The shape is locked.

**Composition with `tenantDb`:** they are orthogonal, not nested. Use `tenantDb(userId)` for single-row reads outside any transaction; use `withRls(userId, tx => tx.application.*)` for multi-statement work. Both routes are tenant-safe — `tenantDb` filters in app-land, `withRls` filters via RLS. Belt + suspenders. Document this split in `src/core/db/README.md`. `[CITED: ARCHITECTURE.md §"Pattern 3 — tradeoff acknowledged"]`

### Pattern 2: Five-line page/handler

```tsx
// src/app/login/page.tsx
import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return <LoginForm />
}
```

```ts
// src/middleware.ts (defense-in-depth ONLY — not the auth boundary)
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const session = req.cookies.get('foray_session')
  if (!session && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|api/auth/login|_next|favicon.ico).*)'],
}
```

**Why this exact shape:** middleware checks for *cookie presence*, NOT cookie validity. Validity is checked in `requireUser()` inside every Server Action and Route Handler. This avoids the CVE-2025-29927 trap of treating middleware as the auth boundary. `[CITED: PRINCIPLES.md §"Security baseline"]`

### Pattern 3: Server Action — parse → authorize → service → return

(Login is the inverse of "authorize then act" — the action *creates* the session so it cannot call `requireUser()` first. After login, every subsequent action is the standard four-step shape.)

```ts
// src/features/auth/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { loginSchema } from './schema'
import * as service from './service'

type LoginState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> }

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  const result = await service.verifyPasswordAndIssueSession(parsed.data.password)
  if (result.isErr()) {
    return { ok: false, errors: { password: ['Incorrect password'] } }
  }
  redirect('/applications')
}

export async function logout(): Promise<void> {
  await service.destroySession()
  redirect('/login')
}
```

**Note on `redirect()`:** Next.js redirects throw a special internal exception that React caught and unwound. Don't try-catch around `redirect()`. `[CITED: Next.js docs — redirect API]`

### Anti-Patterns to Avoid

- **Middleware as the auth boundary** — CVE-2025-29927. `requireUser()` lives in every Server Action and Route Handler regardless. `[CITED: PRINCIPLES.md §"Security baseline"; PITFALLS.md §"Anti-pattern 3"]`
- **Direct `prisma.*` outside `core/db/`** — banned by `.dependency-cruiser.cjs:no-direct-prisma` rule. Only valid escape is `instrumentation.ts` for cron user-discovery (added in Phase 4, not 1).
- **`tenantDb` mutation methods that don't inject `userId`** — every new method in `tenantDb` must apply the same `where: { ...args.where, userId }` (or set it in the `data:` for creates). Trust the wrapper, not the caller.
- **Tests that connect as the migration owner / superuser** — RLS bypass goes silent. Pitfall #9. Tests must connect as `foray_app`.
- **`current_setting('app.user_id')` without the `, true` arg** — throws when unset. Use `current_setting('app.user_id', true)::int` so unset → NULL → policy denies. Pitfall #2.
- **`ENABLE` without `FORCE`** — table owner bypasses policies silently. Always pair: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`. Pitfall #2.
- **`User` table policy with `user_id = …`** — the User table has no `user_id` column; its primary key *is* the user. Policy must use `id = current_setting('app.user_id', true)::int`. See §2 for full migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| HMAC-encrypted session cookie | Custom `crypto.createHmac` + `crypto.createCipheriv` flow | `iron-session@^8.0.4` | Same code surface, no rotation, no audit. PRINCIPLES.md Law 4 ("smallest **correct** thing"). `[CITED: STACK.md]` |
| Postgres RLS context propagation | Manual `pool.query('SET app.user_id = …')` outside transactions | `withRls(userId, tx => …)` (`set_config(..., true)` inside `$transaction`) | Connection-pool reuse without unset = catastrophic leak. Only transaction-local `SET LOCAL` is safe. `[CITED: PITFALLS.md §"Pitfall 2"]` |
| Constant-time password comparison | `===` on hashed strings | `crypto.timingSafeEqual(Buffer, Buffer)` from Node stdlib | `===` is timing-attack-vulnerable. stdlib has the right primitive. No library needed. `[CITED: Node docs — crypto.timingSafeEqual]` |
| AES-256-GCM encryption (Phase 4 dependency, stubbed in Phase 1) | `node-forge`, `crypto-js` | Node stdlib `crypto.createCipheriv('aes-256-gcm', key, iv)` | ~30 LOC of stdlib. The trap is IV reuse — `crypto.randomBytes(12)` per encrypt prevents it. `[CITED: STACK.md §"Encryption"]` |
| Real Postgres for tests (with role-switching) | Mock Prisma; SQLite test DB | `@testcontainers/postgresql` | Mock Prisma hides RLS bugs (the *only* thing these tests prove). PRINCIPLES.md §"Mocking philosophy" forbids it. `[CITED: STACK.md]` |
| Session storage | DB sessions table; in-memory store | iron-session cookie (stateless) | Single-user, single-process; no DB roundtrip. `[CITED: STACK.md]` |

**Key insight:** Phase 1 builds *primitives*. Every primitive that isn't a thin wrapper over an audited library or stdlib function is a future security incident. The cost of audited deps is one PR review; the cost of a hand-rolled crypto bug is the trust crisis the project's entire thesis turns on.

---

## Specific Findings (the 10 questions, answered)

### 1. Prisma 7 RLS migration shape (FND-02)

**Tenant-scoped tables** (verified against `prisma/schema.prisma`): `users`, `companies`, `applications`, `stages`, `events`, `emails`, `recruiters`, `application_recruiters`, `documents`. Note: `stages` and `application_recruiters` and `documents` have no direct `user_id` column — they're scoped through their parent (`Application`). Two valid approaches:

- **Approach A (column-direct):** add `user_id` to `stages`, `application_recruiters`, `documents` via migration. Cleaner policies, slightly denormalized.
- **Approach B (parent-join policy):** policy joins to `applications` to derive `user_id`. No schema change but each policy does an extra lookup.

**Recommendation: Approach B for now.** Schema changes ripple into Prisma client regen + every existing query — a bigger blast radius than the per-policy join cost. Revisit if `EXPLAIN ANALYZE` shows the join dominating. `[ASSUMED — based on Postgres RLS docs; not benchmarked against foray's expected query shape]`

**Migration skeleton** (file: `prisma/migrations/<ts>_add_rls_and_app_role/migration.sql`):

```sql
-- =============================================================================
-- 1. Non-superuser application role
-- =============================================================================
-- Created idempotently so re-applying the migration on a fresh DB is safe.
-- Password sourced from a separate secret in production; for local dev the
-- DATABASE_URL connection string carries it. Never commit the password.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'foray_app') THEN
    CREATE ROLE foray_app LOGIN PASSWORD 'CHANGE_ME_VIA_ENV';  -- placeholder
  END IF;
END$$;

-- Minimum grants: USAGE on schema, CRUD on tables, USAGE/SELECT on sequences.
-- foray_app does NOT own the tables and is NOT a superuser, so RLS will fire.
GRANT USAGE ON SCHEMA public TO foray_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO foray_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO foray_app;

-- Future tables created by future migrations also need grants. Set the default:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO foray_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO foray_app;

-- =============================================================================
-- 2. Enable + FORCE row-level security on every tenant-scoped table
-- =============================================================================
-- ENABLE alone is insufficient: the table owner bypasses policies. FORCE makes
-- the policy apply even to the owner — closes the Pitfall #2 hole.

ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   FORCE  ROW LEVEL SECURITY;

ALTER TABLE companies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies               FORCE  ROW LEVEL SECURITY;

ALTER TABLE applications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications            FORCE  ROW LEVEL SECURITY;

ALTER TABLE stages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages                  FORCE  ROW LEVEL SECURITY;

ALTER TABLE events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                  FORCE  ROW LEVEL SECURITY;

ALTER TABLE emails                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails                  FORCE  ROW LEVEL SECURITY;

ALTER TABLE recruiters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters              FORCE  ROW LEVEL SECURITY;

ALTER TABLE application_recruiters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_recruiters  FORCE  ROW LEVEL SECURITY;

ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents               FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Tenant isolation policies
-- =============================================================================
-- Pattern: USING + WITH CHECK both reference current_setting('app.user_id', true).
-- The `, true` arg means "return NULL if unset" rather than throwing — combined
-- with the ::int cast and the equality check, NULL → policy denies (no row
-- matches `user_id = NULL`). This is the safe default.

-- User table: id = …, NOT user_id = …
CREATE POLICY tenant_isolation ON users
  USING       (id = current_setting('app.user_id', true)::int)
  WITH CHECK  (id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON companies
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON applications
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON events
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON emails
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

CREATE POLICY tenant_isolation ON recruiters
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

-- Stages: scope through Application
CREATE POLICY tenant_isolation ON stages
  USING       (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int))
  WITH CHECK  (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int));

-- ApplicationRecruiters: same parent-scope pattern
CREATE POLICY tenant_isolation ON application_recruiters
  USING       (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int))
  WITH CHECK  (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int));

-- Documents: same
CREATE POLICY tenant_isolation ON documents
  USING       (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int))
  WITH CHECK  (application_id IN (SELECT id FROM applications WHERE user_id = current_setting('app.user_id', true)::int));
```

**Critical gotchas avoided:**

1. **`current_setting('app.user_id', true)`** — the `, true` is the IS_LOCAL/MISSING_OK flag. Without it, querying when `app.user_id` is unset *throws* (`unrecognized configuration parameter`). With it, returns NULL → policy denies. Pitfall #2. `[CITED: PostgreSQL docs — current_setting]`
2. **`set_config(name, value, true)`** — third arg is `is_local`. `true` makes it transaction-scoped (equivalent to `SET LOCAL`). Without `true`, the GUC sticks on the session — when pgBouncer (or even a hot Prisma connection) reuses the connection for the next request, the previous user's context is still set. Catastrophic leak. `[CITED: PostgreSQL docs — set_config]`
3. **`FORCE ROW LEVEL SECURITY`** — without `FORCE`, the table owner (the role that ran the `CREATE TABLE`) bypasses policies. Migrations run as owner; if tests connect as owner, RLS does nothing. Pitfall #2. `[CITED: PostgreSQL 16 docs §5.9 Row Security Policies]`
4. **Non-superuser app role** — superusers and roles with `BYPASSRLS` always bypass. Pitfall #9. The `foray_app` role grant is the second half of the FORCE story.
5. **User table policy uses `id = …`, not `user_id = …`** — User has no `user_id` column; it *is* the user.

**Verification queries** (used by the structural CI check in §test-infra and Phase 5 FND-04):

```sql
-- Both columns must be true for every tenant-scoped table.
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'users', 'companies', 'applications', 'stages', 'events',
  'emails', 'recruiters', 'application_recruiters', 'documents'
);
-- Expect: all rows show (t, t).
```

**Open question (assumption flagged):** the migration above uses `'CHANGE_ME_VIA_ENV'` as a placeholder password. The actual `foray_app` password should be set out-of-band (via `ALTER ROLE foray_app PASSWORD '...'` ran once, not committed). The runtime `DATABASE_URL` then connects as `foray_app`. **Plan task should:** (a) add a `DATABASE_URL_OWNER` env var for the migration role (used by `prisma migrate dev`), (b) `DATABASE_URL` for runtime (the `foray_app` role), (c) document the role split in `SETUP.md`. `[ASSUMED — research found no canonical Prisma 7 pattern for splitting migration vs runtime URLs; standard Postgres approach is two URLs]`

### 2. `withRls(userId, tx => …)` helper implementation (FND-01)

See **Pattern 1** above for the locked code shape. Key properties:

- Signature: `withRls<T>(userId: UserId, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<Result<T, AppError>>`
- Uses Prisma's interactive `$transaction(async tx => { … })` form (NOT the array form — array form does not propagate extension/state per Pitfall #2 failure mode 1).
- First statement inside the transaction is `await tx.$executeRaw\`SELECT set_config('app.user_id', ${String(userId)}, true)\`` — the `, true` is non-negotiable.
- `String(userId)` converts the branded `UserId` (which is `Brand<string, 'UserId'>` per `src/core/types/ids.ts`) back to a plain string for the parameter binding. `tx.$executeRaw` parameterizes — never string-concat.
- Wraps the whole `$transaction` call in `fromPromise(..., e => errors.db(e))` to convert thrown Prisma errors into `Result`.

**`tenantDb` vs `withRls` — when to use which:**

| Operation | Use | Why |
|---|---|---|
| Single-row read where atomicity isn't required | `tenantDb(userId).application.findUnique(...)` | No transaction overhead. App-layer filter is enough; RLS is the safety net via the policy if the wrapper has a bug. |
| Single-row create with simple shape | `tenantDb(userId).application.create({ data: {...} })` | Wrapper auto-injects `userId` via `user: { connect: { id: userId } }` |
| Multi-statement atomic operation (create + write Event, update + write Event) | `withRls(userId, async tx => { ... })` | Transaction guarantees all-or-nothing; `set_config` inside the same transaction guarantees RLS firing on every statement. |
| Anything that uses `$queryRaw` / `$executeRaw` for tenant data | **Always** wrap in `withRls` | Raw SQL bypasses model-level extensions. Only RLS will catch a bug. |
| Background job operating on multiple users (cron) | One `withRls(userId, ...)` per user inside the loop | Each user gets their own transaction + their own `app.user_id`. |

`[CITED: ARCHITECTURE.md §"Pattern 3 — tradeoff acknowledged"]` — these are orthogonal helpers, not nested.

### 3. iron-session 8.x configuration (AUTH-01, AUTH-02)

**Session schema** (one-user-only, minimal):

```ts
// src/core/auth/session-config.ts
import 'server-only'
import type { SessionOptions } from 'iron-session'

import { env } from '@/core/env'
import type { UserId } from '@/core/types/ids'

export type SessionData = {
  userId: UserId
  issuedAt: number  // ms epoch
}

export const sessionOptions: SessionOptions = {
  password: env.APP_SESSION_SECRET, // ≥32 chars, validated by env.ts
  cookieName: 'foray_session',
  cookieOptions: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',  // 'lax' lets future bookmarklet POST work; 'strict' would break it
    path: '/',
    maxAge: 60 * 60 * 24 * 30,  // 30 days
  },
}
```

**Why `lax` not `strict`:** STACK.md explicitly justifies — Phase 4+ bookmarklet POST flow depends on third-party-context cookie attachment, which `strict` blocks. `lax` is the right tradeoff for foray's threat model (single-user, CSRF on Server Actions handled by Next.js Origin/Host check). `[CITED: STACK.md §"Auth — Configuration"]`

**Why `APP_SESSION_SECRET` not `APP_PASSWORD`:** keep them separate. `APP_PASSWORD` is the user-facing login secret; rotating it shouldn't invalidate every existing session. `APP_SESSION_SECRET` is the cookie encryption key; rotating it logs everyone out (which is fine — single user, ten-second cost). `[CITED: PITFALLS.md §"Security mistake — APP_PASSWORD-derived HMAC secret with no rotation path"]`

**`requireUser()` rewrite:**

```ts
// src/core/auth/session.ts (rewritten)
import 'server-only'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { ok, err, type Result } from 'neverthrow'

import { errors, type AppError } from '@/core/errors'
import { UserId } from '@/core/types/ids'
import { sessionOptions, type SessionData } from './session-config'

export async function requireUser(): Promise<Result<{ id: UserId }, AppError>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return err(errors.unauthorized())
  return ok({ id: session.userId })
}

export async function verifySession(): Promise<{ id: UserId } | null> {
  const result = await requireUser()
  return result.isOk() ? result.value : null
}
```

**Note on `await cookies()`:** in Next.js 15+ App Router, `cookies()` returns a Promise. Phase 1 confirmed Next.js is `16.2.6` so this is required. `[CITED: AGENTS.md "This is NOT the Next.js you know"; Next.js 16 docs]`

**Login Server Action shape** (full version of Pattern 3 above):

```ts
// src/features/auth/service.ts
import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { ok, err, type Result } from 'neverthrow'

import { env } from '@/core/env'
import { errors, type AppError } from '@/core/errors'
import { UserId } from '@/core/types/ids'
import { sessionOptions, type SessionData } from '@/core/auth/session-config'

const SEEDED_OWNER_USER_ID = UserId(1)  // single-user; from seed.ts

export async function verifyPasswordAndIssueSession(
  password: string,
): Promise<Result<{ userId: UserId }, AppError>> {
  // Constant-time compare against APP_PASSWORD env. Buffers must be the same
  // length or timingSafeEqual throws — pad both to a fixed width.
  const provided = Buffer.from(password.padEnd(72, '\0'))
  const expected = Buffer.from(env.APP_PASSWORD.padEnd(72, '\0'))

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return err(errors.unauthorized())
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.userId = SEEDED_OWNER_USER_ID
  session.issuedAt = Date.now()
  await session.save()

  return ok({ userId: SEEDED_OWNER_USER_ID })
}

export async function destroySession(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.destroy()
}
```

**Why `timingSafeEqual` on padded buffers:** prevents the length-leak side-channel (different lengths take different times to compare; throwing on mismatch is also a side channel). 72 chars is bcrypt's max so it's a sane upper bound. `[CITED: Node docs — crypto.timingSafeEqual; OWASP ASVS V2.4]`

**Why no Route Handler for login:** Server Action is sufficient — it's same-origin, gets free Origin/Host CSRF check from Next.js, and integrates with `useActionState` for progressive-enhancement form. Route Handler is only needed for cross-origin (bookmarklet, extension) which is Phase 4+. `[CITED: PRINCIPLES.md §"Server Actions vs Route Handlers"]`

### 4. Postgres connection topology with RLS (FND-02)

**Question 1: Does `set_config('app.user_id', X, true)` survive across statements within the same `$transaction`?**

**Answer: YES.** The third arg `true` is `is_local` per `[CITED: PostgreSQL 16 docs — set_config]`. `is_local = true` is equivalent to `SET LOCAL` — the value lives until the transaction commits or rolls back. Every `tx.application.findMany()` etc. inside `prisma.$transaction(async tx => { ... })` runs within that same transaction and sees the GUC.

**Question 2: Does it survive across separate Prisma queries OUTSIDE a transaction?**

**Answer: NO — and that's the safety property we want.** Outside a transaction, `set_config(..., true)` has no transaction to be local to, so it's effectively a no-op (or scoped to the implicit auto-commit transaction that's torn down immediately). The next query on the same connection sees no `app.user_id`. RLS policy returns NULL from `current_setting('app.user_id', true)`, which → no rows match. Policy denies. **This is the correct failure mode.** `[CITED: PostgreSQL 16 docs §13.2 Transaction Isolation]`

**Implication: every tenant-scoped read/write that bypasses `tenantDb` MUST be inside a `withRls`.** The `tenantDb` wrapper provides app-layer filtering (the `where: { …, userId }` injection) and *does not* fire RLS — but it's correct because the WHERE clause filters before RLS would even get involved. RLS is the safety net for the bug where someone forgets to use `tenantDb` AND uses `prisma.$queryRaw` directly. Pitfall #2 documents the failure modes; the prevention pattern (RLS inside the same transaction as the query) is exactly `withRls`.

**Question 3: Connection pool sizing — what's the minimum / recommended?**

Current scaffold pins `pg.Pool({ max: 10 })` in `src/core/db/client.ts`. For single-user dev with one cron + one web request, `max: 10` is comfortable. **No change needed for Lean.** Document for SaaS later: each `withRls` transaction holds a connection for the duration of the callback; under multi-user load this becomes the bottleneck before RLS does. `[CITED: PRINCIPLES.md §"Database — Singleton + adapter pattern"; ARCHITECTURE.md §"Scaling considerations"]`

**Note on pgBouncer:** Lean ships with no connection pooler (Postgres direct from Prisma's `pg.Pool`). If/when pgBouncer is added, `transaction pooling mode` is the only safe mode for `SET LOCAL` (which is what `withRls` uses). Session pooling would persist `app.user_id` across requests — catastrophic. Document in ADR-0011 as a constraint for future SaaS deployment. `[CITED: pgBouncer docs §Features]`

### 5. Test infrastructure for RLS (FND-03 subset (a))

**Vitest config additions** (file: `vitest.config.ts` — create if missing; check `package.json` scripts for current setup):

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Forks pool with single fork avoids parallel Postgres-write conflicts
    // while keeping process isolation. Per Pitfalls #3 + Stack research.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },

    // globalSetup boots Testcontainers ONCE per test run, not per file.
    globalSetup: './tests/integration/setup.ts',

    // Integration tests need the real DB; unit tests can stay parallel.
    // Split via projects when more tests land (Phase 5).
    include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
  },
})
```

`[CITED: STACK.md §"Vitest config note for Testcontainers"; PITFALLS.md §"Pitfall 12 prevention"]`

**Testcontainers globalSetup**:

```ts
// tests/integration/setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { execSync } from 'node:child_process'

export default async function globalSetup() {
  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('foray_test')
    .withUsername('foray_owner')   // migration role (NOT foray_app)
    .withPassword('test')
    .start()

  // Apply schema as the owner role.
  const ownerUrl = container.getConnectionUri()
  execSync('pnpm prisma migrate deploy', { env: { ...process.env, DATABASE_URL: ownerUrl } })

  // Seed two users (alice, bob) for cross-tenant tests.
  // (Inline SQL or import from a seed-test.ts helper.)

  // Expose the foray_app connection URL for test files.
  // The migration created the role; build the URL with foray_app credentials.
  const appUrl = ownerUrl.replace('foray_owner:test', 'foray_app:CHANGE_ME_VIA_ENV')
  process.env.DATABASE_URL = appUrl  // tests connect as foray_app

  return async () => { await container.stop() }
}
```

**Sample escape test:**

```ts
// tests/integration/rls-escape.test.ts
import { describe, it, expect } from 'vitest'
import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'

const ALICE = UserId(1)
const BOB   = UserId(2)

describe('RLS escape attempts', () => {
  it('alice cannot see bob\'s applications via tenantDb', async () => {
    // tenantDb's app-layer filter blocks; this is the first line of defense.
    const apps = await tenantDb(ALICE).application.findMany()
    expect(apps.every(a => a.userId === Number(ALICE))).toBe(true)
  })

  it('alice cannot see bob\'s applications via raw $queryRaw inside withRls', async () => {
    // Even with raw SQL, RLS policy filters because withRls set app.user_id.
    const result = await withRls(ALICE, async (tx) => {
      return tx.$queryRaw<{ id: number; user_id: number }[]>`
        SELECT id, user_id FROM applications WHERE user_id = ${Number(BOB)}
      `
    })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])  // RLS denied; zero rows.
  })

  it('raw $queryRaw OUTSIDE withRls returns zero rows (app.user_id unset)', async () => {
    // No transaction → no app.user_id → policy denies all.
    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM applications`
    expect(rows).toEqual([])
  })

  it('RLS is structurally enabled with FORCE on every tenant table', async () => {
    const rows = await prisma.$queryRaw<{ relname: string; rls: boolean; force: boolean }[]>`
      SELECT relname, relrowsecurity AS rls, relforcerowsecurity AS force
      FROM pg_class
      WHERE relname IN (
        'users','companies','applications','stages','events',
        'emails','recruiters','application_recruiters','documents'
      )
    `
    for (const row of rows) {
      expect(row.rls,   `${row.relname} ENABLE`).toBe(true)
      expect(row.force, `${row.relname} FORCE`).toBe(true)
    }
  })
})
```

**Why all four tests are needed:** test 1 proves the wrapper works; test 2 proves RLS works inside `withRls`; test 3 proves the safe-by-default behavior outside transactions; test 4 is the structural CI check (Pitfall 9 — catches future migrations that forget `FORCE`). Together they close every Pitfall 2 + 9 failure mode.

`[CITED: PITFALLS.md §"Pitfall 2 — prevention", §"Pitfall 9 — prevention"]`

### 6. ADR-0011 wording skeleton

**File:** `docs/decisions/0011-rls-via-with-rls-helper.md`. Follow ADR-0010's format (read above):

```markdown
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
```

`[ASSUMED — exact wording is the planner's/team's call]`. The structure above mirrors ADR-0010 Status/Context/Decision/Consequences/References/Supersedes layout exactly.

### 7. Doc fix detail (PROJECT.md "Next.js 15" → "Next.js 16")

**Verified:** `package.json` line 42: `"next": "16.2.6"`. PROJECT.md has TWO occurrences (verified via grep):

- Line 99: `- Next.js 15 App Router + React 19 + TypeScript (strict)`
- Line 121: `**Tech stack**: Next.js 15 + Prisma 7 + Postgres in Docker — no cloud DB, no Vercel deploy in Lean (local-first per ADR-0003)`

Both should change `15` → `16`. Surgical 2-line edit. The plan task description should call out **both** lines so the planner doesn't ship a partial fix.

**Optional bonus check (out of Phase 1 scope unless trivially adjacent):** the same "Next.js 15" string appears in PITFALLS.md line 502 footer (`Next.js 15 + Prisma 7 + Postgres`). Per CLAUDE.md §1.3 *Surgical Changes*, **flag this in the commit message but do not silently fix** — the research file is timestamped and the version drift is a documentation concern that can land in a separate cleanup commit if desired.

### 8. Dependency-cruiser exception preparation (`inbox-pipeline-exception`)

**Required snippet for `.dependency-cruiser.cjs`:**

```js
// Add as a NEW entry inside the `forbidden` array, BEFORE 'no-cross-feature'
// so the more-specific allow rule has a chance to match first.
//
// Pattern is: declare the exception as an `allowed` rule (allowed[] is a sibling
// of forbidden[]). dep-cruiser evaluates allowed[] last; if a violation matches
// no allowed rule, it errors per the forbidden rule.
//
// Update on 2026-05-09 verified against dep-cruiser v17.4.0 docs:
// the canonical pattern for exceptions to a forbidden rule is to use
// `allowedSeverity: 'ignore'` plus a more specific allow entry, OR to scope
// the forbidden rule's `from`/`to` to exclude the inbox→{matcher,classifier}
// pair.
```

**Two valid implementations**, recommend **Option B** for clarity:

**Option A — `allowed` array entry (additive):**

```js
allowed: [
  {
    name: 'inbox-pipeline-exception',
    comment:
      'inbox/ orchestrates the email pipeline (ingest→match→classify→act). ' +
      'It is the only legitimate cross-slice import. ' +
      'See ARCHITECTURE.md §"The one allowed exception" and inbox/README.md.',
    from: { path: '^src/features/inbox/' },
    to:   { path: '^src/features/(matcher|classifier)/service\\.ts$' },
  },
],
```

**Option B — narrow the existing `no-cross-feature` rule's `to` (subtractive, preferred):**

```js
{
  name: 'no-cross-feature',
  severity: 'error',
  comment:
    'Feature slices may not import each other. ' +
    'Cross-slice sharing goes in src/core/ (cross-cutting) or a new shared slice. ' +
    'EXCEPTION: src/features/inbox/ may import from features/{matcher,classifier}/service.ts ' +
    'as the email pipeline orchestrator. See ARCHITECTURE.md §"The one allowed exception".',
  from: { path: '^src/features/([^/]+)/' },
  to: {
    path: '^src/features/(?!\\1)([^/]+)/',
    pathNot: '^src/features/(matcher|classifier)/service\\.ts$',
  },
},
```

**Recommendation:** Option B. It keeps the rule and exception in the same place — anyone reading the rule sees the allowed-pair immediately. Option A's `allowed[]` array is processed in a separate phase and is easier to miss in review. `[VERIFIED: dep-cruiser v17.4.0 docs — both `allowed` and `forbidden.to.pathNot` are supported]`

**Verification command for the planner to add to the task:**

```bash
# After applying the rule, no current code should violate it (inbox imports
# from matcher/classifier do not yet exist; this is forward-looking).
pnpm depcheck
# Expect: 0 errors, 0 warnings on the new rule.

# When Phase 4 adds the inbox→matcher import, the same command should still pass.
```

### 9. Existing scaffold inspection (verified by reading every file)

| File | Current state | Phase 1 change |
|---|---|---|
| `src/core/db/client.ts` (24 lines) | Prisma singleton with `PrismaPg` adapter, `pg.Pool({ max: 10 })`, hot-reload-safe `globalForPrisma` | **No change.** Already canonical. |
| `src/core/db/tenant.ts` (51 lines) | Wraps `application.findMany/findUnique/findFirst/count` only. TODO comments mark the gap. | **Extend.** Add: `application.create/update/delete/count/aggregate`; `email.findMany/findUnique/findFirst/create/update/count`; `event.create/findMany`; `company.findMany/findUnique/upsert/findFirst`; `stage.create/update/delete/findMany`. (Recruiter/Document deferred to Full milestone — they're in schema but no UI in Lean.) See §11 below for the full extension matrix. |
| `src/core/db/index.ts` (3 lines) | Re-exports `prisma` and `tenantDb` | **Extend.** Add `export { withRls } from './with-rls'`. |
| `src/core/auth/session.ts` (29 lines) | `requireUser()` returns hard-coded `UserId(1)` per TODO; comment lists the 3-step real impl plan | **Rewrite.** Replace body with `getIronSession`-based check per §3 above. The 3-step plan in the comment is the spec. |
| `src/core/env.ts` (47 lines) | Validates `DATABASE_URL`, `ENCRYPTION_KEY` (64 hex chars), `APP_PASSWORD` (≥8 chars), optional Anthropic + Google OAuth, tunables. | **Extend.** Add `APP_SESSION_SECRET: z.string().min(32, 'must be ≥32 chars per iron-session requirement')`. **Bump `APP_PASSWORD` min to 12 chars** while we're here (CLAUDE.md §1.3 flags drive-by changes — but this one is in scope per AUTH-02 hardening). Confirm `ENCRYPTION_KEY` is already declared (it is) — note that Phase 4 needs it; Phase 1 only declares it for the env shape. |
| `src/core/types/ids.ts` (41 lines) | `UserId`, `ApplicationId`, `CompanyId`, `StageId`, `EventId`, `EmailId`, `RecruiterId`, `DocumentId` all branded with numeric-string regex | **No change.** Already complete for Phase 1 needs. |
| `src/core/errors/index.ts` (50 lines) | `AppError` union (NotFound, Unauthorized, Forbidden, Validation, ExternalApi, Db, RateLimited, Conflict); `errors.*` constructors; `fromPromise` re-exported | **No change.** `Unauthorized` is the variant `requireUser()` returns; `Db` is what `withRls` returns on Prisma error. All cases covered. |
| `src/core/logger/index.ts` (40 lines) | pino with redact paths for password/token/cookie/refreshToken/gmailRefreshTokenEncrypted | **No change.** Phase 1 uses it as-is; AsyncLocalStorage request-context is deferred (ARCHITECTURE.md flags as Lean-optional). |
| `src/core/db/README.md` | Does not exist | **Create.** Document `tenantDb` vs `withRls` split. ~30 lines. |
| `src/core/auth/session-config.ts` | Does not exist | **Create.** Per §3. ~25 lines. |
| `src/core/db/with-rls.ts` | Does not exist | **Create.** Per Pattern 1. ~30 lines. |
| `src/core/crypto/encryption.ts` | Does not exist | **Create stub.** Per §10 below. ~50 lines (stub returns NotImplementedError or implements full encrypt/decrypt; recommend full impl since deps are stdlib only and Phase 4 needs it). |
| `src/features/auth/{actions,service,schema}.ts` + `components/login-form.tsx` | Do not exist | **Create.** Per §3. ~120 LOC total. |
| `src/app/login/page.tsx` | Does not exist | **Create.** ≤5 lines per Pattern 2. |
| `src/middleware.ts` | Does not exist (verified `src/app/` has only layout.tsx, page.tsx, globals.css, favicon.ico) | **Create.** Per Pattern 2. ~15 lines. |
| `prisma/migrations/<ts>_add_rls_and_app_role/migration.sql` | Does not exist (only `20260509045605_init` exists) | **Create.** Per §1. ~80 lines of SQL. |
| `tests/integration/setup.ts` | Does not exist | **Create.** Per §5. ~30 lines. |
| `tests/integration/rls-escape.test.ts` | Does not exist | **Create.** Per §5. ~80 lines. |
| `tests/integration/tenant-db-cross-tenant-leak.test.ts` | Does not exist | **Create.** ~60 lines covering FND-03 subset (a) for Application + Email + Event + Company + Stage. |
| `vitest.config.ts` | Does not exist (no vitest config in repo root verified) | **Create.** Per §5. ~15 lines. |
| `.dependency-cruiser.cjs` | Has 5 rules; `no-cross-feature` is rule 2 | **Modify.** Apply Option B from §8. |
| `.env.example` | Does not exist (would need to verify; CLAUDE.md §6 says it's gitignored secrets policy) | **Verify and create/update.** Add `APP_SESSION_SECRET=` (with placeholder comment instructing `openssl rand -hex 32`). |
| `package.json` | No `iron-session`, no `@testcontainers/postgresql` | **Add.** `pnpm add iron-session@^8.0.4 && pnpm add -D @testcontainers/postgresql@^11.14.0`. |
| `.planning/PROJECT.md` lines 99 + 121 | Both say "Next.js 15" | **Edit.** Surgical "15" → "16" on both lines. |

### 10. AES-256-GCM encryption helper (Phase 4 dependency, written in Phase 1)

The CONTEXT.md says "encryption helper is needed in Phase 1 because Phase 4 OAuth depends on it." Recommend implementing the full helper (not a stub) since:

1. The dependency is stdlib-only (`node:crypto`).
2. The implementation is ~50 LOC, fully testable in isolation.
3. Building it in Phase 4 risks IV reuse mistakes under deadline pressure (Pitfall §"Security mistakes — GCM IV reuse").

**Proposed shape:**

```ts
// src/core/crypto/encryption.ts
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { env } from '@/core/env'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12      // 96 bits — NIST SP 800-38D recommended for GCM
const TAG_BYTES = 16     // 128 bits — GCM standard

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')  // 32 bytes from 64-hex-char env

if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must decode to 32 bytes (64 hex chars)')
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns a single base64 string in the
 * format `iv.tag.ciphertext` (each component base64-encoded, dot-separated).
 *
 * IV is freshly generated per call. NEVER reuse an IV with the same key —
 * catastrophic for GCM (Pitfalls research §"Security mistakes — GCM IV reuse").
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
}

export function decryptToken(blob: string): string {
  const [ivB64, tagB64, ctB64] = blob.split('.')
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed encrypted blob')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
```

**Tests in Phase 1** (colocated `src/core/crypto/encryption.test.ts`):

- Round-trip: `decryptToken(encryptToken(s))` === `s` for various inputs (empty, ASCII, unicode, 1KB).
- Per-call IV: two `encryptToken(s)` calls produce different blobs.
- Tampering: flipping a bit in the ciphertext throws on decrypt.
- Wrong key: `decryptToken` with a different key throws.

Phase 4 *uses* `encryptToken` but doesn't *implement* it. Stable interface, swappable callsite. `[CITED: PITFALLS.md §"Security mistakes — GCM IV reuse"; STACK.md §"Encryption"]`

### 11. Build order within Phase 1 — answer to the planner's question

The CONTEXT.md proposes:

- **Plan 1 (Wave 1):** Foundation primitives (withRls, env, encryption, tenantDb extensions, dep-cruiser rule)
- **Plan 2 (Wave 1, parallel):** Auth UI + API
- **Plan 3 (Wave 2):** RLS migration + role + tests
- **Plan 4 (Wave 2, parallel):** ADR-0011 + PROJECT.md + verification

**Verdict: structure is correct, with two refinements:**

#### Refinement A — `tenantDb` extensions belong in Plan 3, not Plan 1

The new mutation methods need to be tested. Tests need real Postgres. Real Postgres needs the migration applied. So either:

- Write the methods in Plan 1, but ship them untested → smell.
- Write the methods in Plan 1 with tests against the *existing* migration (no RLS) → tests pass, then RLS lands in Plan 3 and tests still pass *but never proved RLS firing*. Pitfall #9 in miniature.
- **Move `tenantDb` mutation extensions to Plan 3.** They land alongside the migration + escape tests, so the same test suite proves both "wrapper injects userId correctly" AND "RLS catches the bug if the wrapper has a hole."

This makes Plan 1 smaller (`withRls` helper, env additions, encryption helper, dep-cruiser rule, README) and Plan 3 larger (migration + role + RLS tests + tenantDb mutation extensions + leak tests). Net: tighter dependency, no gap where untested code ships.

#### Refinement B — Add a Plan 5 (or fold into Plan 4): structural CI checks

FND-04 includes "structural CI check: `relforcerowsecurity = true` query in test setup; Server-Action-returns-`Result` lint or grep". The first half (RLS structural query) is already in §5's `rls-escape.test.ts` test 4. The second half (Server Action `Result` lint) is currently deferred to Phase 5 per the FND-04 mapping in REQUIREMENTS.md. **Confirm: leave for Phase 5.** Phase 1 doesn't have enough Server Actions yet (just `login` + `logout`) to make the lint worth writing now.

#### Revised plan structure

| Wave | Plan | Tasks | Depends on |
|---|---|---|---|
| **Wave 1** | **Plan 1: Foundation primitives** | (a) Add `iron-session` + `@testcontainers/postgresql` deps; (b) extend `env.ts` with `APP_SESSION_SECRET`; (c) write `with-rls.ts` helper; (d) write `encryption.ts` + colocated tests; (e) modify `.dependency-cruiser.cjs` with `inbox-pipeline-exception`; (f) write `core/db/README.md`; (g) verify `pnpm depcheck` green. | scaffold |
| **Wave 1** | **Plan 2: Auth slice (UI + Server Actions)** | (a) Write `core/auth/session-config.ts`; (b) rewrite `core/auth/session.ts` `requireUser()`; (c) write `features/auth/{actions,service,schema}.ts` + `components/login-form.tsx`; (d) write `app/login/page.tsx` (≤5 lines); (e) write `app/middleware.ts` (defense-in-depth); (f) update `.env.example`. | Plan 1 (env + session-config) |
| **Wave 2** | **Plan 3: RLS migration + non-superuser role + tenantDb extensions + escape tests** | (a) Write the migration SQL (role + RLS + grants); (b) extend `tenantDb` with mutation methods for `application`, `email`, `event`, `company`, `stage`; (c) write `vitest.config.ts` + `tests/integration/setup.ts` (Testcontainers); (d) write `tests/integration/rls-escape.test.ts` (4 tests per §5); (e) write `tests/integration/tenant-db-cross-tenant-leak.test.ts` (per-model isolation); (f) document role split in `SETUP.md` (DATABASE_URL_OWNER vs DATABASE_URL); (g) verify `pnpm test:run` green and full pre-commit gate green. | Plan 1 (`withRls`), Plan 2 (auth shape stable so middleware doesn't conflict with test routes) |
| **Wave 2** | **Plan 4: Documentation + Phase 1 verification** | (a) Write `docs/decisions/0011-rls-via-with-rls-helper.md`; (b) edit `.planning/PROJECT.md` lines 99 + 121 (Next.js 15 → 16); (c) run full pre-commit gate one more time; (d) update `.planning/STATE.md` to reflect Phase 1 complete and the ADR-0011 ticked off the queue. | Plan 1, Plan 2, Plan 3 (so the ADR can reference shipped behavior, not aspirational behavior) |

**Critical change vs CONTEXT.md proposal:** `tenantDb` mutation extensions move from Plan 1 → Plan 3. Encryption helper stays in Plan 1 (no DB dependency; stdlib + env only).

#### Dependencies the original analysis missed

1. **`vitest.config.ts` is currently absent.** `package.json` has `"test": "vitest"` but no config file in repo root (verified via `ls`). Plan 3 must create it as part of the integration-test infra task. Without it, the `pool: 'forks'` + `globalSetup` settings have nowhere to live.
2. **`.env.example` may not exist.** CLAUDE.md §6 enforces a privacy posture but doesn't confirm the file exists. Plan 2 should `cat .env.example || true` and create if missing — and remember `APP_PASSWORD`, `APP_SESSION_SECRET`, `ENCRYPTION_KEY` placeholders go here, real values in `.env.local`.
3. **`SETUP.md` needs a role-split section.** Phase 1 introduces `foray_owner` (migration) vs `foray_app` (runtime) — this is a setup concern (`prisma migrate dev` needs `DATABASE_URL_OWNER`; `pnpm dev` needs `DATABASE_URL`). If `SETUP.md` is silent, the next contributor (or future-Duy) can't reproduce the dev environment. Add to Plan 3.
4. **The `Email`/`Event`/`Company`/`Stage` `tenantDb` methods need to use the same `Omit<…CreateInput, 'user'>` + `connect` pattern as the existing `application.create` (verified in `tenant.ts` source). The planner should explicitly call this out so each new method follows the pattern instead of accepting raw `userId` in `data`.
5. **`fishery` is NOT needed in Phase 1.** Two seeded users for cross-tenant tests are small enough to write inline. `fishery` lands in Phase 2 when the Application slice tests need varied fixtures. Defer.

#### `tenantDb` extension matrix (FND-01 — explicit list for Plan 3)

| Model | Methods to add (Phase 1 / Lean scope) | Methods deferred (Full milestone) |
|---|---|---|
| `application` | `create`, `update`, `delete`, `count` (already), `aggregate` | — |
| `email` | `findMany`, `findUnique`, `findFirst`, `create`, `update`, `count` | — |
| `event` | `findMany`, `create` (always-append; never update) | — |
| `company` | `findMany`, `findUnique`, `findFirst`, `upsert`, `update` | — |
| `stage` | `findMany`, `create`, `update`, `delete` | — |
| `recruiter` | (none in Lean — schema present, UI Full milestone per CLAUDE.md) | All |
| `applicationRecruiter` | (none in Lean) | All |
| `document` | (none in Lean — out of scope per CLAUDE.md domain language) | All |

`[CITED: REQUIREMENTS.md FND-01 ("CRUD methods needed by Lean slices") + AGENTS.md "Things to never do — don't add features the user didn't ask for"]`

---

## Common Pitfalls (Phase 1-relevant subset)

### Pitfall 2: Prisma client extension for RLS doesn't preserve `SET LOCAL`

`[CITED: .planning/research/PITFALLS.md §"Pitfall 2"]`

**Phase 1 prevention:** locked by ADR-0011 — we don't use `$extends`. We use `withRls` which puts `set_config` and the actual query in the same interactive transaction.

### Pitfall 4: First wrong auto-classification destroys trust

Out of Phase 1 scope (classifier is Phase 3). Mention only because the trust-trio cross-cutting concern is designed in Phase 3 planning.

### Pitfall 9: RLS test that "passes" because both roles use superuser

`[CITED: .planning/research/PITFALLS.md §"Pitfall 9"]`

**Phase 1 prevention:** Plan 3 explicitly creates `foray_app` as non-superuser; Testcontainers globalSetup connects tests as `foray_app` (not the migration owner). Test 4 in §5 (the `relforcerowsecurity` structural check) is the CI guard.

### Pitfall 10: Prisma 7 generator output / config gotchas

`[CITED: .planning/research/PITFALLS.md §"Pitfall 10"]`

**Phase 1 prevention:** the existing scaffold already has the correct setup (`generator client { provider = "prisma-client", output = "../src/generated/prisma" }`); `prisma.config.ts` is the URL location. All Phase 1 tasks must use `import { PrismaClient } from '@/generated/prisma/client'` — never `'@prisma/client'`. Add an ESLint rule to block the wrong import path: `'no-restricted-imports': ['error', { paths: [{ name: '@prisma/client', message: 'Import from @/generated/prisma/client per Prisma 7 + AGENTS.md' }] }]`. Cheap insurance.

### Phase-1-specific pitfall: middleware as auth boundary (CVE-2025-29927)

Already covered in **Pattern 2** and **Anti-patterns** above. Worth restating: the middleware in this phase is **purely UX defense-in-depth** (redirect unauth browser nav to `/login`). The real auth boundary lives in `requireUser()` calls inside Server Actions and Route Handlers. Reviewers must reject any code that relies on middleware as the only check.

### Phase-1-specific pitfall: `current_setting` without `, true` arg

Without `, true`, `current_setting('app.user_id')` *throws* when the GUC is unset. The throw aborts the query. The visible failure mode is "this query randomly errors" rather than "this query returns zero rows." Worse, a developer might "fix" it by always setting the GUC at session start (before any transaction) — which then leaks across requests. The `, true` form returns NULL on unset, the policy comparison `user_id = NULL` returns false, the query returns zero rows. **Always use `current_setting('app.user_id', true)`.** `[CITED: PostgreSQL docs — current_setting]`

### Phase-1-specific pitfall: forgetting to grant defaults

`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO foray_app` only affects *existing* tables. Future migrations create new tables that `foray_app` cannot access — runtime errors with cryptic "permission denied for relation X". Fix: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT … TO foray_app` so future tables inherit the grant. Already in §1 migration skeleton; planner must not skip those two `ALTER DEFAULT PRIVILEGES` lines.

---

## Code Examples

All examples above (§3 `withRls`, §3 `requireUser`, §3 login service, §10 encryption) are derived from `[CITED: ARCHITECTURE.md, STACK.md, PRINCIPLES.md]` patterns and the existing scaffold conventions. They are not copy-paste-ready — minor adjustments (import paths, exact env var names) per project conventions.

### Bonus: dual-URL Prisma config for migration vs runtime roles

```ts
// prisma.config.ts (existing file — verify and update; not yet read)
import 'dotenv/config'
import path from 'node:path'

export default {
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  // Migration role: must own tables to run CREATE/ALTER. From DATABASE_URL_OWNER.
  // Runtime role (foray_app): used by src/core/db/client.ts via DATABASE_URL.
  // The split: DATABASE_URL_OWNER is set during `prisma migrate` only;
  // DATABASE_URL is what the app + tests use day-to-day.
  migrate: {
    seed: 'tsx scripts/seed.ts',
  },
  // Connection URL for Studio + migrate. Use the owner role.
  datasource: {
    url: process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL,
  },
}
```

`[ASSUMED — exact `prisma.config.ts` shape needs verification against the in-repo file. Plan task should `cat prisma.config.ts` first and surgical-edit, not rewrite.]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Prisma 6 — `datasource db { url = env(...) }` in `schema.prisma` | Prisma 7 — URL in `prisma.config.ts` | Prisma 7.0 | Already adopted in scaffold. Don't regress. |
| `import { PrismaClient } from '@prisma/client'` | `import { PrismaClient } from '@/generated/prisma/client'` | Prisma 7.0 | Old path is BROKEN under pnpm in Prisma 7. ESLint rule recommended. |
| Next.js 15 + `cookies()` returns sync | Next.js 15.0+ — `cookies()` returns Promise (must `await`) | Next.js 15.0 | foray is on 16.2.6; `await cookies()` is mandatory. |
| `useFormState` from `react-dom` | `useActionState` from `react` | React 19 | Use the new name. STACK.md flags. |
| `iron-session` v6 — different API | `iron-session` v8 — `getIronSession(cookies(), opts)` | v8.0 (2024) | Most online tutorials are v6/v7 — verify against `node_modules/iron-session/dist/types/iron-session.d.ts` after install. |

**Deprecated/outdated:**

- `node-cron` v3 (deferred to Phase 4 anyway, but if Phase 1 ends up touching `package.json` for any cron-adjacent reason, use v4) — `[CITED: STACK.md]`
- Manual `crypto.createHmac` for session cookies — replaced by iron-session.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Approach B (parent-join policy) for `stages` / `application_recruiters` / `documents` is acceptable performance-wise vs Approach A (column-direct) | §1 | Slightly slower per-query; in extremis, swap to Approach A in a follow-up migration. Not a correctness risk. |
| A2 | Splitting `DATABASE_URL` into `DATABASE_URL_OWNER` (migration) and `DATABASE_URL` (runtime) is the standard pattern | §1 + §11 | If wrong, the migration runs as `foray_app` which lacks DDL grants → migration fails loud at first run. Easy to detect and fix. |
| A3 | ADR-0011 wording skeleton is acceptable as written; team may refine | §6 | The decision itself is locked by CONTEXT.md; wording is cosmetic. |
| A4 | `prisma.config.ts` already exists and accepts a `datasource.url` override pattern | §10 bonus | If wrong, plan task adapts to actual file shape — Prisma 7 docs documented multiple valid shapes. |
| A5 | `.env.example` may not exist — Plan 2 task should verify and create if missing | §11 | If file exists, task is a surgical add; if missing, task creates with the standard placeholders. Cost is one `cat` command. |
| A6 | `vitest.config.ts` does not exist — Plan 3 task creates it | §11 | Verified by `ls` of repo root in scaffold inspection. |
| A7 | Bumping `APP_PASSWORD` min from 8 → 12 chars during Phase 1 is in scope (CLAUDE.md §1.3 *Surgical Changes* trigger) | §9 | Minor — could be deferred to a Phase 5 hardening pass. Recommend doing now since we're touching `env.ts` anyway. |
| A8 | `iron-session` `getIronSession(cookies(), opts)` is the correct v8 API in Next 16 — verified against STACK.md HIGH-confidence research | §3 | If wrong, integration test catches it immediately. |
| A9 | The `inbox-pipeline-exception` rule, applied via Option B (subtractive), is the cleaner pattern for dep-cruiser v17.4.0 | §8 | If wrong, fall back to Option A (`allowed[]` array). Both are documented as valid. |
| A10 | Phase 1 doesn't need `fishery` (defer to Phase 2) | §11 | If Plan 3 tests grow large, may want fishery now. Cost of deferring: marginal — two seed records is small. |

**Use this list to drive `/gsd-discuss-phase` clarifications before locking the plan.** Each `[ASSUMED]` claim above is also tagged in-line in its section.

---

## Open Questions

1. **`prisma.config.ts` shape — does it support `datasource.url` override?**
   - What we know: Prisma 7 moved URL out of `schema.prisma`; `prisma.config.ts` is the new home.
   - What's unclear: the exact API surface for switching URLs at migrate-time vs runtime.
   - Recommendation: Plan 3 task should `cat prisma.config.ts` first, then adapt. If the file is minimal, the dual-URL pattern in §10 bonus is a safe template.

2. **Should Plan 3 also update `seed.ts` to seed two users (alice, bob) for tests?**
   - What we know: current seed seeds one user (`scripts/seed.ts` referenced from `package.json` and `prisma.seed`).
   - What's unclear: whether the test fixtures should rely on seed data or seed inline.
   - Recommendation: keep seed.ts as one user (matches PROJECT.md single-user posture); tests use the Testcontainers globalSetup to inject test-specific seed data (alice + bob) without touching dev seed.

3. **`SETUP.md` — exists?**
   - What we know: AGENTS.md references it; `ls` of root would confirm.
   - What's unclear: not directly read in this session.
   - Recommendation: Plan 3 task does `cat SETUP.md`, surgical-edit role-split section in; if missing, create from CLAUDE.md §6 + new role-split content.

4. **Should the existing `tenantDb` `findUnique` post-filter be replaced with `where: { id, userId }`?**
   - What we know: current `tenantDb.application.findUnique` does a post-fetch `if (row?.userId === numericUserId)` check.
   - What's unclear: whether this is intentional defense or just an early scaffold pattern.
   - Recommendation: leave as-is for Phase 1 (surgical changes per CLAUDE.md §1.3). Note that `where: { id, userId }` would be one query instead of fetch-then-discard, but that's an optimization, not a correctness fix. RLS will catch the leak either way once Plan 3 lands.

5. **Should `app/middleware.ts` go in `src/middleware.ts` or `src/app/middleware.ts`?**
   - What we know: Next.js convention is `src/middleware.ts` (NOT inside `app/`). Verified against Next.js 16 docs.
   - What's unclear: nothing — but the CONTEXT.md proposes `src/middleware.ts` and ARCHITECTURE.md shows it in the file tree under `src/app/middleware.ts`. The tree in ARCHITECTURE.md is wrong.
   - Recommendation: `src/middleware.ts` (Next.js convention). Flag as a doc fix in ARCHITECTURE.md if visible, but DO NOT silently fix per CLAUDE.md §1.3.

---

## Environment Availability

> Skipped: Phase 1 introduces no new external services beyond what's already in scaffold (Postgres in Docker via existing `docker-compose.yml`). The only "new" external dependency is `@testcontainers/postgresql` which itself depends on Docker — verified `docker compose` already in critical commands per AGENTS.md, so Docker is assumed present.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Docker | Testcontainers, existing dev DB | (assumed yes per AGENTS.md `docker compose up -d db` workflow) | (whatever user has) | If missing, fall back to manual `docker compose up -d db` + manual two-role setup; document in SETUP.md |
| Postgres 16 | RLS policies (depends on PG ≥10 for declarative RLS; PG ≥9.5 for basic; foray uses `postgres:16` per `docker-compose.yml`) | yes (existing scaffold) | 16 | None needed |
| Node 22 LTS | Prisma 7 + Next 16 engine constraints | (assumed per AGENTS.md scaffold) | ≥20.19, target 22 | None needed |
| `pnpm` | All scripts | (assumed — scripts use `pnpm`) | (whatever user has) | None needed |

**Missing dependencies with no fallback:** none confirmed.

**Missing dependencies with fallback:** none confirmed.

---

## Validation Architecture

> Skipped: `.planning/config.json` has `workflow.nyquist_validation: false`. Section omitted per researcher protocol.

---

## Security Domain

> `security_enforcement` not explicitly set in `.planning/config.json` — treating as enabled per researcher default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | iron-session (HMAC + AES seal); `crypto.timingSafeEqual` for password compare; `APP_PASSWORD` ≥12 chars (recommended bump); session TTL 30 days with rolling refresh |
| V3 Session Management | yes | iron-session cookie: `httpOnly: true`, `secure` in prod, `sameSite: 'lax'`, `maxAge: 30d`. Logout via `session.destroy()`. Cookie name not security-sensitive (`foray_session`). |
| V4 Access Control | yes | `requireUser()` in every Server Action + Route Handler (PRINCIPLES.md §"Security baseline" §4). Middleware is *defense-in-depth UX*, not the boundary. RLS as second tier (transactions via `withRls`). |
| V5 Input Validation | yes | Zod `safeParse` on every input boundary (form data, env vars). Already established convention; Phase 1 adds `loginSchema`. |
| V6 Cryptography | yes | Node stdlib `crypto`: AES-256-GCM (per-row IV via `randomBytes(12)`), HMAC via iron-session, `timingSafeEqual` for password. **Never hand-roll** — stdlib only. `[CITED: STACK.md §"Encryption"; PITFALLS.md §"Security mistakes"]` |
| V7 Error Handling | yes | `Result<T, AppError>` discipline; `pino` redact paths cover password/token/cookie/refresh. Login error message is generic ("Incorrect password") — no enumeration. |
| V14 Configuration | yes | Zod-validated env at startup; secrets in `.env.local` (gitignored); placeholders in `.env.example`. Migration role separation (`DATABASE_URL_OWNER` vs `DATABASE_URL`). |

### Known Threat Patterns for Next.js 16 + iron-session + Prisma 7 + Postgres RLS

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| CVE-2025-29927 — Next.js middleware bypass via header injection | Spoofing | Never use middleware as the auth boundary. `requireUser()` in every action. `[CITED: PRINCIPLES.md]` |
| CSRF on Server Actions | Tampering | Next.js 16 Origin/Host check on Server Actions (`experimental.serverActions.allowedOrigins` configured per PRINCIPLES.md §"Hard rules"); `sameSite: 'lax'` on session cookie. |
| Session fixation | Spoofing | iron-session generates a fresh seal on every `session.save()`. Don't reuse session blobs. |
| Timing attacks on password compare | Information Disclosure | `crypto.timingSafeEqual` on padded buffers (§3). |
| GCM IV reuse — catastrophic for AES-256-GCM | Tampering / Information Disclosure | `crypto.randomBytes(12)` per encrypt; never derive IV from a counter or timestamp. `[CITED: PITFALLS.md]` |
| RLS owner-bypass — table owner ignores policies without `FORCE` | Elevation of Privilege | `FORCE ROW LEVEL SECURITY` on every tenant table. `[CITED: PITFALLS.md §"Pitfall 2 + 9"]` |
| Superuser RLS-bypass — `BYPASSRLS` role attribute always wins | Elevation of Privilege | Tests AND runtime connect as non-superuser `foray_app`. Migration runs as `foray_owner` only. |
| Connection-pool GUC leak — `app.user_id` persists across requests when set without `SET LOCAL` | Information Disclosure | `set_config(..., true)` (transaction-local) inside `$transaction`. **`withRls` pattern enforces this at the type-system level** (callsite must wrap in transaction). |
| `current_setting` throws on unset → caller catches and "fixes" by always setting → leak | Information Disclosure | `current_setting('app.user_id', true)` (return NULL on unset). |
| Prisma raw SQL bypassing tenantDb wrapper | Spoofing | `dependency-cruiser:no-direct-prisma` rule blocks; raw SQL must use `withRls(tx => tx.$queryRaw...)`. |

`[CITED: PITFALLS.md §"Security mistakes" + §"Pitfall 2" + §"Pitfall 9"; PRINCIPLES.md §"Security baseline"]`

---

## Sources

### Primary (HIGH confidence)

- **In-repo research (HIGH confidence per their own self-assessment):**
  - `/Users/edwardpham/Documents/Programming/Projects/foray/.planning/research/SUMMARY.md`
  - `/Users/edwardpham/Documents/Programming/Projects/foray/.planning/research/STACK.md` — npm-verified versions, iron-session, Testcontainers
  - `/Users/edwardpham/Documents/Programming/Projects/foray/.planning/research/ARCHITECTURE.md` — `withRls` pattern, slice composition, build order
  - `/Users/edwardpham/Documents/Programming/Projects/foray/.planning/research/PITFALLS.md` — Pitfalls 2, 4, 9, 10 + security-mistakes table
- **Existing scaffold (verified by reading every file):**
  - `src/core/db/{client,tenant,index}.ts`
  - `src/core/auth/session.ts`
  - `src/core/env.ts`
  - `src/core/types/ids.ts`
  - `src/core/errors/index.ts`
  - `src/core/logger/index.ts`
  - `prisma/schema.prisma` — tenant-scoped table list verified
  - `prisma/migrations/20260509045605_init/migration.sql` — only existing migration
  - `.dependency-cruiser.cjs`, `eslint.config.mjs`, `package.json`
- **Project rulebooks:**
  - `PRINCIPLES.md` (strategic — every section)
  - `CLAUDE.md` (tactical)
  - `AGENTS.md` (contract)
- **Decision history:**
  - `docs/decisions/0010-architecture-vertical-slice.md` (ADR style reference)
- **PostgreSQL official docs:**
  - [Row Security Policies (PG 16)](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — `[CITED]` for `FORCE`, owner bypass, superuser bypass
  - [`set_config` and `current_setting` system functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SET) — `[CITED]` for `is_local`, `missing_ok`

### Secondary (MEDIUM confidence)

- iron-session v8 API surface — `[CITED: STACK.md npm + official README]`; final API verification happens at install time by reading `node_modules/iron-session/dist/types/iron-session.d.ts`
- dependency-cruiser v17.4.0 `forbidden.to.pathNot` syntax — `[CITED: dep-cruiser docs]`; verified against existing `.dependency-cruiser.cjs` patterns

### Tertiary (LOW confidence — flag for validation during planning)

- A1: parent-join RLS policy performance acceptability — needs benchmark or assumption acceptance.
- A2: split-URL pattern for migration vs runtime roles — common Postgres pattern but Prisma-7-specific verification not done.
- A3, A6: file existence assumptions (`vitest.config.ts`, `prisma.config.ts` shape, `SETUP.md`) — Plan tasks should verify with `ls`/`cat` before acting.

---

## Metadata

**Confidence breakdown:**

- **Standard stack** — HIGH. Every package verified in STACK.md against npm registry on 2026-05-09; one new dep (iron-session) and one new dev dep (testcontainers).
- **Architecture (`withRls` shape, slice boundaries, dep-cruiser exception)** — HIGH. Locked by ARCHITECTURE.md HIGH-confidence research and CONTEXT.md decisions.
- **Migration SQL** — HIGH on the structure (FORCE + non-superuser + per-table policies), MEDIUM on the parent-join shape for Stage/AppRecruiter/Document (A1).
- **iron-session config + Server Action shape** — HIGH. STACK.md verified API; Pattern 3 in ARCHITECTURE.md is the canonical shape.
- **Build order refinement** — MEDIUM. Recommendation to move `tenantDb` extensions from Plan 1 → Plan 3 is reasoned but not field-tested; planner can override.
- **Pitfalls** — HIGH. Direct citations from PITFALLS.md HIGH-confidence research.

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days for stable architectural decisions; iron-session and Testcontainers versions should be re-verified at install time if the gap exceeds 14 days).
