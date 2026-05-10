---
phase: 07-today-dashboard
verified: 2026-05-10T11:35:00Z
status: gaps_found
score: 3/4 success criteria verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: "Today view shows recent 24h activity section"
    status: failed
    reason: "findRecent24hActivity query exists and is tested (7 tests) but is not imported or used in src/app/today/page.tsx. No 'Last 24 Hours' or 'Recent Activity' section renders on the today page."
    artifacts:
      - path: "src/app/today/page.tsx"
        issue: "Does not import findRecent24hActivity; no section renders recent email/status activity"
      - path: "src/features/today/queries.ts"
        issue: "findRecent24hActivity defined (line 232) but orphaned from page"
    missing:
      - "Import and call findRecent24hActivity in today page"
      - "Add a UI section (card or component) to render recent 24h emails and status changes"
  - truth: "Today view shows week summary stats"
    status: partial
    reason: "PipelineStrip in sidebar shows total pipeline counts by status (not week-over-week). findThisWeekCounts exists and is tested (6 tests) but is not used. Week summary is hidden on mobile (lg:block only)."
    artifacts:
      - path: "src/app/today/page.tsx"
        issue: "Does not import findThisWeekCounts; uses getPipelineCounts for PipelineStrip instead"
      - path: "src/components/pipeline-strip.tsx"
        issue: "Shows total counts, not week-over-week deltas; hidden on mobile via lg:block"
    missing:
      - "Either wire findThisWeekCounts into a visible week summary section, or accept PipelineStrip as the week summary"
      - "Make week summary visible on mobile (currently hidden behind lg:block)"
  - truth: "TODAY-04 requirement is defined"
    status: failed
    reason: "ROADMAP references TODAY-01 through TODAY-04 but phase REQUIREMENTS.md only defines TODAY-01, TODAY-02, TODAY-03. TODAY-04 has no definition."
    artifacts:
      - path: ".planning/phases/07-today-dashboard/REQUIREMENTS.md"
        issue: "Only 3 of 4 requirement IDs defined; TODAY-04 missing"
      - path: ".planning/ROADMAP.md"
        issue: "Lists TODAY-04 in Requirements field but no definition exists"
    missing:
      - "Define TODAY-04 in phase REQUIREMENTS.md or remove from ROADMAP Requirements field"
deferred: []
human_verification:
  - test: "Navigate to / as authenticated user"
    expected: "Redirects to /today with dashboard visible"
    why_human: "Requires running dev server and browser session with auth cookie"
  - test: "On mobile viewport (<1024px), verify layout"
    expected: "Nav at top, dashboard cards stack vertically, no sidebar visible"
    why_human: "Requires visual inspection at specific viewport widths"
  - test: "Click interview row in InterviewsCard"
    expected: "Navigates to /applications/[id] detail page"
    why_human: "Requires running app and clicking links"
  - test: "Click arrow link on review queue email in DecisionsCard"
    expected: "Navigates to /inbox"
    why_human: "Requires running app and clicking links"
  - test: "Verify empty state when no data exists"
    expected: "DecisionsCard shows 'all caught up', InterviewsCard shows 'no interviews', QuietCard hidden"
    why_human: "Requires clean database state and visual inspection"
---

# Phase 7: Today Dashboard Verification Report

**Phase Goal:** Daily check-in view that shows today's interviews, stale forays, unreviewed emails, and week summary -- the default landing page.
**Verified:** 2026-05-10T11:35:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Success Criteria (from ROADMAP)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | `/` (root) redirects to `/today` for authenticated users | VERIFIED | `src/app/page.tsx` calls `requireUser()` then `redirect('/today')`. Middleware redirects unauthenticated to `/login`. |
| 2 | Today view shows: upcoming interviews, stale forays, unreviewed email count, week summary stats | PARTIAL | InterviewsCard + DecisionsCard + QuietCard render 3 of 4 data types. Recent 24h activity not displayed. Week summary is pipeline totals (not week-over-week), hidden on mobile. |
| 3 | Each section is clickable -> navigates to relevant detail/filter | VERIFIED | InterviewsCard: each row links to `/applications/[id]`. DecisionsCard: offers link to `/applications/[id]`, emails link to `/inbox`. QuietCard: each foray links to `/applications/[id]`. |
| 4 | Responsive layout works on mobile and desktop | VERIFIED | AppShell uses `lg:grid-cols-[240px_1fr]` (stacked on mobile, sidebar on desktop). Today page uses `max-w-3xl` for readability. Cards are flexbox with `flex-wrap`. PipelineStrip hidden on mobile (`hidden lg:block`). |

**Score:** 3/4 success criteria fully verified

