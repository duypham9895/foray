---
phase: 07-today-dashboard
plan: 01
subsystem: database
tags: [prisma, postgres, queries, rls, vitest, integration-tests]

requires:
  - phase: 06-bookmarklet-capture-api
    provides: capture API and application schema
  - phase: 05-review-queue
    provides: email processing pipeline, review queue, classifier
provides:
  - todayInterviews() query — stages scheduled for today
  - actionNeeded() queries — stale forays + review queue top-N
  - recent24hActivity() query — emails + status changes in last 24h
  - thisWeekCounts() query — week-over-week application counts by status
  - getPipelineCounts() query — canonical status groupBy
  - findOfferForays() query — offer-status forays
  - 32 integration tests covering all 7 query functions
affects: [07-02, 07-03, today-dashboard]

tech-stack:
  added: []
  patterns: [withRls transaction pattern, Promise.all parallel queries, groupBy aggregation]

key-files:
  created:
    - src/features/today/queries.test.ts — 32 integration tests for all today queries
  modified:
    - src/features/today/queries.ts — added findRecent24hActivity, findThisWeekCounts, type exports

key-decisions:
  - "No Note model in schema — recent24hActivity uses emails + status changes only (notes are a text field on Application)"
  - "Week start uses Sunday-based getDay() to match JS Date convention"
  - "Stale forays filtered to active statuses only (applied, screening, interviewing, offer) — rejected/withdrawn excluded"

patterns-established:
  - "Today queries use withRls for all reads, not tenantDb — consistent with inbox/queries.ts pattern"
  - "Query types are exported alongside functions for component consumption"
  - "Integration tests use beforeEach/afterEach fixture reset with seeded alice/bob users"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-05-10
---

# Plan 07-01: Query Layer Summary

**Seven Prisma query functions feeding the Today dashboard — stale forays, interviews, review queue, recent activity, pipeline counts, and week-over-week deltas**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-10T10:41:00+07:00
- **Completed:** 2026-05-10T11:08:12+07:00
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments
- All 7 today dashboard query functions implemented with withRls tenant isolation
- findRecent24hActivity returns emails + application status changes from last 24h via Promise.all
- findThisWeekCounts returns week-over-week counts grouped by canonical_status with delta support
- 32 integration tests covering happy paths, edge cases, tenant isolation, and empty states

## Task Commits

Each task was committed atomically:

1. **Task 1-2: Foundation queries (todayInterviews, actionNeeded, pipelineCounts, offers)** - `712a0d2` (feat)
2. **Task 3: recent24hActivity query** - `5446c94` (feat)
3. **Task 4: thisWeekCounts query** - `5446c94` (feat)
4. **Tests: all 7 query functions** - `ffdd8f8` (test)

## Files Created/Modified
- `src/features/today/queries.ts` — 7 query functions + type exports (StaleForay, OfferForay, ReviewQueueItem, TodaysInterview, PipelineCounts, Recent24hActivity, WeekCounts)
- `src/features/today/queries.test.ts` — 32 integration tests against Testcontainers Postgres

## Decisions Made
- No Note model in schema (notes is a text field on Application) — recent24hActivity covers emails + status changes only
- Week start uses Sunday-based getDay() convention matching JS Date
- Stale forays limited to active canonical statuses (applied, screening, interviewing, offer)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Query layer complete — all 7 functions available for Today dashboard components (plan 07-02)
- Types exported for component prop drilling
- Tests provide regression safety for query behavior changes

---
*Phase: 07-today-dashboard*
*Completed: 2026-05-10*
