---
phase: 01-foundation-auth
status: findings
depth: standard
files_reviewed: 28
findings_p0: 0
findings_p1: 2
findings_p2: 4
findings_p3: 4
---

# Phase 1: Foundation + Auth — Code Review

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** findings (2 P1, 4 P2, 4 P3 — no P0)

---

## Summary

Phase 1 delivers the multi-tenant safety net and auth boundary the project depends on. The core architectural decisions are sound and correctly implemented: FORCE RLS on all 9 tenant tables, non-superuser `foray_app` role, NULLIF for empty-string GUC handling, transaction-local `set_config`, iron-session with `timingSafeEqual`, AES-256-GCM with per-call random IV, and a Testcontainers escape-proof test suite that proves all four Pitfall 9 vectors. No P0 findings.

The two P1 findings are localized error-handling contract violations: `decryptToken` and the `tenantDb.stage` mutation methods both throw raw `Error` at expected-failure boundaries rather than returning `Result<T, AppError>`. These are not exploitable today (no caller exists yet) but they violate the `neverthrow` contract that PRINCIPLES.md mandates, and they will cause `eslint-plugin-neverthrow` to miss real error paths when Phase 4 (OAuth) and future slices consume them.

Top 3 concerns in priority order:

1. `decryptToken` throws on auth-tag failure (tampered ciphertext) and malformed blob — a runtime error from a corrupt stored token is not a programmer error. Phase 4 callers will need to `try/catch` this, which `eslint-plugin-neverthrow` cannot verify.
2. `tenantDb.stage.create/update/delete` throw `Error` on tenant-scope violations — inconsistent with the `Result`-based contract that all other `tenantDb` methods follow, and invisible to the neverthrow lint rule.
3. `company.upsert` passes the caller's `where` clause unchanged (no `userId` injection) — the app-layer belt is missing for the upsert path. The schema's `@@unique([userId, name])` constraint makes exploitation unlikely in practice, but the invariant is undefended at the code layer.

---

## P1 Findings

### P1-01: `decryptToken` throws raw `Error` instead of returning `Result`

**File:** `src/core/crypto/encryption.ts:34-42`

**Issue:** `decryptToken` throws `new Error('Malformed encrypted blob')` for format violations and allows `decipher.final()` to throw (via GCM auth-tag failure) for tampered ciphertext. PRINCIPLES.md §"Error handling" requires `Result<T, AppError>` at every expected-failure boundary. A corrupt or tampered token in the DB is a runtime failure, not a programmer error. Phase 4 callers (Gmail OAuth token decryption) will need an unchecked `try/catch`, which the `eslint-plugin-neverthrow` enforcer cannot validate.

```ts
// Current (throws):
export function decryptToken(blob: string): string {
  const parts = blob.split('.')
  if (parts.length !== 3) throw new Error('Malformed encrypted blob')
  // ...
}

// Fix — return Result:
import { ok, err, type Result } from '@/core/errors'

export function decryptToken(blob: string): Result<string, AppError> {
  const parts = blob.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return err(errors.validation([{ code: 'custom', message: 'Malformed encrypted blob', path: [] }]))
  }
  try {
    const iv  = Buffer.from(parts[0], 'base64')
    const tag = Buffer.from(parts[1], 'base64')
    const ct  = Buffer.from(parts[2], 'base64')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    return ok(plaintext)
  } catch {
    return err(errors.validation([{ code: 'custom', message: 'Decryption failed (tampered or corrupt)', path: [] }]))
  }
}
```

**Impact:** All Phase 4 callers that decrypt Gmail refresh tokens must add a `try/catch` wrapper. If they forget, the `eslint-plugin-neverthrow` check will not catch the gap (it only tracks `Result`). An uncaught `decipher.final()` throw would propagate as an unhandled Server Action error.

---

### P1-02: `tenantDb.stage` mutations throw raw `Error` instead of returning `Result`

**File:** `src/core/db/tenant.ts:190, 203, 215`

**Issue:** `tenantDb.stage.create`, `.update`, and `.delete` throw `new Error('Stage parent application not in tenant scope')` / `'Stage not in tenant scope'` when the parent check fails. Every other `tenantDb` method is synchronous or returns a plain `Promise<T>` — callers that use `tenantDb` inside a `withRls` block returning `ResultAsync` will have an unhandled throw escape the `fromPromise` boundary only if the throw happens before any awaited statement. More critically, callers outside `withRls` cannot detect this failure type through the type system. PRINCIPLES.md §"Error handling" requires returning `Result` for authorization failures (not just programmer invariants).

