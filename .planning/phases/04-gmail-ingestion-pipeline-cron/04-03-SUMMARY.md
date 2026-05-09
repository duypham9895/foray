---
phase: 04-gmail-ingestion-pipeline-cron
plan: 03
subsystem: inbox
tags: [gmail-api, pipeline, cron, prisma, advisory-lock, neverthrow]

requires:
  - phase: 04-gmail-ingestion-pipeline-cron
    provides: "gmail-client.ts (getGmailClient, extractEmailMetadata), schema.ts (ParsedEmailInput)"
  - phase: 03-classifier-matcher
    provides: "classifyEmail, matchEmail, meetsThreshold, isStatusRegression"
  - phase: 02-applications-slice
    provides: "applyAutoStatusChange, undoStatusChange"
  - phase: 01-foundation
    provides: "withRls, tenantDb, branded IDs, AppError taxonomy"

provides:
  - "pollOnce(userId) orchestrator — 4-stage pipeline (ingest -> match -> classify -> act)"
  - "ingestSinceWatermark with history.list + messages.list fallback on 404"
  - "actOnEmail with 5 gates: advisory lock, undo idempotency, first-50 grace, per-label threshold, status-regression block"
  - "persistEmail with UNIQUE(gmail_message_id) idempotency"
  - "ESLint boundaries exception for inbox cross-slice imports"

affects: [04-04-cron, 05-review-queue]

tech-stack:
  added: []
  patterns: [advisory-lock-serialization, pipeline-orchestrator, history-list-fallback]

key-files:
  created:
    - src/features/inbox/ingest.ts
    - src/features/inbox/act.ts
    - src/features/inbox/service.ts
  modified:
    - eslint.config.mjs

key-decisions:
  - "MessageRef type (id + threadId) instead of ParsedEmail for ingest return — orchestrator fetches full messages in loop"
  - "Sequential email processing (not parallel) to respect Gmail quota (250 units/user/sec)"
  - "Watermark updated AFTER loop completes — prevents partial-sync watermark advancement on batch failure"
  - "ESLint boundaries exception mirrors .dependency-cruiser.cjs exception for inbox cross-slice imports"

patterns-established:
  - "Pipeline orchestrator pattern: ingest -> match -> classify -> act with per-email failure isolation"
  - "Advisory lock pattern: pg_try_advisory_lock(hashtext(key)) with unlock in finally block"
  - "First-50 grace pattern: count user emails to gate auto-update for new Gmail connections"

requirements-completed: [GMAIL-03, AUTO-01, AUTO-02, AUTO-03, AUTO-04]

duration: 9min
completed: 2026-05-09
---

# Phase 4 Plan 03: Pipeline Orchestrator Summary

**Four-stage email pipeline (ingest -> match -> classify -> act) with 5 act-stage gates: advisory lock, undo idempotency, first-50 grace, per-label threshold, status-regression block**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-09T13:49:15Z
- **Completed:** 2026-05-09T13:58:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built `pollOnce(userId)` orchestrator that composes ingest, matcher, classifier, and act stages with per-email failure isolation
- Implemented `ingestSinceWatermark` with Gmail history.list and messages.list fallback on 404 (expired history)
- Built `actOnEmail` with all 5 trust gates: pg_try_advisory_lock per email, reviewedByUser undo idempotency, first-50 email grace period, per-label confidence threshold, and status-regression detection
- Added ESLint boundaries exception for inbox cross-slice imports (mirrors existing .dependency-cruiser.cjs exception)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ingest.ts** - `9c94b18` (feat)
2. **Task 2: Create act.ts + service.ts** - `4315da5` (feat)
3. **Lint fix: Remove unused imports** - `7d8fbda` (fix)

## Files Created/Modified
- `src/features/inbox/ingest.ts` - Stage 1: Gmail API fetch with history.list fallback, idempotent persistEmail
- `src/features/inbox/act.ts` - Stage 4: Auto-update decision with 5 gates (advisory lock, undo, first-50, threshold, regression)
- `src/features/inbox/service.ts` - pollOnce orchestrator composing all 4 stages with per-email error isolation
- `eslint.config.mjs` - Added inbox cross-slice boundary exception for matcher, classifier, applications

## Decisions Made
- **MessageRef type for ingest return:** Raw Gmail message references (id + threadId) instead of ParsedEmail — the orchestrator fetches full messages in the processing loop since history.list only returns lightweight references
- **Sequential processing:** Emails processed one at a time (not parallel) to respect Gmail API quota (250 units/user/sec) and simplify error handling
- **Watermark after loop:** gmailHistoryId and gmailLastSyncAt updated AFTER the loop completes to prevent partial-sync watermark advancement on batch failure
- **ESLint boundaries exception:** Added explicit allow rule for inbox -> matcher/classifier/applications imports, mirroring the existing .dependency-cruiser.cjs exception

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ESLint boundaries cross-slice exception**
- **Found during:** Task 2 (act.ts + service.ts creation)
- **Issue:** ESLint boundaries plugin blocked inbox -> applications, inbox -> matcher, and inbox -> classifier imports (5 errors). dependency-cruiser already had the exception but ESLint did not.
- **Fix:** Added explicit allow rule in eslint.config.mjs for inbox slice to import from matcher, classifier, and applications slices
- **Files modified:** eslint.config.mjs
- **Verification:** `pnpm lint` passes with 0 errors
- **Committed in:** 4315da5 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed unused imports causing lint warnings**
- **Found during:** Task 1 (ingest.ts) and Task 2 (act.ts)
- **Issue:** Plan code included unused imports (errors, ok, err in ingest.ts; err, errors, ApplicationId, ClassifiedBy in act.ts)
- **Fix:** Removed unused imports from both files
- **Files modified:** src/features/inbox/ingest.ts, src/features/inbox/act.ts
- **Verification:** `pnpm lint` passes with 0 warnings
- **Committed in:** 7d8fbda (lint fix commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for lint compliance. No scope creep.

## Issues Encountered
- Build (`pnpm build`) fails on `/applications/[id]` page data collection — this is a pre-existing issue (same error on base commit 5f3a00d), likely requires running database. Not caused by this plan's changes.

## Known Stubs
None — all functions are fully implemented with real logic.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-04-03-01 (mitigated) | src/features/inbox/act.ts | pg_try_advisory_lock per email prevents concurrent act-stage execution. Lock released in finally block. |
| T-04-03-02 (mitigated) | src/features/inbox/act.ts | Status regression check + first-50 grace + per-label thresholds gate auto-update. |
| T-04-03-03 (mitigated) | src/features/inbox/ingest.ts | Body excerpt capped at 500 chars per privacy rule (enforced by extractEmailMetadata in gmail-client.ts). |
| T-04-03-04 (mitigated) | src/features/inbox/service.ts | Sequential processing respects Gmail quota. Per-email failure isolation prevents one bad request from blocking batch. |

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `pollOnce(userId)` is ready for Plan 04-04 (cron scheduling in instrumentation.ts)
- `actOnEmail` is ready for Plan 04-05 (integration tests)
- All 4 stages are wired end-to-end: ingest -> match -> classify -> act

## Self-Check: PASSED

- All 5 created/modified files verified present
- All 3 task commits verified in git log
- Lint: 0 errors, 0 warnings
- Typecheck: passes
- Build: pre-existing failure (not caused by this plan)

---
*Phase: 04-gmail-ingestion-pipeline-cron*
*Completed: 2026-05-09*
