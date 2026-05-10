---
phase: 07-today-dashboard
reviewed: 2026-05-10T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/features/today/queries.ts
  - src/features/today/queries.test.ts
  - src/features/today/components/today-section.tsx
  - src/features/today/components/count-badge.tsx
  - src/features/applications/components/stale-indicator.tsx
  - src/features/today/components/today-components.test.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Today dashboard query layer, presentational components, and their tests. Security posture is solid: all six query functions use `withRls(userId, ...)` for Postgres RLS enforcement, and each also applies `userId` in the Prisma `where` clause as belt-and-suspenders. No hardcoded secrets, no `eval`, no injection vectors. The component layer is clean and minimal.

Four warnings found: a non-null assertion that is safe today but fragile under future refactors, a semantic mismatch in `findRecent24hActivity` where the return type claims "status changes" but the query returns all recent application updates, and two test name/assertion mismatches. Five info-level items around test coverage gaps, component placement, and minor code smells.

## Warnings

### WR-01: Non-null assertion on nullable `scheduledAt`

**File:** `src/features/today/queries.ts:179`
**Issue:** `scheduledAt: r.scheduledAt!` uses a non-null assertion on a `DateTime?` column. The assertion is safe today because the query filters with `scheduledAt: { gte: startOfDay, lt: endOfDay }`, which excludes null rows in Prisma. However, the `!` operator is fragile — if the filter logic changes in the future, the assertion will silently mask a null dereference.

**Fix:**
```typescript
// Option A: guard clause
if (!r.scheduledAt) continue

// Option B: narrow in the map with a type predicate
return rows
  .filter((r): r is typeof r & { scheduledAt: Date } => r.scheduledAt !== null)
  .map<TodaysInterview>((r) => ({
    stageId: r.id,
    applicationId: r.application.id,
    roleTitle: r.application.roleTitle,
    companyName: r.application.company.name,
    stageName: r.name,
    scheduledAt: r.scheduledAt,
  }))
```

### WR-02: `findRecent24hActivity` returns all recent updates, not status changes

**File:** `src/features/today/queries.ts:253-266`
**Issue:** The `statusChanges` field in the return type `Recent24hActivity` (line 225) and the type `RecentStatusChange` (line 219) imply the data represents canonical status transitions. However, the query (lines 253-266) fetches all applications with `updatedAt >= since` regardless of whether `canonicalStatus` actually changed. An application updated only for a note edit or stage addition would appear as a "status change." The caller will display these as status transitions when they may not be.

**Fix:** Either rename the types to reflect what they actually represent (recently active applications, not status changes), or add a filter that distinguishes actual status changes. The simpler fix is renaming:

```typescript
// Rename types to match actual semantics
export type RecentlyActiveApplication = {
  id: number
  canonicalStatus: CanonicalStatus
  updatedAt: Date
}

export type Recent24hActivity = {
  emails: RecentEmail[]
  activeApplications: RecentlyActiveApplication[]  // was: statusChanges
}
```

If actual status change detection is needed, consider adding an `Event` query filtering on `eventType = 'status_change'` instead.

### WR-03: No cross-tenant isolation tests

**File:** `src/features/today/queries.test.ts`
**Issue:** The tests verify that each user gets their own data (Alice gets Alice's, Bob gets Bob's), but none explicitly tests that Alice cannot see Bob's data or vice versa through the query functions. Given PRINCIPLES.md's mandate to "test that queries filter, that creates assign correctly, that updates don't cross tenants," this is a significant gap. For example, there is no test that seeds data for Bob and verifies Alice's `findStaleForays` excludes it.

**Fix:** Add a cross-tenant test for at least one query (e.g., `findStaleForays`):

```typescript
it('excludes other users data (cross-tenant isolation)', async () => {
  // Create a stale foray for Bob
  await withRls(BOB, async (tx) => {
    await tx.application.create({
      data: {
        userId: Number(BOB),
        companyId: /* bob's company */,
        roleTitle: 'Bob Stale Role',
        canonicalStatus: 'applied',
        appliedAt: new Date(Date.now() - 10 * MS_PER_DAY),
        lastActivityAt: new Date(Date.now() - 10 * MS_PER_DAY),
      },
    })
  })

  const result = await findStaleForays(ALICE)
  expect(result.isOk()).toBe(true)
  if (result.isErr()) throw result.error

  // Alice must NOT see Bob's stale foray
  const match = result.value.find((s) => s.roleTitle === 'Bob Stale Role')
  expect(match).toBeUndefined()
})
```

### WR-04: Test name/assertion mismatches in pipeline and week count tests

**File:** `src/features/today/queries.test.ts:500-508` and `src/features/today/queries.test.ts:704-712`
**Issue:** Two tests are named "returns all zeroes for user with no applications" but then assert `>= 1` for `applied` because Bob has a seed application created in `beforeEach`. The test name is misleading — it suggests Bob has no applications, when the fixture gives him one.

**Fix:** Rename the tests to reflect actual behavior:

```typescript
// Line 500
it('returns counts including seed application for user with only seed data', async () => {

// Line 704
it('returns this-week counts including seed application', async () => {
```

## Info

### IN-01: `StaleIndicator` placed in wrong slice

**File:** `src/features/applications/components/stale-indicator.tsx`
**Issue:** `StaleIndicator` is a pure presentational component with no dependencies on the applications slice's queries or services. It is meant to be consumed by the Today dashboard. Per AGENTS.md slice isolation rules, cross-slice imports are forbidden. If the today slice imports this component, it violates the boundary. The component should either live in `src/features/today/components/` (if only used by today) or `src/ui/` (if shared).

**Fix:** Move to `src/features/today/components/stale-indicator.tsx` or `src/ui/stale-indicator.tsx` before the today page imports it.

### IN-02: No `StaleIndicator` component test

**File:** `src/features/today/components/today-components.test.tsx`
**Issue:** The test file covers `TodaySection` and `CountBadge` but has no tests for `StaleIndicator`. While it is a trivial component (just renders a badge), the test file should cover all components in the phase for consistency.

**Fix:** Add a basic render test:

```typescript
describe('StaleIndicator', () => {
  it('renders the stale message', () => {
    render(<StaleIndicator />)
    expect(screen.getByText('No activity 7+ days')).toBeTruthy()
  })
})
```

### IN-03: Unnecessary array spread on `ACTIVE_STATUSES`

**File:** `src/features/today/queries.ts:81`
**Issue:** `{ in: [...ACTIVE_STATUSES] }` spreads a `ReadonlyArray<CanonicalStatus>` into a mutable array. Prisma's `in` filter accepts `readonly` arrays, so the spread is unnecessary.

**Fix:** Remove the spread:
```typescript
canonicalStatus: { in: ACTIVE_STATUSES },
```

### IN-04: `MS_PER_DAY` defined in both source and test

**File:** `src/features/today/queries.ts:65` and `src/features/today/queries.test.ts:35`
**Issue:** The constant `MS_PER_DAY` is duplicated. Per project philosophy ("three similar lines is better than a premature abstraction"), this is acceptable for now. If a third usage appears, consider extracting to `src/core/constants.ts`.

### IN-05: No validation on `findReviewQueueTopN` `n` parameter

**File:** `src/features/today/queries.ts:126`
**Issue:** The `n` parameter is not validated. Passing `n <= 0` could produce unexpected behavior with Prisma's `take` option. Prisma treats `take: 0` as returning zero rows, but `take: -1` may throw or behave unexpectedly depending on the version.

**Fix:** Add a guard:
```typescript
n: number = 3,
// Add at function start:
if (n <= 0) return ok([])
```

---

_Reviewed: 2026-05-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
