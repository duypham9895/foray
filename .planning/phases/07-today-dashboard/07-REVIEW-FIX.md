---
phase: 07-today-dashboard
fixed_at: 2026-05-10T14:00:00Z
review_path: .planning/phases/07-today-dashboard/07-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-05-10T14:00:00Z
**Source review:** .planning/phases/07-today-dashboard/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (warnings only)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Non-null assertion on nullable `scheduledAt`

**Files modified:** `src/features/today/queries.ts`
**Commit:** e9563d3
**Applied fix:** Replaced `scheduledAt: r.scheduledAt!` with a `.filter()` using a type predicate (`r.scheduledAt !== null`) before the `.map()`. This narrows the type safely without relying on the non-null assertion, making the code resilient to future filter logic changes.

### WR-02: `findRecent24hActivity` returns all recent updates, not status changes

**Files modified:** `src/features/today/queries.ts`, `src/features/today/queries.test.ts`
**Commit:** e9563d3
**Applied fix:** Renamed the type `RecentStatusChange` to `RecentlyActiveApplication` and the field `statusChanges` to `activeApplications` in both the source and test files. This aligns the naming with actual behavior (querying recently updated applications, not tracking canonical status transitions).

### WR-03: No cross-tenant isolation tests

**Files modified:** `src/features/today/queries.test.ts`
**Commit:** e9563d3
**Applied fix:** Added a new test `'excludes other users data (cross-tenant isolation)'` in the `findStaleForays` describe block. The test creates a stale foray for Bob, then verifies Alice's `findStaleForays` result does not include it.

### WR-04: Test name/assertion mismatches

**Files modified:** `src/features/today/queries.test.ts`
**Commit:** e9563d3
**Applied fix:** Renamed two misleading tests:
- `getPipelineCounts`: `'returns all zeroes for user with no applications'` to `'returns counts including seed application for user with only seed data'`
- `findThisWeekCounts`: `'returns all zeroes for user with no applications'` to `'returns this-week counts including seed application'`

Both tests assert `>= 1` for `applied` because Bob has a seed application, so the original names claiming "zeroes" and "no applications" were inaccurate.

---

_Fixed: 2026-05-10T14:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
