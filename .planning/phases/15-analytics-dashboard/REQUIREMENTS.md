# Requirements: Phase 15 - Analytics Dashboard

**Phase**: Full-5  
**Derived from**: FULL-ROADMAP.md Phase 5  
**Maps to**: Plans 15-01, 15-02, 15-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| ANAL-01 | Conversion funnel visualization (applied → offer) | 15-01 | Dashboard shows funnel with counts |
| ANAL-02 | Recruiter effectiveness table (interviews/offers per recruiter) | 15-01 | Table ranks recruiters by conversion rate |
| ANAL-03 | Trend chart (applications over time, monthly) | 15-02 | Line chart shows applied/interviewed/offers per month |
| ANAL-04 | Time-to-hire metrics (avg, median, min/max days) | 15-02 | Metrics card shows "Avg 14 days to interview" |
| ANAL-05 | Application source breakdown (bookmarklet vs. manual) | 15-02 | Pie chart shows source distribution |
| ANAL-06 | Nightly snapshot aggregation (pre-compute metrics) | 15-03 | Cron job runs at 2am, calculates and stores snapshot |
| ANAL-07 | CSV export of all metrics | 15-03 | Download link exports month's metrics to CSV |
| ANAL-08 | Filter by date range | 15-02 | Select month dropdown, analytics update |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Dashboard load time | <1 second (pre-computed snapshots) |
| Performance | Trend chart render | <500ms (50+ months of data) |
| Performance | Nightly aggregation | <10 seconds (for 100 users) |
| Accuracy | Conversion metrics | Match database counts exactly |
| Accuracy | Time calculations | Median correctly calculated (50th percentile) |
| Usability | Charts responsive | Adapt to mobile screens |
| Usability | Data labels clear | Every metric has context + comparison |

---

## Boundary Conditions

- **Snapshot frequency**: Once per day (nightly at 2am)
- **Historical data**: Keep 24 months of snapshots
- **Recruiter inclusion**: Top 10 recruiters shown (others in "other" category)
- **Application source tracking**: Requires `source` field in applications (bookmarklet, manual, email)

---

## Success Criteria

- [ ] Dashboard page created (`/analytics`)
- [ ] Conversion funnel chart renders correctly
- [ ] Recruiter effectiveness table showing top 10 + conversion rates
- [ ] Trend chart with monthly application/interview/offer counts
- [ ] Time-to-hire metrics calculated + displayed
- [ ] Source breakdown pie chart (bookmarklet vs. manual)
- [ ] Nightly snapshot cron job working
- [ ] CSV export functional
- [ ] All metrics match database counts (no calculation errors)
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-5 complete**: Applications exist
- **Full-3 optional**: Recruiter entity enhances analytics
- **Full-4 optional**: Calendar integration enables time-to-hire tracking
- **Recharts library**: `npm install recharts`
- **Postgres window functions**: For real-time calculations (if needed)

---

## Out of Scope (Phase 15)

- AI-powered insights (e.g., "Apply to more startups") — ML not in scope
- Predictive models (forecast success rate) — ML not in scope
- Real-time dashboard (always up-to-date) — snapshot-based is sufficient
- Competitor benchmarking ("compare to other job seekers") — privacy concern
- Custom metric definitions (user-configurable analytics) — too complex for Phase 15

---

## Integration Points

- **Standard-1**: Bookmarklet data feeds analytics
- **Full-1**: Extension usage tracked as source
- **Full-3**: Recruiter effectiveness metrics
- **Full-4**: Time-to-hire including calendar events
- **Full-6**: Notifications can highlight trends ("You got 2 offers this month!")

---

## API Endpoints

- `GET /api/analytics` → Dashboard data (conversion, recruiters, trends, time metrics)
- `GET /api/analytics/recruiter/:id` → Specific recruiter analytics
- `GET /api/analytics/export?format=csv&month=2026-05` → CSV export
- `POST /api/analytics/snapshot` → Manual trigger nightly aggregation (admin)

---

## Database Schema Changes

```prisma
model Application {
  // ... existing fields
  
  source String?  // 'bookmarklet', 'manual', 'email', 'extension'
  
  @@index([userId, source])
}

model AnalyticsSnapshot {
  id Int @id @default(autoincrement())
  userId String
  snapshotDate DateTime @default(now())
  periodStart DateTime
  periodEnd DateTime
  
  // Conversion funnel
  appliedCount Int
  screeningCount Int
  interviewingCount Int
  offerCount Int
  rejectionCount Int
  
  // Time metrics
  avgDaysToInterview Int
  medianDaysToInterview Int
  minDaysToInterview Int
  maxDaysToInterview Int
  
  // Top recruiters (JSON)
  topRecruiters Json
  
  // Source breakdown
  sourceBreakdown Json
  
  @@unique([userId, periodStart])
  @@index([userId])
}
```

---

## Testing Strategy

- Unit tests: Metric calculations (conversion rate, time-to-hire)
- Integration tests: Nightly snapshot job, CSV export
- Data tests: Verify calculations match database
- E2E tests: Dashboard loads, charts render, export works
