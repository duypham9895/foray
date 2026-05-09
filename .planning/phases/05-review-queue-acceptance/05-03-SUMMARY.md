---
phase: 05-review-queue-acceptance
plan: 03
subsystem: ci
tags: [testing, ci, structural-checks, acceptance, fnd-03, fnd-04]

# Dependency graph
requires:
  - phase: 05-review-queue-acceptance
    plan: 01
    provides: Inbox queries, review actions, full-body fetch endpoint
  - phase: 05-review-queue-acceptance
    plan: 02
    provides: Inbox UI components and /inbox page
provides:
  - Structural CI check script (check-server-actions.ts)
  - FND-03 category coverage verification (all 6 categories)
  - Updated Lean acceptance criteria with category coverage
affects: [ci, milestone-docs]

# Tech tracking
tech-stack:
  added: []
  patterns: [structural-ci-check-script]

key-files:
  created:
    - scripts/check-server-actions.ts
  modified:
    - src/core/env.test.ts
    - docs/milestones/lean.md

key-decisions:
  - "Used angle-bracket-depth tracking in check-server-actions.ts parser to handle nested generics like Promise<{ ok: boolean }>"
  - "Budget guard uses cost-based daily cap ($0.50/day) not call-count — existing tests cover this correctly"
  - "Auto-approved checkpoint:human-verify in auto mode; browser-dependent acceptance criteria deferred to manual UAT"

patterns-established:
  - "Structural CI check pattern: standalone tsx script that parses Server Action files for return type safety"

requirements-completed: [FND-03, FND-04, REVIEW-01, REVIEW-02]

# Metrics
duration: 11min
completed: 2026-05-09
---

# Phase 5 Plan 03: Acceptance + Structural CI Summary

**Structural CI checks for Server Action return types, FND-03 category coverage verification across all 6 test categories, and updated Lean acceptance criteria**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-09T15:24:22Z
- **Completed:** 2026-05-09T15:35:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `scripts/check-server-actions.ts` — structural CI check verifying all 14 Server Actions across 3 action files return `Result`, `ActionState`, or use `ok()`/`err()` patterns
- Added 5 missing env validation tests to `src/core/env.test.ts`: DATABASE_URL (missing, malformed), ENCRYPTION_KEY (missing, wrong length), APP_PASSWORD (missing)
- Verified all 6 FND-03 test categories have passing tests (314 total tests across 25 files)
- Confirmed dependency-cruiser inbox exception exists in `.dependency-cruiser.cjs`
- Updated `docs/milestones/lean.md` acceptance criteria: #7 now references category-based coverage, #11 references structural check script
- Full pre-commit gate passes: typecheck, test:run (314 passed), depcheck (0 errors), build

## Task Commits

Each task was committed atomically:

1. **Task 1: FND-03 category coverage audit + FND-04 structural checks** - `97e352c` (feat)
2. **Task 2: Lean acceptance criteria walkthrough** - `5edc3bb` (docs)

## Files Created/Modified

- `scripts/check-server-actions.ts` — Node.js script that finds all `actions.ts` files under `src/features/`, parses exported async functions, and verifies return types contain `Result`, `ActionState`, `LoginState`, or inline `{ ok: ... }` patterns. Falls back to checking function body for `return ok(`, `return err(`, `return { ok:` patterns.
- `src/core/env.test.ts` — Added 5 tests for previously untested required env vars (DATABASE_URL missing/malformed, ENCRYPTION_KEY missing/short, APP_PASSWORD missing)
- `docs/milestones/lean.md` — Updated acceptance criteria #7 (category coverage) and #11 (structural check script), updated milestone status

## FND-03 Category Coverage Verification

| Category | Test File | Tests | Status |
|----------|-----------|-------|--------|
| (a) Tenant isolation | `rls-escape.test.ts` | 4 | PASS |
| (b) Classifier fixtures | `classifier-fixtures.test.ts` | 4+ (per-fixture parametric) | PASS |
| (c) Matcher tiebreak | `matcher-service.test.ts` | 9 (T1-T9) | PASS |
| (d) Auto-update + undo | `act-stage.test.ts` | 7 (T1-T7) | PASS |
| (e) Budget guard | `budget.test.ts` | 17 | PASS |
| (f) Env validation | `env.test.ts` | 11 | PASS |

**Total:** 314 tests passing across 25 test files.

## Decisions Made

- **Angle-bracket-depth tracking for parser:** The initial regex-based parser couldn't handle nested generics in return types like `Promise<{ ok: boolean; error?: string }>`. Rewrote to manually track `<>` depth while scanning for the function body `{` at depth 0.
- **Cost-based budget guard:** The plan referenced "51st call blocking" but the actual implementation uses a $0.50/day cost cap, which is more meaningful. Existing tests already cover this correctly.
- **Auto-approved checkpoint:** Task 2 was a `checkpoint:human-verify`. With `AUTO_CFG=true`, auto-approved and ran all automated checks. Browser-dependent acceptance criteria (1-6, 12) deferred to manual UAT.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created .env.local for build verification**
- **Found during:** Task 1 (pre-commit gate)
- **Issue:** `pnpm build` fails without `.env.local` in worktree (env.ts throws at module load)
- **Fix:** Created minimal `.env.local` with test values
- **Files modified:** `.env.local` (gitignored, not committed)
- **Verification:** build passes after creation

**2. [Rule 1 - Bug] Fixed regex parser for multiline return types**
- **Found during:** Task 1 (structural check script)
- **Issue:** Initial regex `([^}]+)` stopped at first `{` inside generic types, truncating return types like `Promise<{ ok: boolean }>` to `Promise<`
- **Fix:** Rewrote parser to use angle-bracket-depth tracking instead of regex capture
- **Files modified:** `scripts/check-server-actions.ts`
- **Verification:** All 14 Server Actions now correctly identified

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for the plan's deliverables to work. No scope creep.

## Issues Encountered

- Lint has 2 pre-existing errors in inbox components (`react-hooks/purity` in `degradation-banner.tsx` and `token-health-banner.tsx`) — not caused by this plan's changes
- `.env.local` is gitignored and not available in worktree by default — needed for `pnpm build`

## Known Stubs

None — all deliverables are functional.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-05-07 | `scripts/check-server-actions.ts` | CI script reads source files to verify structure. False negatives caught by code review. Accepted per threat model. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 5 Plan 03 complete
- All FND-03 and FND-04 requirements verified
- Lean acceptance criteria updated and automated checks passing
- Browser-dependent acceptance criteria (1-6, 12) need manual UAT before milestone sign-off

---

*Phase: 05-review-queue-acceptance*
*Completed: 2026-05-09*

## Self-Check: PASSED

All created files exist. All task commits verified.