```ts
// Current (throws):
create: async (args: Prisma.StageCreateArgs) => {
  // ...
  if (app?.userId !== numericUserId) {
    throw new Error('Stage parent application not in tenant scope')
  }
  return prisma.stage.create(args)
}

// Fix — throw is actually fine here IF withRls wraps it via fromPromise
// which converts throws to err(). But the public API is misleading.
// Preferred: return a discriminated union that callers can match on.
// At minimum: document the throw contract in the JSDoc so callers know
// withRls is mandatory (not optional) for these methods.

/**
 * @throws {Error} if the parent application does not belong to this tenant.
 *   Must be called inside withRls() — fromPromise() will convert the throw to err().
 *   Calling outside withRls() will propagate the throw to the caller.
 */
create: async (args: Prisma.StageCreateArgs) => { ... }
```

Note: if these methods are always called inside `withRls(userId, async tx => ...)`, the `fromPromise` call in `withRls` converts thrown errors to `err(errors.db(cause))`. But the contract is not enforced — nothing prevents a caller from using `tenantDb(userId).stage.create(...)` directly, where the throw propagates uncaught.

**Recommendation:** Either (a) document with `@throws` JSDoc that these methods MUST be wrapped in `withRls`, and add a lint comment explaining why, or (b) change the return type to `Promise<Result<T, AppError>>` for consistency. Option (b) is the PRINCIPLES.md-compliant path.

---

## P2 Findings

### P2-01: `company.upsert` does not inject `userId` into the WHERE clause

**File:** `src/core/db/tenant.ts:152-160`

**Issue:** `tenantDb.company.upsert` injects `userId` into `create` (correct) but passes the caller's `where` clause unchanged. All other write methods (`application.update`, `application.delete`, `email.update`, `company.update`) explicitly inject `userId` into `where`. The asymmetry means a caller could pass `where: { id: BOB_COMPANY_ID }`, and if that record exists, the UPDATE branch runs against another tenant's data at the app layer.

In practice, the schema's `@@unique([userId, name])` forces callers to use `where: { userId_name: { userId, name } }` for the common upsert pattern, which naturally includes `userId`. And RLS WITH CHECK blocks the UPDATE if `app.user_id` is set correctly. However: the gap is a departure from the consistent belt-and-suspenders pattern and a footgun for future callers who upsert by `id` alone.

```ts
// Current (missing userId in WHERE):
upsert: (args) =>
  prisma.company.upsert({
    ...args,
    create: { ...args.create, user: { connect: { id: numericUserId } } },
  }),

// Fix — inject userId into where (Prisma upsert allows compound unique where):
upsert: (args: Omit<Prisma.CompanyUpsertArgs, 'create'> & {
  create: Omit<Prisma.CompanyCreateInput, 'user'>
}) =>
  prisma.company.upsert({
    ...args,
    where: { ...args.where, userId: numericUserId } as Prisma.CompanyWhereUniqueInput,
    create: { ...args.create, user: { connect: { id: numericUserId } } },
  }),
```

---

### P2-02: `LoginState` type duplicated across `actions.ts` and `login-form.tsx`

**File:** `src/features/auth/actions.ts:7-9` and `src/features/auth/components/login-form.tsx:5-8`

**Issue:** `LoginState` is declared identically in both files. The component imports `login` from `actions.ts` but re-declares the type rather than importing it. If `LoginState` gains a new variant (e.g., rate-limit state), the component's copy silently diverges — TypeScript will not catch the mismatch because the component uses its own local type, not the one from `actions.ts`.

```ts
// Fix — export LoginState from actions.ts:
export type LoginState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> }

// In login-form.tsx — remove the duplicate declaration and import:
import { login, type LoginState } from '../actions'
```

---

### P2-03: `env.test.ts` copies the schema inline — drift not caught by TypeScript

**File:** `src/core/env.test.ts:21-37`

**Issue:** The test file reproduces the entire `envSchema` inline rather than importing it from `env.ts`. The comment acknowledges this ("If the real schema drifts, these tests will tell you") but this is backwards: the test schema is the copy that would drift silently. If `env.ts` adds a new required field (e.g., `DATABASE_URL_OWNER`), `env.test.ts` does not add it, and the tests continue passing with the stale fixture.

**Recommendation:** Export the Zod schema from `env.ts` (without the `safeParse` call) so `env.test.ts` can import and test the real schema:

