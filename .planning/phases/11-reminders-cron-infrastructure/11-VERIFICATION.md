---
phase: 11-reminders-cron-infrastructure
verified: 2026-05-10T08:08:13Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 11: Reminders + Cron Infrastructure Verification Report

**Phase Goal:** Owner can set follow-up dates on applications and see overdue follow-ups on the Today dashboard, powered by a robust multi-job cron infrastructure.
**Verified:** 2026-05-10T08:08:13Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner can set and change a follow-up date on any application via the detail view | VERIFIED | FollowUpEditor component (224 lines) renders three states: display-empty, display-set, editing. Quick-set buttons (Tomorrow, Next week, Next month) compute dates via date-fns and save via setFollowUpAction. clearFollowUpAction handles clearing. Wired into application-detail.tsx between StageEditor and NotesEditor (lines 57-63). Server actions in actions.ts (lines 375-433) use followUpInputSchema validation, requireUser(), and call setFollowUp/clearFollowUp service. |
| 2 | Today dashboard shows a "Follow-ups due" section listing applications where followUpAt <= now() | VERIFIED | findOverdueFollowUps query (queries.ts line 196) filters by `followUpAt: { lte: now, not: null }` and orders ascending. FollowUpsCard (49 lines) renders role, company, days overdue with links to application detail. Wired into Today page (page.tsx line 80) as 8th parallel query (line 44). i18n keys present in en, vi, id locales with ICU pluralization. |
| 3 | Count badge on Today nav link displays the number of overdue follow-ups | VERIFIED | NavLinksWrapper (18 lines) is a server component that calls requireUser() + findOverdueFollowUps(), passes count to NavLinks. NavLinks (50 lines) renders badge pill with `bg-primary` styling when overdueCount > 0 and href === '/today' (line 24). Badge disappears when count is 0. Wired via AppShell (line 26) which imports NavLinksWrapper. |
| 4 | Reminder check cron runs every 15 minutes without hot-reload double-fire (CronRegistry pattern) | VERIFIED | CronRegistry (63 lines) exports registerCronJobs with 4 guards: NEXT_RUNTIME check, NODE_ENV test check, globalThis cleanup for hot-reload, pg_try_advisory_lock for overlap prevention. instrumentation.ts (34 lines) registers two jobs: poll-gmail and reminder-check, both on '*/15 * * * *' schedule. No inline cron.schedule remains. Advisory unlock in finally block. |
| 5 | Overdue follow-ups appear in Today view within 15 minutes of becoming due | VERIFIED | findOverdueFollowUps query uses `followUpAt: { lte: now }` which is evaluated at page render time. Today page fetches this query on every server-side render (line 44 in page.tsx). No caching layer delays results. The reminder-check cron (every 15 min) exists as a hook for future notification logic but the Today page query is the real consumer -- data is always fresh on page load. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/cron/registry.ts` | CronRegistry with job array pattern, 4 guards | VERIFIED | 63 lines. Exports registerCronJobs and CronJob interface. All 4 guards present. |
| `src/core/cron/registry.test.ts` | Unit tests for guard logic, lock/unlock, error handling | VERIFIED | 205 lines, 10 test cases covering registration, guards, advisory lock, error handling. |
| `src/features/applications/follow-up-service.ts` | setFollowUp, clearFollowUp with tenant isolation | VERIFIED | 87 lines. Uses withRls, throw-bridge pattern for cross-tenant errors. |
| `src/features/applications/follow-up-service.test.ts` | Integration tests for set/clear/error paths | VERIFIED | 146 lines, 8 test cases covering set, clear, not-found, cross-tenant safety. |
| `src/features/applications/schema.ts` | followUpInputSchema with z.coerce.date() | VERIFIED | Lines 152-155. Exports followUpInputSchema and FollowUpInput type. |
| `src/features/today/queries.ts` | findOverdueFollowUps query and OverdueFollowUp type | VERIFIED | Lines 188-218. Query filters by lte:now, orders ascending, computes daysOverdue. |
| `src/features/today/queries.test.ts` | Tests for findOverdueFollowUps | VERIFIED | 892 lines total. findOverdueFollowUps tests start at line 747. |
| `src/instrumentation.ts` | Uses CronRegistry for both jobs | VERIFIED | 34 lines. Imports registerCronJobs, defines poll-gmail and reminder-check jobs. |
| `src/features/applications/components/follow-up-editor.tsx` | Client island with 3 states, quick-set buttons, date picker | VERIFIED | 224 lines. 'use client' directive. Imports setFollowUpAction/clearFollowUpAction. Three states with aria-labels. |
| `src/features/applications/components/follow-up-editor.test.tsx` | Component tests for all interaction states | VERIFIED | 134 lines, 10 test cases covering all states, quick-set, clear, cancel, aria-labels. |
| `src/features/today/components/follow-ups-card.tsx` | Server component rendering overdue follow-ups | VERIFIED | 49 lines. No 'use client'. Imports OverdueFollowUp type. Returns null when empty. Uses i18n. |
| `src/features/applications/actions.ts` | setFollowUpAction, clearFollowUpAction server actions | VERIFIED | Lines 375-433. Both use followUpInputSchema, requireUser(), call service, revalidatePath. |
| `src/features/applications/components/application-detail.tsx` | FollowUpEditor section between StageEditor and NotesEditor | VERIFIED | Lines 57-63. FollowUpEditor receives applicationId and followUpAt. |
| `src/app/today/page.tsx` | Today page with FollowUpsCard and 8th parallel query | VERIFIED | 142 lines. 8 queries in Promise.all (line 35-45). FollowUpsCard rendered at line 80. |
| `src/components/nav-links.tsx` | NavLinks with optional overdueCount prop and badge | VERIFIED | 50 lines. Accepts overdueCount prop (default 0). Badge rendered when count > 0 on /today. |
| `src/components/nav-links-wrapper.tsx` | Server wrapper fetching overdue count | VERIFIED | 18 lines. Calls requireUser() + findOverdueFollowUps(). Passes count to NavLinks. |
| `src/components/app-shell.tsx` | Uses NavLinksWrapper instead of NavLinks | VERIFIED | Line 26: `<NavLinksWrapper />`. Imports from ./nav-links-wrapper. |
| `messages/en.json` | followUpsTitle, followUpsSubtitle, daysOverdue keys | VERIFIED | Lines 123-125 with ICU pluralization. |
| `messages/vi.json` | Vietnamese translations for follow-up keys | VERIFIED | Lines 123-125 with Vietnamese text. |
| `messages/id.json` | Indonesian translations for follow-up keys | VERIFIED | Lines 123-125 with Indonesian text. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/instrumentation.ts` | `src/core/cron/registry.ts` | `import('@/core/cron/registry')` | WIRED | Line 2 dynamic import |
| `src/features/applications/follow-up-service.ts` | `prisma.application.update` | `withRls` transaction | WIRED | Lines 37-41 (setFollowUp), 72-75 (clearFollowUp) |
| `src/features/applications/components/follow-up-editor.tsx` | `src/features/applications/actions.ts` | `import { setFollowUpAction, clearFollowUpAction }` | WIRED | Lines 17-20 |
| `src/features/today/components/follow-ups-card.tsx` | `src/features/today/queries.ts` | `import type { OverdueFollowUp }` | WIRED | Line 4 |
| `src/features/applications/components/application-detail.tsx` | `src/features/applications/components/follow-up-editor.tsx` | `import + render between StageEditor and NotesEditor` | WIRED | Line 13 import, lines 57-63 render |
| `src/app/today/page.tsx` | `src/features/today/components/follow-ups-card.tsx` | `import + render in page` | WIRED | Line 9 import, line 80 render |
| `src/components/nav-links-wrapper.tsx` | `src/features/today/queries.ts` | `import { findOverdueFollowUps }` | WIRED | Line 2 |
| `src/components/app-shell.tsx` | `src/components/nav-links-wrapper.tsx` | `import { NavLinksWrapper }` | WIRED | Line 5, rendered at line 26 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| FollowUpsCard | followUps prop | Today page: findOverdueFollowUps(userId) via withRls | Yes -- Prisma query with lte:now filter | FLOWING |
| NavLinks | overdueCount prop | NavLinksWrapper: findOverdueFollowUps(userId).length | Yes -- count derived from Prisma query | FLOWING |
| FollowUpEditor | followUpAt prop | ApplicationDetail: application.followUpAt (Prisma scalar) | Yes -- Prisma returns all scalar fields | FLOWING |
| FollowUpEditor | setFollowUpAction/clearFollowUpAction | actions.ts: calls setFollowUp/clearFollowUp service | Yes -- service writes to DB via withRls | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `pnpm typecheck` | Pass (no errors) | PASS |
| All tests pass | `pnpm test:run` | 432 passed, 4 todo, 35 test files | PASS |
| CronRegistry guards present | grep for 4 guard patterns | All 4 found (NEXT_RUNTIME, NODE_ENV, globalThis, advisory lock) | PASS |
| Server actions export | grep for setFollowUpAction, clearFollowUpAction | Both exported from actions.ts | PASS |
| i18n keys in all 3 locales | grep followUpsTitle in en/vi/id | Present in all 3 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| REMIND-01 | Plan 01, 02 | Owner can set a follow-up date on any application via followUpAt field | SATISFIED | Follow-up service (setFollowUp/clearFollowUp), schema (followUpInputSchema), server actions (setFollowUpAction/clearFollowUpAction), FollowUpEditor component all present and wired |
| REMIND-02 | Plan 02, 03 | Today dashboard shows "Follow-ups due" section listing applications where followUpAt <= now() | SATISFIED | findOverdueFollowUps query with lte:now filter, FollowUpsCard component, wired into Today page as 8th query |
| REMIND-03 | Plan 03 | Count badge on Today nav link shows number of overdue follow-ups | SATISFIED | NavLinksWrapper fetches count server-side, NavLinks renders badge pill when count > 0 on /today link |
| REMIND-04 | Plan 01 | Cron infrastructure upgraded to CronRegistry pattern supporting multiple scheduled jobs without hot-reload double-fire | SATISFIED | CronRegistry with 4 guards (NEXT_RUNTIME, NODE_ENV, globalThis cleanup, pg_try_advisory_lock), instrumentation.ts refactored to use it |
| REMIND-05 | Plan 01, 03 | Reminder check cron runs every 15 minutes and surfaces due follow-ups in Today view | SATISFIED | reminder-check cron registered at '*/15 * * * *' in instrumentation.ts; findOverdueFollowUps query fetches overdue data directly in Today page |

