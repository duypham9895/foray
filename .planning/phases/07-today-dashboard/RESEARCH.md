# Research: Phase 7 - Today Dashboard

**Phase**: Standard-2  
**Goal**: One-screen view of today's priority activities (interviews, pending actions, recent activity, week summary)  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Users must navigate to multiple sections to answer "What's happening today?" — checking applications list, email inbox, and manually calculating week progress.

**Friction points**:
- No single dashboard showing today's activities
- Manual scanning of applications to find today's interviews
- No visibility into old, stale applications (>7 days no activity)
- No week-at-a-glance summary (how many interviews are scheduled this week)

**Solution**: Today Dashboard with four sections:
- **Today's Interviews**: Scheduled interviews for today, sorted by time
- **Action Needed**: Review queue items capped at 10 (low-confidence classifier decisions)
- **Recent 24h**: Email activity from last 24 hours (classified emails, recruiter outreach)
- **Week Summary**: Quick count of interviews, rejections, offers planned this week vs. actuals

---

## Architecture: Query Layer Pattern

The dashboard doesn't create new data — it composes existing queries into a read-only view.

**Four core queries**:

1. **todayInterviews(userId)** → `SELECT ... WHERE stageName IS NOT NULL AND stageDate = TODAY ORDER BY stageDate ASC`
   - Returns: Application ID, company, role, stage, time
   - Performance: <100ms (indexed on user + stageDateISNOT NULL)

2. **actionNeeded(userId, limit=10)** → `SELECT ... FROM review_queue WHERE userId = ? AND resolved = false LIMIT 10`
   - Returns: Email subject, application, confidence, classifier reason
   - Performance: <50ms (indexed on userId + resolved)

3. **recent24hActivity(userId)** → `SELECT ... FROM Email WHERE userId = ? AND receivedAt > NOW() - 24h ORDER BY receivedAt DESC`
   - Returns: Email subject, sender, classification label, application match
   - Performance: <30ms (indexed on userId + receivedAt)

4. **thisWeekCounts(userId)** → Aggregate queries:
   - Interviews scheduled THIS WEEK (not today)
   - Rejections received THIS WEEK
   - Offers received THIS WEEK
   - Delta from last week
   - Performance: <20ms (pre-aggregated if needed, or window functions)

**Total page query time**: <100ms combined (all 4 queries in parallel)

---

## Empty State Philosophy

Don't show "loading..." — show clear messaging:
- "No interviews scheduled for today" (not "0 interviews")
- "All caught up! No pending reviews" (not empty gray box)
- "No email in last 24 hours" (not blank section)

Empty states should feel intentional ("nothing to do") not broken ("nothing loaded").

---

## Stale Foray Indicator

A foray is "stale" if:
- No status change AND no email AND no note in >7 days (exactly 168 hours)
- Stale forays get a visual badge in the dashboard to encourage action

**Calculation**: `(NOW() - MAX(lastStatusChangeAt, lastEmailAt, lastNoteAt)) > 7 days`

Example: Last status change was 8 days ago, no recent emails/notes → Stale badge.

---

## Performance Architecture

**Load time targets**:
- Page load (DOM + all 4 queries): <500ms
- Query execution (all 4 in parallel): <100ms
- Component render: <50ms
- Total UX time: <200ms until interactive

**Strategy**:
- Query all 4 data sources in parallel (not sequentially)
- Database indexes on (userId, resolved), (userId, receivedAt), (userId, stageDate)
- Cache 4-query results in React state (refresh on manual "reload" only)
- No infinite scroll — sections are fixed size (capped at 10 for action queue, full list for interviews)

---

## Prisma Query Patterns

**Indexes needed** (add to schema.prisma):
```prisma
model Email {
  @@index([userId, receivedAt])  // For recent 24h activity
}

model Application {
  @@index([userId, stageDate])   // For today's interviews
}

model ReviewQueueItem {
  @@index([userId, resolved])    // For action needed
}
```

---

## Week Summary Delta Logic

"Delta" = difference between this week and last week.

**This week**:
- Monday start = last Monday (even if today is Wednesday)
- Count interviews scheduled, rejections, offers in that window

**Last week**: 
- Same calculation, 7 days earlier

**Example**:
- Last week: 3 interviews, 0 rejections
- This week: 5 interviews, 1 rejection
- Delta: +2 interviews, +1 rejection

Display as: "5 interviews scheduled this week (↑ 2 from last week)"

---

## Component Composition

Dashboard is a layout wrapper containing:
- `TodaySection` — displays interview list
- `ActionSection` — displays review queue
- `Activity24hSection` — displays recent emails
- `WeekSummarySection` — displays counts + delta

Each section handles its own empty state and data display.

---

## Refresh Strategy

No real-time polling. Dashboard refreshes on:
1. Manual user click "refresh"
2. Navigation back to dashboard (re-mount component)
3. Background sync (not in Phase 7, saved for later)

No automatic polling — it's a view, not a monitor.

---

## Acceptance Criteria Rationale

✅ **Query layer exists** → Can verify <100ms performance  
✅ **Empty states clear** → User understands "nothing today" vs. "loading"  
✅ **Stale indicator works** → Users see which forays need attention  
✅ **Week delta accurate** → Math matches reality (matches database, not hardcoded)  
✅ **Layout four sections** → Clear visual separation between concerns  
✅ **Performance <500ms** → Fast enough to not annoy users  
✅ **Pre-commit gates pass** → No regressions

---

*Phase 7 focuses on visibility. No new data is created — we're just composing existing queries into a useful view.*