### Requirement Coverage

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| TODAY-01 | Query layer returns today's interviews, ordered by time | VERIFIED | `findTodaysInterviews` in `src/features/today/queries.ts` (line 148), orders by `scheduledAt: 'asc'`, 7 tests pass |
| TODAY-02 | Dashboard loads with 4 sections: interviews, action, activity, week summary | PARTIAL | 3 of 4 sections render (interviews, decisions/stale, offers). "Activity" (recent 24h) section missing. Week summary is pipeline totals in sidebar. |
| TODAY-03 | Empty states display when no data | VERIFIED | InterviewsCard: "No interviews" message. DecisionsCard: "All caught up" message. QuietCard: returns null (hidden). PipelineStrip: shows zero counts. |
| TODAY-04 | (undefined) | MISSING | ROADMAP references TODAY-04 but no definition exists in phase REQUIREMENTS.md |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/today/queries.ts` | 7 query functions for dashboard data | VERIFIED | 337 lines. Exports: findStaleForays, findOfferForays, findReviewQueueTopN, findTodaysInterviews, getPipelineCounts, findRecent24hActivity, findThisWeekCounts. All use `withRls` for tenant isolation. |
| `src/features/today/queries.test.ts` | Integration tests for all queries | VERIFIED | 743 lines. 32+ tests covering all 7 functions: happy paths, edge cases, tenant isolation, empty states, boundary conditions. |
| `src/app/page.tsx` | Root redirect to /today | VERIFIED | 8 lines. Calls `requireUser()`, redirects to `/today` if authenticated, `/login` otherwise. |
| `src/app/today/page.tsx` | Today dashboard page | VERIFIED | 83 lines. Server component. Fetches stale, offers, review, interviews, counts via `Promise.all`. Renders DecisionsCard, InterviewsCard, QuietCard, PipelineStrip. |
| `src/features/today/components/today-section.tsx` | Generic section wrapper | ORPHANED | Exists (31 lines), tested, but NOT used in today page. Specialized cards used instead. |
| `src/features/today/components/count-badge.tsx` | Count badge with delta | ORPHANED | Exists (41 lines), tested, but NOT used anywhere in production code. |
| `src/features/today/components/interviews-card.tsx` | Interview list card | VERIFIED | 46 lines. Renders today's interviews with time, role, company. Each row links to `/applications/[id]`. |
| `src/features/today/components/decisions-card.tsx` | Decisions card (offers + review queue) | VERIFIED | 100 lines. Renders offers and review queue items. Offers link to foray detail, emails link to `/inbox`. Includes ConfirmClassificationButton. |
| `src/features/today/components/quiet-card.tsx` | Stale forays card | VERIFIED | 52 lines. Renders stale forays with StatusBadge and StaleBadge. Each links to `/applications/[id]`. Returns null when empty. |
| `src/features/today/components/confirm-classification-button.tsx` | Client-side confirm button | VERIFIED | 25 lines. Calls `confirmClassification` server action on click. Uses `useTransition` for pending state. |
| `src/features/applications/components/stale-indicator.tsx` | Stale indicator badge | ORPHANED | Exists (14 lines), tested, but NOT used. `StaleBadge` from `@/components/stale-badge` used instead. |
| `src/components/pipeline-strip.tsx` | Pipeline status strip | VERIFIED | 64 lines. Shows counts per canonical status. Hidden on mobile (`hidden lg:block`). |
| `src/components/nav-links.tsx` | Navigation with /today as primary | VERIFIED | `/today` is first link in nav array (line 10). |
| `src/components/app-shell.tsx` | App layout shell | VERIFIED | Responsive grid layout: stacked on mobile, sidebar on desktop. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/page.tsx` | `/today` | `redirect('/today')` | WIRED | Root redirects authenticated users to /today |
| `src/app/today/page.tsx` | `findStaleForays` | import + Promise.all | WIRED | Queries called and results passed to QuietCard |
| `src/app/today/page.tsx` | `findOfferForays` | import + Promise.all | WIRED | Queries called and results passed to DecisionsCard |
| `src/app/today/page.tsx` | `findReviewQueueTopN` | import + Promise.all | WIRED | Queries called and results passed to DecisionsCard |
| `src/app/today/page.tsx` | `findTodaysInterviews` | import + Promise.all | WIRED | Queries called and results passed to InterviewsCard |
| `src/app/today/page.tsx` | `getPipelineCounts` | import + Promise.all | WIRED | Query called and results passed to PipelineStrip |
| `src/app/today/page.tsx` | `findRecent24hActivity` | NOT imported | NOT_WIRED | Query exists and tested but not called from page |
| `src/app/today/page.tsx` | `findThisWeekCounts` | NOT imported | NOT_WIRED | Query exists and tested but not called from page |
| `InterviewsCard` | `/applications/[id]` | `<Link href={...}>` | WIRED | Each interview row links to application detail |
| `DecisionsCard` | `/applications/[id]` | `<Link href={...}>` | WIRED | Offer items link to foray detail |
| `DecisionsCard` | `/inbox` | `<Link href="/inbox">` | WIRED | Review queue emails link to inbox |
| `QuietCard` | `/applications/[id]` | `<Link href={...}>` | WIRED | Stale forays link to application detail |
| `DecisionsCard` | `confirmClassification` | `ConfirmClassificationButton` | WIRED | Button calls server action |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `InterviewsCard` | `interviews` | `findTodaysInterviews(userId)` via Prisma `stage.findMany` | Yes -- queries Stage table with scheduledAt filter | FLOWING |
| `DecisionsCard` | `offers` | `findOfferForays(userId)` via Prisma `application.findMany` | Yes -- queries Application table with canonicalStatus='offer' | FLOWING |
| `DecisionsCard` | `reviewQueue` | `findReviewQueueTopN(userId, 3)` via Prisma `email.findMany` | Yes -- queries Email table with processingStatus='needs_review' | FLOWING |
| `QuietCard` | `forays` | `findStaleForays(userId)` via Prisma `application.findMany` | Yes -- queries Application table with lastActivityAt < 7 days ago | FLOWING |
| `PipelineStrip` | `counts` | `getPipelineCounts(userId)` via Prisma `application.groupBy` | Yes -- aggregates Application table by canonicalStatus | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass | `pnpm test:run` | 29 files, 372 passed, 4 todo | PASS |
| Root page exists | `ls src/app/page.tsx` | File exists (217 bytes) | PASS |
| Today page exists | `ls src/app/today/page.tsx` | File exists (2.7KB) | PASS |
| Query file substantive | `wc -l src/features/today/queries.ts` | 337 lines | PASS |
| Test file substantive | `wc -l src/features/today/queries.test.ts` | 743 lines | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/today/components/today-section.tsx` | all | Orphaned component (not imported by any production code) | Warning | Dead code -- component was built per plan but replaced by specialized cards |
| `src/features/today/components/count-badge.tsx` | all | Orphaned component (not imported by any production code) | Warning | Dead code -- component was built per plan but not used in final implementation |
| `src/features/applications/components/stale-indicator.tsx` | all | Orphaned component (not imported by any production code) | Warning | Dead code -- StaleBadge used instead |

### Human Verification Required

### 1. Root Redirect Behavior

**Test:** Navigate to `/` in a browser with an active session cookie
**Expected:** Redirects to `/today` showing the dashboard
**Why human:** Requires running dev server and browser with auth cookie

### 2. Mobile Responsive Layout

**Test:** Open `/today` in a mobile viewport (<768px)
**Expected:** Nav at top, cards stack vertically, PipelineStrip hidden, no horizontal scroll
**Why human:** Requires visual inspection at specific viewport widths

### 3. Section Click Navigation

**Test:** Click an interview row, a review queue email arrow, and a stale foray arrow
**Expected:** Each navigates to the correct detail/inbox page
**Why human:** Requires running app and interactive testing

### 4. Empty State Display

**Test:** View `/today` with no interviews, no review items, no stale forays
**Expected:** DecisionsCard shows "all caught up" message, InterviewsCard shows "no interviews" message, QuietCard hidden entirely
**Why human:** Requires clean database state and visual inspection

### Gaps Summary

Three gaps identified:

**Gap 1 -- Missing "Recent 24h Activity" section (blocking):** The `findRecent24hActivity` query function exists (337 lines in queries.ts) and has 7 passing tests, but it is not imported or called in `src/app/today/page.tsx`. No UI section renders recent email or status change activity. The ROADMAP success criterion "Today view shows: ... unreviewed email count" is partially met by the DecisionsCard (which shows review queue items), but the broader "recent activity" signal is absent.

**Gap 2 -- Week summary incomplete (partial):** `findThisWeekCounts` exists and is tested but is not used. The PipelineStrip shows total pipeline counts (not week-over-week deltas) and is hidden on mobile. The "week summary stats" success criterion is only partially met -- desktop users see total counts, mobile users see nothing.

**Gap 3 -- TODAY-04 undefined:** ROADMAP lists TODAY-04 as a requirement but no definition exists in the phase REQUIREMENTS.md. Either define it or remove it from ROADMAP.

**Non-blocking observations:** Three components (TodaySection, CountBadge, StaleIndicator) from plan 07-02 are orphaned -- they exist and are tested but are not used in the actual today page. The implementation used specialized card components instead. These are dead code candidates for cleanup.

---

_Verified: 2026-05-10T11:35:00Z_
_Verifier: Claude (gsd-verifier)_