**Requirements orphaned:** None. All 5 REMIND requirements (REMIND-01 through REMIND-05) are mapped to plans and verified.

### Anti-Patterns Found

No anti-patterns detected. All files clean of TODO, FIXME, PLACEHOLDER, stub returns, and console.log-only implementations.

### Human Verification Required

### 1. Visual rendering of FollowUpEditor

**Test:** Open application detail page, verify FollowUpEditor section appears between StageEditor and NotesEditor with correct styling.
**Expected:** Section heading "Follow-up", date display or "No follow-up set", quick-set buttons in editing state.
**Why human:** Visual layout and spacing cannot be verified programmatically.

### 2. Nav badge appearance and disappearance

**Test:** With overdue follow-ups, verify Today nav link shows a colored pill badge. Clear all follow-ups, verify badge disappears.
**Expected:** Badge appears with accent color (burnt amber), shows count number, disappears when count is 0.
**Why human:** Visual appearance and real-time state transitions need browser verification.

### 3. Quick-set button date accuracy

**Test:** Click "Tomorrow", "Next week", "Next month" buttons and verify the saved dates are correct relative to current date.
**Expected:** Tomorrow = +1 day, Next week = +7 days, Next month = +30 days (approximate for months).
**Why human:** Edge cases around month boundaries and timezone handling need manual verification.

### Gaps Summary

No gaps found. All 5 roadmap success criteria are verified. All 5 REMIND requirements are satisfied. All 20 artifacts exist, are substantive, and are correctly wired. Typecheck passes, 432 tests pass across 35 test files. i18n keys present in all 3 locales.

---

_Verified: 2026-05-10T08:08:13Z_
_Verifier: Claude (gsd-verifier)_
