---
phase: 11-reminders-cron-infrastructure
plan: 01
subsystem: infra
tags: [cron, node-cron, prisma, postgres, rls, follow-up, reminders]

requires:
  - phase: 01-05 (v0.1 Lean)
    provides: Application model, RLS policies, withRls helper, Pino logger
  - phase: 06-10 (v0.2 Standard)
    provides: Today queries layer, instrumentation.ts cron setup

provides:
  - CronRegistry module with multi-job pattern and advisory lock protection
  - Follow-up date service (setFollowUp, clearFollowUp) with tenant isolation
  - Overdue follow-ups query for Today dashboard
  - reminder-check cron job stub for REMIND-05

affects:
  - 11-02 (Follow-up UI needs setFollowUp/clearFollowUp)
  - 11-03 (Wiring needs CronRegistry and findOverdueFollowUps)

tech-stack:
  added: []
  patterns: [CronRegistry job array pattern, throw-bridge error translation]

key-files:
  created:
    - src/core/cron/registry.ts
    - src/core/cron/registry.test.ts
    - src/features/applications/follow-up-service.ts
    - src/features/applications/follow-up-service.test.ts
  modified:
    - src/instrumentation.ts
    - src/features/applications/schema.ts
    - src/features/today/queries.ts
    - src/features/today/queries.test.ts

key-decisions:
  - "CronRegistry uses globalThis array pattern for hot-reload cleanup"
  - "reminder-check cron is a no-op stub; Today page query fetches overdue follow-ups directly"
  - "Follow-up service uses throw-bridge pattern matching notes-service.ts for cross-tenant errors"

patterns-established:
  - "CronRegistry job array: registerCronJobs([{name, schedule, handler}]) for multi-job cron"
  - "Throw-bridge: throw sentinel Error inside withRls callback, translate to errors.notFound() after"

requirements-completed: [REMIND-01, REMIND-04, REMIND-05]

duration: 10min
completed: 2026-05-10
---

# Phase 11 Plan 01: CronRegistry + Follow-up Backend Summary

**CronRegistry with advisory lock protection, follow-up date service with tenant isolation, and overdue follow-ups query for the Today dashboard**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-10T07:24:40Z
- **Completed:** 2026-05-10T07:34:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- CronRegistry module replaces inline cron.schedule in instrumentation.ts with reusable multi-job pattern
- Advisory lock (pg_try_advisory_lock) prevents cron job overlap across hot-reload cycles
- Follow-up date service provides setFollowUp/clearFollowUp with cross-tenant safety via RLS
- findOverdueFollowUps query returns overdue applications sorted oldest-first for Today dashboard
- reminder-check cron job registered (no-op stub) satisfying REMIND-05

## Task Commits

Each task was committed atomically:

1. **Task 1: CronRegistry pattern + reminder-check cron** - `fa94b08` (feat)
2. **Task 2: Follow-up service + overdue query** - `35bc8a9` (feat)

## Files Created/Modified

- `src/core/cron/registry.ts` - CronRegistry with registerCronJobs export, 4 guards, advisory lock
- `src/core/cron/registry.test.ts` - 10 unit tests covering guard logic, lock/unlock, error handling
- `src/instrumentation.ts` - Refactored to use CronRegistry for poll-gmail and reminder-check jobs
- `src/features/applications/schema.ts` - Added followUpInputSchema with z.coerce.date()
- `src/features/applications/follow-up-service.ts` - setFollowUp/clearFollowUp with throw-bridge pattern
- `src/features/applications/follow-up-service.test.ts` - 8 integration tests (set/clear/error paths)
- `src/features/today/queries.ts` - Added findOverdueFollowUps query and OverdueFollowUp type
- `src/features/today/queries.test.ts` - 8 integration tests for findOverdueFollowUps

## Decisions Made

- CronRegistry uses globalThis array (not single object) to support multiple jobs per registration
- reminder-check cron is intentionally a no-op; the Today page query is the real consumer of overdue follow-ups
- Follow-up service mirrors notes-service.ts throw-bridge pattern for cross-tenant error handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed follow-up service returning AppError instead of Result from withRls callback**
- **Found during:** Task 2 (Follow-up service implementation)
- **Issue:** Service returned `errors.notFound()` directly from inside withRls callback. Since withRls wraps any return value as success, the NotFound error was silently swallowed.
- **Fix:** Changed to throw-bridge pattern: throw sentinel Error inside callback, translate to `err(errors.notFound())` after withRls returns. Matches notes-service.ts pattern.
- **Files modified:** src/features/applications/follow-up-service.ts
- **Verification:** Cross-tenant tests pass (Alice cannot access Bob's applications)
- **Committed in:** 35bc8a9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix essential for cross-tenant safety. No scope creep.

## Issues Encountered

- Prisma client not generated in worktree; required `prisma generate` with DATABASE_URL before tests could run
- TypeScript `process.env.NODE_ENV` is readonly; required `as { NODE_ENV: string }` cast in tests

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all exports are wired to real implementations.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-11-01 mitigated | follow-up-service.ts | Zod validation + userId ownership check before update |
| T-11-02 mitigated | registry.ts | Advisory lock prevents cron double-fire |
| T-11-03 mitigated | follow-up-service.ts | withRls enforces tenant isolation |
| T-11-04 mitigated | queries.ts | withRls with set_config ensures tenant-scoped queries |

## Next Phase Readiness

- CronRegistry ready for Plan 02/03 to add more cron jobs
- Follow-up service ready for Plan 02 UI to call setFollowUp/clearFollowUp
- findOverdueFollowUps ready for Plan 02 Today page integration
- All 422 tests passing (34 test files)

## Self-Check: PASSED

- All 9 files verified present on disk
- Both task commits verified in git log (fa94b08, 35bc8a9)
- 422 tests passing across 34 test files

---
*Phase: 11-reminders-cron-infrastructure*
*Completed: 2026-05-10*
