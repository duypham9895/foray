---
phase: 11-reminders-cron-infrastructure
plan: 03
subsystem: ui
tags: [react, nextjs, server-components, follow-ups, nav-badge]

requires:
  - phase: 11-01
    provides: "OverdueFollowUp type and findOverdueFollowUps query in today/queries.ts"
  - phase: 11-02
    provides: "FollowUpEditor and FollowUpsCard components"

provides:
  - "FollowUpEditor wired into application detail view between StageEditor and NotesEditor"
  - "FollowUpsCard wired into Today dashboard with 8th parallel query"
  - "Overdue follow-up count badge on Today nav link (server-fetched, client-rendered)"
  - "NavLinksWrapper server component pattern for async data in client nav"

affects: [today-dashboard, application-detail, nav]

tech-stack:
  added: []
  patterns: ["server-wrapper-for-client-component", "parallel-query-extension"]

key-files:
  created:
    - src/components/nav-links-wrapper.tsx
  modified:
    - src/features/applications/components/application-detail.tsx
    - src/app/today/page.tsx
    - src/components/nav-links.tsx
    - src/components/app-shell.tsx

key-decisions:
  - "Used AppShell (server component) instead of root layout for NavLinksWrapper placement — NavLinks is rendered in AppShell, not layout"
  - "Badge uses bg-primary with text-primary-foreground for accent consistency"

patterns-established:
  - "Server wrapper pattern: create async server component that fetches data and passes to client component via props"

requirements-completed: [REMIND-02, REMIND-03, REMIND-05]

duration: 5min
completed: 2026-05-10
---

# Phase 11 Plan 03: Wire Follow-up UI Summary

**FollowUpEditor in application detail, FollowUpsCard on Today dashboard, and overdue count badge on Today nav link — all wired via server-side data fetching**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-10T07:54:07Z
- **Completed:** 2026-05-10T07:59:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- FollowUpEditor section inserted between StageEditor and NotesEditor in application detail view
- FollowUpsCard rendered on Today dashboard as 8th parallel query (after QuietCard)
- Overdue follow-up count badge on Today nav link, fetched server-side via NavLinksWrapper
- Badge disappears when count is 0, uses accent color styling

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire FollowUpEditor + FollowUpsCard into pages** - `b031c9f` (feat)
2. **Task 2: Nav badge for overdue follow-up count** - `da4f106` (feat)

## Files Created/Modified
- `src/components/nav-links-wrapper.tsx` - Server component that fetches overdue count and passes to NavLinks
- `src/features/applications/components/application-detail.tsx` - Added FollowUpEditor section between StageEditor and NotesEditor
- `src/app/today/page.tsx` - Added findOverdueFollowUps as 8th query, renders FollowUpsCard
- `src/components/nav-links.tsx` - Accepts overdueCount prop, renders pill badge when > 0
- `src/components/app-shell.tsx` - Uses NavLinksWrapper instead of NavLinks

## Decisions Made
- **AppShell placement instead of root layout:** NavLinks is rendered inside AppShell (server component), not the root layout. Created NavLinksWrapper and updated AppShell to use it — avoids modifying the root layout which doesn't render NavLinks.
- **Badge styling:** Uses `bg-primary` with `text-primary-foreground` for accent consistency per DESIGN.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted NavLinksWrapper placement from layout to AppShell**
- **Found during:** Task 2 (Nav badge implementation)
- **Issue:** Plan specified updating root layout (`src/app/layout.tsx`) to use NavLinksWrapper, but NavLinks is rendered in AppShell, not the layout
- **Fix:** Updated AppShell to import and render NavLinksWrapper instead of NavLinks directly
- **Files modified:** src/components/app-shell.tsx
- **Verification:** Typecheck passes, lint passes
- **Committed in:** da4f106 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary adaptation — plan assumed NavLinks was in layout, but it's in AppShell. Same end result achieved.

## Issues Encountered
- Build page data collection fails in worktree due to missing env vars (DATABASE_URL, ENCRYPTION_KEY, etc.) — expected for isolated worktree. Typecheck and lint pass, confirming type correctness.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired with real data sources.

## Threat Flags
None - no new security surface introduced. NavLinksWrapper calls requireUser() before fetching data (T-11-09 mitigated). FollowUpsCard renders server-side with tenant-scoped queries (T-11-10 mitigated).

## Next Phase Readiness
- All follow-up UI components are wired end-to-end
- Application detail shows follow-up editor
- Today dashboard shows overdue follow-ups
- Nav badge shows count when overdue follow-ups exist
- Ready for Phase 11 Plan 04 (if exists) or phase completion

---
*Phase: 11-reminders-cron-infrastructure*
*Completed: 2026-05-10*

## Self-Check: PASSED

- [x] src/components/nav-links-wrapper.tsx exists
- [x] src/features/applications/components/application-detail.tsx exists
- [x] src/app/today/page.tsx exists
- [x] src/components/nav-links.tsx exists
- [x] src/components/app-shell.tsx exists
- [x] .planning/phases/11-reminders-cron-infrastructure/11-03-SUMMARY.md exists
- [x] Commit b031c9f exists
- [x] Commit da4f106 exists
