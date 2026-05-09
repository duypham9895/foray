---
phase: 05-review-queue-acceptance
plan: 01
subsystem: api
tags: [prisma, server-actions, gmail-api, rate-limiting, zod]

# Dependency graph
requires:
  - phase: 04-gmail-ingestion-pipeline-cron
    provides: Email model with processingStatus, gmail-client.ts, act.ts gate logic
provides:
  - Inbox queries (findEmailsForReview, findApplicationsForLink)
  - 4 review Server Actions (confirm, override, link, ignore)
  - Rate-limited full-body Gmail fetch endpoint
  - Zod schemas for review action inputs
affects: [05-02-inbox-ui, 05-03-acceptance]

# Tech tracking
tech-stack:
  added: []
  patterns: [withRls-transaction-pattern, token-bucket-rate-limiting, server-action-review-queue]

key-files:
  created:
    - src/features/inbox/queries.ts
    - src/features/inbox/queries.test.ts
    - src/features/inbox/actions.test.ts
    - src/app/api/inbox/full-body/route.ts
  modified:
    - src/features/inbox/schema.ts
    - src/features/inbox/actions.ts

key-decisions:
  - "Inlined extractPlainTextBody in route handler rather than exporting from gmail-client.ts (private function, single caller)"
  - "Used withRls for review actions instead of tenantDb (transactional atomicity needed for reviewedByUser + processingStatus writes)"

patterns-established:
  - "Review action pattern: requireUser + withRls + revalidatePath + { ok, error? } return"

requirements-completed: [REVIEW-01, REVIEW-02]

# Metrics
duration: 13min
completed: 2026-05-09
---

# Phase 5 Plan 01: Inbox Data Layer Summary

**Inbox queries for needs_review emails, 4 review Server Actions with RLS transactions, and rate-limited full-body Gmail fetch endpoint**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-09T14:58:10Z
- **Completed:** 2026-05-09T15:11:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- findEmailsForReview query returns needs_review emails with joined application + company data via withRls
- 4 review Server Actions (confirm, override, link, ignore) all use withRls transactions with requireUser auth
- Rate-limited full-body Gmail fetch endpoint with in-memory token bucket (5 req/sec/user)
- 11 tests passing (3 query tests + 8 action tests covering happy paths and auth errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Inbox queries + schema + review actions** - `3501b97` (feat)
2. **Task 2: Rate-limited full-body fetch endpoint** - `89b073e` (feat)

## Files Created/Modified
- `src/features/inbox/queries.ts` - findEmailsForReview and findApplicationsForLink queries using withRls
- `src/features/inbox/schema.ts` - Added overrideClassificationSchema, linkApplicationSchema, reviewActionSchema
- `src/features/inbox/actions.ts` - Added confirmClassification, overrideClassification, linkToApplication, ignoreEmail actions
- `src/features/inbox/queries.test.ts` - 3 integration tests for inbox queries
- `src/features/inbox/actions.test.ts` - 8 integration tests for review actions (4 happy path + 4 auth error)
- `src/app/api/inbox/full-body/route.ts` - GET endpoint with token bucket rate limiting and Gmail API fetch

## Decisions Made
- Inlined extractPlainTextBody in route handler rather than exporting from gmail-client.ts (private function, single caller)
- Used withRls for review actions instead of tenantDb (transactional atomicity needed for reviewedByUser + processingStatus writes)
- Mocked next/cache revalidatePath in action tests (not available in test environment)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Generated Prisma client for typecheck**
- **Found during:** Task 1 (typecheck verification)
- **Issue:** @/generated/prisma/client module not found — Prisma client not generated in worktree
- **Fix:** Ran `DATABASE_URL="postgresql://localhost:5432/foray" pnpm prisma generate`
- **Files modified:** src/generated/prisma/ (gitignored)
- **Verification:** typecheck passes after generation
- **Committed in:** 3501b97 (Task 1 commit)

**2. [Rule 1 - Bug] Mocked next/cache in action tests**
- **Found during:** Task 1 (test verification)
- **Issue:** revalidatePath throws "static generation store missing" in test environment
- **Fix:** Added vi.mock('next/cache') to actions.test.ts
- **Files modified:** src/features/inbox/actions.test.ts
- **Verification:** All 8 action tests pass
- **Committed in:** 3501b97 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed TypeScript strict null checks in tests**
- **Found during:** Task 1 (typecheck verification)
- **Issue:** items[0] could be undefined after toHaveLength(1) assertion
- **Fix:** Used non-null assertion (items[0]!) after length check
- **Files modified:** src/features/inbox/queries.test.ts
- **Verification:** typecheck passes
- **Committed in:** 3501b97 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for tests to pass and typecheck to succeed. No scope creep.

## Issues Encountered
- Build fails in worktree due to missing .env.local (pre-existing issue, not caused by this plan's changes)
- Pre-existing lint warning in token-health-banner.tsx (react-hooks/purity) — not in scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Inbox data layer complete, ready for Plan 02 (inbox UI components)
- All 4 review actions tested and working
- Full-body fetch endpoint ready for UI integration

---
*Phase: 05-review-queue-acceptance*
*Completed: 2026-05-09*

## Self-Check: PASSED

All created files exist. All task commits verified.