```ts
// env.ts — export the schema:
export const envSchema = z.object({ ... })
// (keep the safeParse call below)

// env.test.ts — import and test the real schema:
import { envSchema } from './env'
```

This makes the schema the single source of truth for both validation and tests.

---

### P2-04: TODO marker in `tenant.ts` missing required name and date

**File:** `src/core/db/tenant.ts:221`

**Issue:** The marker reads `// TODO(full-milestone): add wrappers...`. CLAUDE.md §"Tech debt vocabulary" requires the format `TODO(name, YYYY-MM-DD): description`. Without a date, the marker becomes perpetually undated and harder to triage in quarterly cleanup passes. Without a name, accountability is lost.

```ts
// Current:
// TODO(full-milestone): add wrappers for recruiter, applicationRecruiter, document.

// Fix:
// TODO(duy, 2026-05-09): add tenantDb wrappers for recruiter, applicationRecruiter, document (Full milestone)
```

---

## P3 Findings

### P3-01: `TAG_BYTES` constant is declared but never used (suppressed with `void`)

**File:** `src/core/crypto/encryption.ts:8, 47`

**Issue:** `TAG_BYTES = 16` is declared as a module-level constant with `void TAG_BYTES` to suppress the unused-variable lint warning. The comment explains it exists for documentation purposes, but a dead constant suppressed by `void` is misleading. GCM always produces a 16-byte authentication tag regardless of this constant — it is never passed to any crypto API call.

**Recommendation:** Remove the constant and add an inline comment to the `setAuthTag` line if documentation is needed:

```ts
// Remove:
// const TAG_BYTES = 16
// void TAG_BYTES

// Instead, inline the documentation where relevant:
decipher.setAuthTag(tag) // GCM auth tag — 16 bytes (128-bit, standard GCM output)
```

---

### P3-02: `console.error` used in `env.ts` startup path

**File:** `src/core/env.ts:43-45`

**Issue:** `console.error` is used to print validation errors before the `throw`. PRINCIPLES.md §"Observability" states `console.log` is forbidden (enforced via ESLint `no-console`), with `logger.info(...)` required instead. This is the env initialization path — pino cannot be used here because `logger` itself depends on `env` — so the pragmatic exception is understandable.

**Recommendation:** Add an ESLint disable comment to make the exception explicit and searchable:

```ts
// eslint-disable-next-line no-console
console.error('Invalid environment variables:')
// eslint-disable-next-line no-console
console.error(`  ${issue.path.join('.')}: ${issue.message}`)
```

This signals to future reviewers that the exception is deliberate, not overlooked.

---

### P3-03: `DATABASE_URL_OWNER` documented in `SETUP.md` but absent from `.env.example`

**File:** `SETUP.md:211-222` / `.env.example`

**Issue:** `SETUP.md` §"Database role split" documents `DATABASE_URL_OWNER` as a required env var for running migrations as the owner role. However, `.env.example` does not include a `DATABASE_URL_OWNER` placeholder. Developers copying `.env.example` to `.env.local` will not have the variable and must read SETUP.md to discover it.

Note: `prisma.config.ts` only uses `DATABASE_URL`, not `DATABASE_URL_OWNER`. The role split currently requires manual URL swapping by the developer rather than tooling enforcement. This is a follow-up workflow concern.

**Recommendation:** Add to `.env.example`:

```bash
# Role split: owner runs migrations, foray_app runs the app + tests (Phase 1+)
# DATABASE_URL = foray_app connection (non-superuser, FORCE RLS active)
# DATABASE_URL_OWNER = foray_owner connection (used only for pnpm prisma migrate dev/deploy)
DATABASE_URL_OWNER=postgresql://foray:foray@localhost:5432/foray
```

---

### P3-04: `withRls` uses Prisma's default interactive transaction timeout (5 seconds)

**File:** `src/core/db/with-rls.ts:31`

**Issue:** `prisma.$transaction(async tx => { ... })` uses the default 5-second timeout for interactive transactions. For Phase 1 this is fine — no long-running ops exist. But future callers (Phase 4 email pipeline batch inserts, Phase 2 application create + event create) could hit this timeout silently, resulting in a mysterious `ResultAsync err` with a Prisma transaction timeout error.

**Recommendation:** Document the default timeout in a comment so future callers know to pass `{ timeout: N }` for long-running operations, or expose it as an optional parameter:

