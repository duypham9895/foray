# Phase 1: Foundation + Auth - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Multi-tenant safety net is real (RLS active, type-checked, escape-tested) and the auth boundary is wired so every later slice writes through verified-safe primitives.

**Requirements covered:** FND-01, FND-02, AUTH-01, AUTH-02, AUTH-03

</domain>

<decisions>
## Implementation Decisions

### Locked by research synthesis (`.planning/research/SUMMARY.md` HIGH confidence)

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable assets (already in repo)

- `src/core/db/{client,tenant,index}.ts` — Prisma singleton + `tenantDb` wrapper (currently only wraps `application.findMany/findUnique/findFirst/count`)
- `src/core/types/ids.ts` — branded ID types (`UserId`, `ApplicationId`, `EmailId`)
- `src/core/errors/index.ts` — `AppError` + `neverthrow` re-export
- `src/core/logger/index.ts` — pino with redaction
- `src/core/env.ts` — Zod-validated process.env
- `src/core/auth/session.ts` — exists with stub `requireUser()` (per AGENTS.md scaffold notes); needs real iron-session wiring
- `prisma/schema.prisma` — all entities defined; initial migration applied; seed script working
- `.dependency-cruiser.cjs` — module boundary rules (added in commit `29593c3`)
- `eslint.config.mjs` — module boundary lint rules

### Established patterns

- Vertical Slice Architecture per ADR-0010; `src/features/<slice>/{actions,service,queries,schema,components}.ts`
- Pages and route handlers ≤5 lines; delegate to slice services
- All fallible operations return `Result<T, AppError>` (neverthrow)
- All Prisma access via `tenantDb(userId)` — direct `prisma.*` outside `src/core/db/` blocked by ESLint `no-direct-prisma`

### Integration points

- `src/middleware.ts` — needs creation (or update if exists) for auth redirect
- `src/app/login/page.tsx` — needs creation (login form, single password field)
- `src/app/api/auth/login/route.ts` — needs creation (verify password, set session cookie)
- `prisma/migrations/<next>_add_rls/migration.sql` — needs creation (RLS policies + non-superuser role grant)

</code_context>

<specifics>
## Specific Ideas

- **iron-session API:** use `getIronSession<SessionData>(cookies(), { password, cookieName, cookieOptions: { secure, httpOnly, sameSite: 'lax' } })`
- **`withRls` API shape:** `withRls(userId: UserId, fn: (tx: TenantTx) => Promise<T>): Promise<Result<T, AppError>>` — opens Prisma `$transaction`, sets `app.user_id`, runs `fn`, commits.
- **RLS policy template per table:** `CREATE POLICY tenant_isolation ON <table> USING (user_id = current_setting('app.user_id')::uuid)` — applied to every tenant-scoped table.
- **Encryption helper location:** `src/core/crypto/encryption.ts` — `encryptToken(plaintext)` returns `{ ciphertext, iv, tag }` as one base64 string; `decryptToken(blob)` reverses.

</specifics>

<deferred>
## Deferred Ideas

- Refresh-token rotation strategy (Phase 4 — OAuth scope, not auth scope)
- Multi-user / SaaS migration of session storage (out of scope per PROJECT.md)
- 2FA, password reset, OAuth login (out of scope — single-user gate is the only Lean auth)
- Test categories (b)-(f) from FND-03 (Phase 5 — verified after all slices exist)

</deferred>
