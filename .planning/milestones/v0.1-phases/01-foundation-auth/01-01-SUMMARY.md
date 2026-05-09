---
phase: "01-foundation-auth"
plan: "01"
subsystem: "core"
tags: ["foundation", "crypto", "db", "rls", "env", "dep-cruiser"]
dependency_graph:
  requires: []
  provides:
    - "env.APP_SESSION_SECRET (Plan 02 iron-session config)"
    - "env.APP_PASSWORD min=12 (hardened single-user gate)"
    - "iron-session@8.0.4 (Plan 02 session cookie wiring)"
    - "@testcontainers/postgresql@11.14.0 (Plan 03 RLS escape tests)"
    - "withRls(userId, tx => …) (Plan 03 RLS tests + every multi-statement op)"
    - "encryptToken / decryptToken (Phase 4 OAuth refresh token at rest)"
    - "src/core/db/index.ts barrel: prisma + tenantDb + withRls"
    - ".dependency-cruiser.cjs inbox-pipeline-exception (Phase 4 CI)"
  affects:
    - "src/core/db/index.ts (new export)"
    - "src/core/env.ts (extended schema)"
    - ".env.example (new placeholder)"
    - ".dependency-cruiser.cjs (narrowed rule)"
tech_stack:
  added:
    - "iron-session@8.0.4 — stateless HMAC-encrypted session cookies"
    - "@testcontainers/postgresql@11.14.0 (dev) — per-suite disposable Postgres for RLS escape tests"
  patterns:
    - "AES-256-GCM via node:crypto — IV_BYTES=12 (NIST SP 800-38D), per-call randomBytes"
    - "withRls: fromPromise(prisma.$transaction(async tx => …), e => errors.db(e))"
    - "vitest.setup.ts global env fixture pattern (avoids module-load-order race)"
key_files:
  created:
    - path: "src/core/db/with-rls.ts"
      lines: 40
      note: "ResultAsync-returning RLS transaction wrapper"
    - path: "src/core/crypto/encryption.ts"
      lines: 47
      note: "AES-256-GCM encryptToken/decryptToken, key-length guard at module load"
    - path: "src/core/crypto/encryption.test.ts"
      lines: 45
      note: "5 tests: round-trip, UTF-8, random IV, tamper-detect, malformed blob"
    - path: "src/core/db/README.md"
      lines: 29
      note: "tenantDb vs withRls usage table + invariants"
    - path: "src/core/env.test.ts"
      lines: 103
      note: "4 tests + 1 variant for APP_SESSION_SECRET and APP_PASSWORD validation"
    - path: "vitest.config.ts"
      lines: 18
      note: "Vitest config with server-only mock alias and global setup"
    - path: "vitest.setup.ts"
      lines: 8
      note: "Global env fixture setup — runs before module load"
    - path: "src/__mocks__/server-only.ts"
      lines: 4
      note: "Vitest no-op mock for server-only (Next.js RSC guard)"
  modified:
    - path: "src/core/env.ts"
      note: "Added APP_SESSION_SECRET (min 32), bumped APP_PASSWORD min 8→12"
    - path: ".env.example"
      note: "Added APP_SESSION_SECRET placeholder with openssl instruction; updated APP_PASSWORD comment"
    - path: "src/core/db/index.ts"
      note: "Added: export { withRls } from './with-rls'"
    - path: ".dependency-cruiser.cjs"
      note: "Narrowed no-cross-feature rule with pathNot for inbox-pipeline-exception; excluded __mocks__/ from no-orphans"
    - path: "package.json"
      note: "Added iron-session@^8.0.4 (dep) + @testcontainers/postgresql@^11.14.0 (devDep)"
decisions:
  - "withRls returns ResultAsync<T,AppError> not Promise<Result<T,AppError>> — fromPromise() return type; plan text said Promise<Result<T,E>> but ResultAsync IS a PromiseLike<Result<T,E>> and is the correct neverthrow type. Callers await it to unwrap the Result."
  - "Vitest global setup file (vitest.setup.ts) to solve env module-load-order race — env.ts throws at module load, process.env assignments in test files are hoisted after imports"
  - "Added __mocks__/ exclusion to dep-cruiser no-orphans rule — test infrastructure files referenced by vitest.config.ts alias, not by source imports"
metrics:
  duration_seconds: 381
  completed_date: "2026-05-09"
  tasks_completed: 3
  files_created: 8
  files_modified: 5
---

# Phase 01 Plan 01: Foundation Primitives Summary

**One-liner:** AES-256-GCM encryption helper + withRls transaction wrapper + env extensions for APP_SESSION_SECRET/APP_PASSWORD + iron-session/testcontainers deps + inbox-pipeline-exception dep-cruiser rule.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add deps + extend env.ts with APP_SESSION_SECRET and bump APP_PASSWORD min | e632b31 | package.json, pnpm-lock.yaml, src/core/env.ts, .env.example, vitest.config.ts, src/__mocks__/server-only.ts, src/core/env.test.ts |
| 2 | Create with-rls.ts + encryption.ts + barrel re-export + README | 883ded4 | src/core/db/with-rls.ts, src/core/crypto/encryption.ts, src/core/crypto/encryption.test.ts, src/core/db/README.md, src/core/db/index.ts, vitest.config.ts (updated), vitest.setup.ts |
| 3 | Narrow no-cross-feature rule to allow inbox→matcher|classifier | 02b8c22 | .dependency-cruiser.cjs |
| lint-fix | Remove unused import + suppress intentional _ destructure | 81bcfdc | src/core/db/with-rls.ts, src/core/env.test.ts |

