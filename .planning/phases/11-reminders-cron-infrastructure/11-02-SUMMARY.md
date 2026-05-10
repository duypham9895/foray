---
phase: 11-reminders-cron-infrastructure
plan: 02
subsystem: ui
tags: [react, next-intl, server-actions, date-fns, follow-up, reminders]

requires:
  - phase: 11-01
    provides: setFollowUp/clearFollowUp service, OverdueFollowUp type, followUpInputSchema

provides:
  - FollowUpEditor client component for setting/clearing follow-up dates
  - FollowUpsCard server component for Today dashboard overdue section
  - setFollowUpAction and clearFollowUpAction server actions
  - i18n keys for follow-ups in en, vi, id locales

affects:
  - 11-03 (Wiring integrates FollowUpEditor into detail page and FollowUpsCard into Today page)

tech-stack:
  added: []
  patterns: [useActionState with .bind(null, id) currying, quick-set date buttons, aria-label overrides for accessible names]

key-files:
  created:
    - src/features/applications/components/follow-up-editor.tsx
    - src/features/applications/components/follow-up-editor.test.tsx
    - src/features/today/components/follow-ups-card.tsx
  modified:
    - src/features/applications/actions.ts
    - messages/en.json
    - messages/vi.json
    - messages/id.json

key-decisions:
  - "Quick-set buttons use aria-label with full date for accessibility, overriding text content as accessible name"
  - "FollowUpsCard uses same section pattern as QuietCard (rounded-lg border bg-card p-6)"
  - "clearFollowUpAction uses form submission (no formData param) since it needs no input"

patterns-established:
  - "Quick-set date buttons: Tomorrow (+1d), Next week (+7d), Next month (+30d) with aria-label computed dates"
  - "Follow-up editor three-state pattern: display-empty, display-set, editing"

requirements-completed: [REMIND-01, REMIND-02, REMIND-05]

duration: 12min
completed: 2026-05-10
---

# Phase 11 Plan 02: Follow-up UI Summary

**FollowUpEditor client component with quick-set date buttons and FollowUpsCard server component rendering overdue follow-ups on the Today dashboard**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T07:38:30Z
- **Completed:** 2026-05-10T07:50:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- FollowUpEditor renders three states: display-empty ("No follow-up set"), display-set ("Follow-up: May 15"), and editing (quick-set buttons + date picker)
- Quick-set buttons (Tomorrow, Next week, Next month) compute dates via date-fns and save immediately via setFollowUpAction
- Server actions follow existing pattern: parse with Zod, requireUser(), call service, revalidatePath
- FollowUpsCard renders overdue follow-ups as a server component with role/company/days-overdue and links to application detail
- i18n keys added for en, vi, id locales with ICU pluralization for daysOverdue

## Task Commits

Each task was committed atomically:

1. **Task 1: FollowUpEditor component + server actions** - `8d76bf4` (feat)
2. **Task 2: FollowUpsCard component + i18n keys** - `0e8e52b` (feat)

## Files Created/Modified

- `src/features/applications/components/follow-up-editor.tsx` - Client island with three states, quick-set buttons, date picker
- `src/features/applications/components/follow-up-editor.test.tsx` - 10 tests covering all interaction states
- `src/features/today/components/follow-ups-card.tsx` - Server component rendering overdue follow-ups
- `src/features/applications/actions.ts` - Added setFollowUpAction and clearFollowUpAction
- `messages/en.json` - Added followUpsTitle, followUpsSubtitle, daysOverdue keys
- `messages/vi.json` - Added Vietnamese translations for follow-up keys
- `messages/id.json` - Added Indonesian translations for follow-up keys

## Decisions Made

- Quick-set buttons use `aria-label` with full computed date (e.g., "Set follow-up to May 11, 2026") for screen reader accessibility, which overrides text content as the accessible name in testing-library queries
- FollowUpsCard follows the QuietCard pattern (section with rounded-lg border bg-card p-6) rather than TodaySection wrapper, for visual consistency with existing Today dashboard sections
- clearFollowUpAction takes no formData parameter since clearing needs no input (just auth)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test selectors for aria-label override**
- **Found during:** Task 1 (FollowUpEditor tests)
- **Issue:** Quick-set buttons have aria-label that overrides text content as accessible name, causing getByRole('button', { name: /tomorrow/i }) to fail
- **Fix:** Updated tests to use getAllByRole('button', { name: /set follow-up to/i }) to find quick-set buttons by their aria-label pattern
- **Files modified:** src/features/applications/components/follow-up-editor.test.tsx
- **Verification:** All 10 tests pass
- **Committed in:** 8d76bf4 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript strict mode errors in test file**
- **Found during:** Task 1 (typecheck)
- **Issue:** Array element access (quickSetBtns[0]) could be undefined under strict mode
- **Fix:** Added expect(quickSetBtns[0]).toBeDefined() assertions before fireEvent.click with non-null assertion
- **Files modified:** src/features/applications/components/follow-up-editor.test.tsx
- **Verification:** pnpm typecheck passes
- **Committed in:** 8d76bf4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were test infrastructure issues, not scope creep. Component implementation followed plan exactly.

## Issues Encountered

- Build fails in worktree due to missing .env.local (pre-existing environment issue, not related to code changes). Typecheck and all tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FollowUpEditor and FollowUpsCard ready for wiring into application detail and Today pages in Plan 03
- Server actions exported and ready for component integration
- i18n keys in place for all locales

## Self-Check: PASSED

- All 3 created files exist
- Both commit hashes verified in git log
- setFollowUpAction and clearFollowUpAction exported from actions.ts
- FollowUpEditor starts with 'use client' directive
- FollowUpsCard imports OverdueFollowUp type from queries

---
*Phase: 11-reminders-cron-infrastructure*
*Completed: 2026-05-10*
