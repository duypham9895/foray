---
phase: 01-foundation-auth
status: applied
findings_addressed: 6
findings_skipped: 4
iterations: 1
---

# Phase 1: Foundation + Auth — Code Review Fix Report

**Fixed at:** 2026-05-09T15:00:00Z
**Source review:** `.planning/phases/01-foundation-auth/01-REVIEW.md`
**Iteration:** 1

## Summary

All 6 in-scope findings (2 P1, 4 P2) were addressed in separate atomic commits. The
4 P3 findings were intentionally skipped per task scope (nits deferred to future polish).
Pre-commit gate ran after all fixes: `pnpm lint` had 1 pre-existing error in `setup.ts`
(not touched by these commits — confirmed via `git diff`); `pnpm typecheck`, `pnpm test:run`
(15/15 tests passed), and `pnpm build` all passed clean.

## Findings Addressed

| Finding | File(s) | Fix Description | Commit SHA |
|---------|---------|-----------------|------------|
| P1-01 | `src/core/crypto/encryption.ts`, `src/core/crypto/encryption.test.ts` | Changed `decryptToken` return type from `string` (throws) to `Result<string, AppError>`. Malformed blob returns `err(errors.validation(...))`. GCM auth-tag failure caught in try/catch and returns `err(errors.validation(...))`. Tests updated to assert `.isOk()`, `.isErr()`, and `._unsafeUnwrap()`. | `b71120b` |
| P1-02 | `src/core/db/tenant.ts` | Added `@throws` JSDoc to `stage.create`, `stage.update`, and `stage.delete` documenting that these methods MUST be called inside `withRls()` so that `fromPromise()` converts the throw to `err(errors.db(cause))`. Option (a) chosen — lower churn than changing return types before any caller exists. | `120e631` |
| P2-01 | `src/core/db/tenant.ts` | Injected `userId: numericUserId` into the `where` clause of `company.upsert`, consistent with the pattern used in `company.update`, `application.update`, and `application.delete`. | `087e89a` |
| P2-02 | `src/features/auth/actions.ts`, `src/features/auth/components/login-form.tsx` | Added `export` to `LoginState` in `actions.ts`. Removed the duplicate local type declaration in `login-form.tsx` and replaced the `login` import with `{ login, type LoginState }`. | `88cb546` |
| P2-03 | `src/core/env.ts`, `src/core/env.test.ts` | Added `export` to `envSchema` in `env.ts` (the `safeParse` call is unchanged). Replaced the inline schema copy in `env.test.ts` with `import { envSchema } from './env'`. | `92c77dd` |
| P2-04 | `src/core/db/tenant.ts` | Updated TODO marker from `// TODO(full-milestone): ...` to `// TODO(duy, 2026-05-09): add tenantDb wrappers for recruiter, applicationRecruiter, document (Full milestone)` per PRINCIPLES.md §"Tech debt vocabulary". | `3496682` |

## Findings Skipped (P3)

These findings were out of scope per the task instructions ("skip P3 — nits, deferred to future polish").

- **P3-01** (`src/core/crypto/encryption.ts:8,47`): `TAG_BYTES` dead constant suppressed with `void`. Recommendation: remove constant, add inline comment to `setAuthTag` line. Skipped — cosmetic, no correctness impact.
- **P3-02** (`src/core/env.ts:43-45`): `console.error` used in startup path without explicit `eslint-disable`. Recommendation: add `// eslint-disable-next-line no-console` comments. Skipped — pragmatic exception is understood; not the source of the existing lint error.
- **P3-03** (`.env.example`): `DATABASE_URL_OWNER` documented in `SETUP.md` but absent from `.env.example`. Skipped — workflow/docs concern, no code impact.
- **P3-04** (`src/core/db/with-rls.ts:31`): Interactive transaction timeout undocumented. Recommendation: add optional `timeout` parameter or inline comment. Skipped — no long-running callers exist in Phase 1.

## Pre-commit Gate Result

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm lint` | WARN (pre-existing) | 1 error in `tests/integration/setup.ts` (`@typescript-eslint/no-require-imports`) — pre-dates these commits, confirmed via `git diff 6beb9d1 HEAD -- setup.ts` returning empty |
| `pnpm typecheck` | PASS | Clean — 0 errors |
| `pnpm test:run` | PASS | 15 passed, 4 todo (Testcontainers + unit tests) |
| `pnpm build` | PASS | Clean production build, 3 static routes |

---

_Fixed: 2026-05-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