## Locked Invariants

| Invariant | Location | Value | Reason |
|-----------|----------|-------|--------|
| `set_config` third arg | `with-rls.ts:35` | `true` | Makes GUC transaction-local (SET LOCAL equivalent); without it, value leaks across pool-reused connections |
| `IV_BYTES` | `encryption.ts:9` | `12` (96 bits) | NIST SP 800-38D recommended IV length for AES-GCM |
| `TAG_BYTES` | `encryption.ts:10` | `16` (128 bits) | Standard GCM authentication tag size |
| `APP_PASSWORD` min | `env.ts:22` | `12` | Hardened from 8; 8-char passwords are brute-forceable |
| `APP_SESSION_SECRET` min | `env.ts:24–26` | `32` | iron-session requirement; shorter keys weaken cookie encryption |
| Key-length guard | `encryption.ts:14–16` | `key.length !== 32` throws | Fail-loud invariant — ENCRYPTION_KEY misconfiguration caught at module load, not first encrypt call |

## Downstream Consumers

| Consumer | Plan | What it reads |
|----------|------|---------------|
| Auth slice (login/session) | Plan 02 | `env.APP_SESSION_SECRET` for iron-session config |
| RLS migration + escape tests | Plan 03 | `withRls` (transaction wrapper) + `@testcontainers/postgresql` |
| OAuth Gmail integration | Phase 4 | `encryptToken` / `decryptToken` for refresh token at rest |
| Dep-cruiser CI | All phases | `inbox-pipeline-exception` allows Phase 4's inbox→classifier/matcher imports |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] withRls return type corrected to ResultAsync**

- **Found during:** Task 2 - typecheck failed
- **Issue:** Plan specified `Promise<Result<T, AppError>>` as return type, but `fromPromise()` from neverthrow returns `ResultAsync<T, AppError>`. These are not the same TypeScript type — `ResultAsync` implements `PromiseLike<Result<T, E>>` but is not a `Promise`.
- **Fix:** Changed return type annotation from `Promise<Result<T, AppError>>` to `ResultAsync<T, AppError>`. Removed unused `type Result` import.
- **Files modified:** `src/core/db/with-rls.ts`
- **Commit:** e632b31 (partial), 81bcfdc (lint cleanup)
- **Impact:** Zero behavioral change — callers `await withRls(...)` and get `Result<T, AppError>` exactly as intended.

**2. [Rule 2 - Missing functionality] Added global Vitest setup file**

- **Found during:** Task 2 - encryption tests failed because env.ts threw at module load before process.env assignments ran
- **Issue:** JavaScript module imports are hoisted — `process.env['X'] ??= '...'` lines in test files execute after import statements, so env.ts validation runs before fixtures are set.
- **Fix:** Created `vitest.setup.ts` (referenced from `vitest.config.ts` `setupFiles`) as the single source of test env fixtures. Cleaned redundant per-test assignments.
- **Files created:** `vitest.setup.ts`, `vitest.config.ts` (updated)
- **Impact:** All subsequent test files benefit from fixtures without per-file boilerplate.

**3. [Rule 3 - Blocking issue] Added __mocks__/ to dep-cruiser no-orphans exclusion**

- **Found during:** Task 3 - depcheck reported `src/__mocks__/server-only.ts` as orphan warning
- **Issue:** `src/__mocks__/server-only.ts` is referenced via alias in `vitest.config.ts` (not by source imports), so dep-cruiser correctly identifies it as an orphan. The warning is accurate but expected.
- **Fix:** Added `'src/__mocks__/'` to the `no-orphans` `pathNot` exclusion list in `.dependency-cruiser.cjs`.
- **Files modified:** `.dependency-cruiser.cjs`
- **Impact:** `pnpm depcheck` exits 0 with no violations.

## Known Stubs

None. All files are fully implemented with no placeholder values or TODO stubs that would block the plan's goals.

## Threat Flags

None. Files created introduce no new network endpoints, auth paths, or trust boundaries. `encryption.ts` and `with-rls.ts` are server-only primitives consumed by higher-level auth and data layers.

## Pre-Commit Gate Result

```
pnpm lint        ✓ ESLint: No issues found
pnpm typecheck   ✓ tsc --noEmit (clean)
pnpm test:run    ✓ 2 test files, 10 tests passing
pnpm build       ✓ Next.js build clean
pnpm depcheck    ✓ no dependency violations found (18 modules, 21 deps)
```

## Self-Check: PASSED

Files exist:
- src/core/db/with-rls.ts: FOUND
- src/core/crypto/encryption.ts: FOUND
- src/core/db/README.md: FOUND
- src/core/db/index.ts: FOUND (withRls export added)
- vitest.config.ts: FOUND
- vitest.setup.ts: FOUND

Commits exist:
- e632b31: FOUND
- 883ded4: FOUND
- 02b8c22: FOUND
- 81bcfdc: FOUND
