---
phase: 03-classifier-matcher
fixed_at: 2026-05-09T20:10:00Z
review_path: .planning/phases/03-classifier-matcher/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-05-09
**Source review:** `.planning/phases/03-classifier-matcher/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 3
- Fixed: 3
- Skipped: 0

Pre-commit gate after the fixes:

- `pnpm lint` — clean (only pre-existing `boundaries/*` deprecation warnings, unrelated)
- `pnpm typecheck` — clean
- `pnpm test:run` — 275 passed, 4 todo, 0 failed
- `pnpm build` — clean
- `pnpm depcheck` — clean (only pre-existing `no-orphans` warning on `src/middleware.ts`, unrelated)

## Fixed Issues

### WR-01: `matcher/service.ts` rebrands `userId` via type assertion, bypassing the branded-type validator

**Files modified:** `src/features/matcher/schema.ts`, `src/features/matcher/service.ts`
**Commit:** `04a3dd6`
**Applied fix:** Option A from REVIEW.md (preferred — surgical, matches PRINCIPLES.md "validate at the boundary, then trust the type"):
- Tightened `matchEmailInputSchema.userId` from `z.string().min(1)` to `z.string().regex(/^\d+$/, 'userId must be numeric')` so the slice boundary cannot accept a non-numeric string. Since `^\d+$` already implies non-empty, the redundant `.min(1)` was dropped.
- Replaced `userId as UserId` with `UserId(userId)` in `service.ts` so the validating constructor in `src/core/types/ids.ts` runs at the seam.
- Updated the schema header comment to describe the new contract (numeric validation + brand re-attached via constructor).
- Added `UserId` to the value-import in `service.ts` (was previously a type-only import).

T6 of `matcher-service.test.ts` already covers the rejected-empty case; with the regex tightening it now also implicitly rejects non-numeric strings, which is the contract upgrade the finding asked for. No test changes were required because the existing fixtures all use `UserId(1)`/`UserId(2)`.

### WR-02: `classifier/budget.ts` resolves `LOG_PATH` at module load AND at call time — the exported constant is misleading

**Files modified:** `src/features/classifier/budget.ts`
**Commit:** `c866507`
**Applied fix:** Recommendation from REVIEW.md — dropped the exported `LOG_PATH` constant and inlined the cwd-derived default into `currentLogPath()`. Verified via `grep` that `LOG_PATH` had no external callers (only `budget.ts` itself referenced the symbol; `budget.test.ts` only reads `process.env['CLASSIFIER_LOG_PATH']`). The footgun is now physically impossible: there is no module-load-time cache to diverge from the live env. Updated the JSDoc on `currentLogPath()` to explain the per-call resolution and the test-mutation rationale.

### WR-03: `classifier/service.ts` ignores `appendCostEntry` failure — the HACK comment justifies under-counting, but the failure is also silently un-logged

**Files modified:** `src/features/classifier/service.ts`
**Commit:** `bb020d0`
**Applied fix:** Option 1 from REVIEW.md (4-line change — surface failure to telemetry without changing the return contract):
- Captured the `appendCostEntry` Result into `const append`.
- Added a `logger.error` line on `append.isErr()` with `op: 'classifier.cost.silent_loss'`, `emailHash`, and the error payload — gives operators an audit trail for "why is this email missing from `data/classifier-log.jsonl`".
- Tightened the HACK comment: replaced the misleading "tomorrow's budget is unaffected" prose with an honest description of the today-window under-count and the fail-closed re-engagement on the next `checkBudget` tick.

T6 of `service.test.ts` (`appendCostEntry fails (Db) → classifyEmail STILL returns ok`) continues to pass; the new log line is visible in test output, confirming the telemetry fires. No test changes required — T6's assertions are about the return value and call counts, both of which are unchanged.

---

_Fixed: 2026-05-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