```ts
export function withRls<T>(
  userId: UserId,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number }, // ms; default 5000 (Prisma interactive tx limit)
): ResultAsync<T, AppError> {
  return fromPromise(
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`
      return fn(tx)
    }, options),
    (cause) => errors.db(cause),
  )
}
```

---

## Strengths

**RLS implementation is correct and complete.** FORCE ROW LEVEL SECURITY on all 9 tenant tables, non-superuser `foray_app` role, NULLIF for empty-string GUC handling, and `set_config` third-arg `true` for transaction-local scoping — all four Pitfall 2 + 9 vectors are closed. The structural test (Test 4 in `rls-escape.test.ts`) will catch any future migration that adds a tenant table without `FORCE`.

**Testcontainers escape suite is production-grade.** The test harness correctly seeds two users (alice/bob), applies migrations as the owner, switches to `foray_app` for test execution, and proves RLS denial for raw SQL inside AND outside `withRls`. The per-model isolation test correctly validates both the WHERE-filter (app layer) and RLS (DB layer) independently.

**AES-256-GCM implementation is correct.** 12-byte IV per NIST SP 800-38D, random IV per call, authentication tag handled, fail-fast key-length guard at module load. The test suite covers round-trip, UTF-8, random-IV uniqueness, tamper detection, and malformed blob — all five correctness properties.

**iron-session configuration is secure.** `httpOnly=true`, `sameSite=lax` (documented rationale: bookmarklet compatibility), `secure=true` in production only, `maxAge=30d`, and a 32+ char session secret enforced by Zod. The CVE-2025-29927 posture is correctly implemented: middleware checks cookie presence only; `requireUser()` is the real auth boundary inside Server Actions.

**`timingSafeEqual` with `padEnd(72)` is a correct constant-time comparison.** The pattern correctly avoids timing side-channels and the length-check guard (`provided.length !== expected.length`) prevents `timingSafeEqual` from throwing on different-length inputs. The `padEnd(72, '\0')` normalizes inputs below 72 chars (the bcrypt max, referenced in the comment) so buffer lengths always match for valid inputs.

**`withRls` return type corrected to `ResultAsync`.** The SUMMARY documents that the plan specified `Promise<Result<T, AppError>>` but the implementation correctly uses `ResultAsync<T, AppError>` — the neverthrow-native type that callers `await` to get `Result<T, AppError>`. This is the right choice and was caught and fixed during implementation.

**Module boundary enforcement is complete and correct.** The `no-cross-feature` rule correctly narrows the inbox→matcher/classifier exception, `no-direct-prisma` blocks raw Prisma imports outside `src/core/db/`, and `__mocks__/` is correctly excluded from orphan detection.

---

## Files Reviewed

| File | Status |
|---|---|
| `.dependency-cruiser.cjs` | clean |
| `.env.example` | P3 (DATABASE_URL_OWNER missing) |
| `docs/decisions/0011-rls-via-with-rls-helper.md` | clean |
| `package.json` | clean |
| `prisma/migrations/20260510000000_add_rls_and_app_role/migration.sql` | clean |
| `SETUP.md` | clean |
| `src/__mocks__/server-only.ts` | clean |
| `src/app/login/page.tsx` | clean |
| `src/core/auth/session-config.ts` | clean |
| `src/core/auth/session.ts` | clean |
| `src/core/crypto/encryption.test.ts` | clean |
| `src/core/crypto/encryption.ts` | P1 (decryptToken throws instead of Result) |
| `src/core/db/index.ts` | clean |
| `src/core/db/README.md` | clean |
| `src/core/db/tenant.ts` | P1 (stage mutations throw), P2 (company.upsert missing userId in WHERE), P2 (TODO marker format) |
| `src/core/db/with-rls.ts` | P3 (no timeout option) |
| `src/core/env.test.ts` | P2 (inline schema drift risk) |
| `src/core/env.ts` | P3 (console.error) |
| `src/features/auth/actions.ts` | P2 (LoginState not exported) |
| `src/features/auth/components/login-form.tsx` | P2 (LoginState duplicated) |
| `src/features/auth/schema.ts` | clean |
| `src/features/auth/service.ts` | clean |
| `src/middleware.ts` | clean |
| `tests/integration/rls-escape.test.ts` | clean |
| `tests/integration/setup.ts` | clean |
| `tests/integration/tenant-db-cross-tenant-leak.test.ts` | clean |
| `tsconfig.json` | clean |
| `vitest.config.ts` | clean |
| `vitest.setup.ts` | clean |

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
