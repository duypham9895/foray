# Research: Phase 15 - Analytics Dashboard

**Phase**: Full-5  
**Goal**: Insights into job search: conversion rates, time-to-hire, recruiter effectiveness, trend analysis  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: User has raw data (applications, interviews, rejections) but no insights.

**Questions users ask**:
- "How many interviews did I have this month vs. last month?" (trend)
- "Which recruiters are most successful with me?" (recruiter effectiveness)
- "How long does it take from applied to interview?" (conversion funnel)
- "Which roles/companies are most active?" (opportunity concentration)

**Solution**: Analytics dashboard with:
- Conversion funnel (applied → screening → interviewing → offer)
- Recruiter effectiveness (who brings interviews, offers)
- Trend analysis (monthly/weekly charts)
- Time-to-hire metrics
- Application source breakdown (bookmarklet vs. manual)

---

## Metrics & Calculations

**Conversion Funnel**:
```
All applications = 50
├─ Applied (initial state) = 50
├─ Screening (got email from recruiter) = 35
├─ Interviewing (interview stage created) = 20
├─ Offer (offer received) = 3
└─ Conversion rate = 3/50 = 6%
```

**Recruiter Effectiveness**:
```
Recruiter: John Smith
├─ Sent applications = 5
├─ Interviews = 3
├─ Offers = 1
└─ Conversion rate = 20%
```

**Time-to-Hire**:
```
Average days from applied to first interview = 14 days
Median = 10 days
Min/Max = 2 to 45 days
```

**Trends** (monthly breakdown):
```
Month | Applied | Interviews | Offers | Rejections
May   | 15      | 8          | 2      | 3
June  | 12      | 5          | 1      | 2
July  | 20      | 12         | 3      | 4
```

---

## Data Aggregation Strategy

**Challenge**: Real-time aggregation of 50+ applications is expensive.

**Solution: Pre-computed snapshots**:
1. Nightly job: Calculate all metrics at 2am
2. Store in `analytics_snapshots` table
3. Dashboard queries snapshots (fast)
4. Real-time calculation only for "today" (small dataset)

**Snapshot table**:
```prisma
model AnalyticsSnapshot {
  id Int @id
  userId String
  snapshotDate DateTime  // When aggregated
  periodStart DateTime   // Month start (e.g., 2026-05-01)
  periodEnd DateTime     // Month end
  
  // Conversion funnel
  appliedCount Int
  screeningCount Int
  interviewingCount Int
  offerCount Int
  rejectionCount Int
  
  // Time metrics
  avgDaysToInterview Int
  medianDaysToInterview Int
  
  // Recruiter effectiveness (top 5)
  topRecruiters Json  // [{ name, interviews, offers, conversion }]
  
  @@index([userId, periodStart])
}
```

---

## Charts & Visualizations

**Chart library**: Use Recharts (lightweight, React-friendly).

**Charts to include**:
1. **Funnel Chart** (applied → screening → interviewing → offer)
2. **Trend Line** (applications over time, with monthly markers)
3. **Bar Chart** (recruiter comparison)
4. **Time Distribution** (histogram: days to interview)
5. **Pie Chart** (application source: bookmarklet vs. manual vs. email)

---

## Window Functions for Real-Time Calc

**For "this month" on-demand**:
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN canonical_status = 'applied' THEN 1 END) as applied,
  COUNT(CASE WHEN canonical_status = 'screening' THEN 1 END) as screening,
  COUNT(CASE WHEN canonical_status = 'interviewing' THEN 1 END) as interviewing
FROM applications
WHERE userId = $1 AND createdAt >= DATE_TRUNC('month', CURRENT_DATE)
```

---

## Recruiter Analytics

**Auto-calculated from recruiter email**:
```
Recruiter X
├─ Total emails received = 8
├─ Applications linked = 3 (user created app via email from X)
├─ Interviews scheduled = 2
├─ Offers = 1
└─ Effectiveness: 33% (offers / applications)
```

---

## Export Options

**In Phase 15**: CSV export of all metrics.
- `/api/analytics/export?format=csv&month=2026-05` → Download CSV
- Columns: Metric, Value, Comparison (vs. last month)

---

## Privacy Considerations

**Analytics contains**:
- Aggregated counts (no individual email content)
- Company names (already visible in applications)
- Recruiter names/effectiveness (user-visible anyway)

**No new privacy concerns** — same data as already displayed.

---

*Phase 15 enables reflection. Users see what's working and what isn't.*
