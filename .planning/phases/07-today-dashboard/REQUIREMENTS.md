# Requirements: Phase 7 - Today Dashboard

**Phase**: Standard-2  
**Derived from**: STANDARD-ROADMAP.md Phase 2  
**Maps to**: Plans 07-01, 07-02, 07-03

---

## Functional Requirements

| Req ID | Description | Plan | Test |
|--------|-------------|------|------|
| TODAY-01 | Query layer returns today's interviews, ordered by time | 02-01 | `todayInterviews(userId)` returns array, sorted by time |
| TODAY-02 | Dashboard loads with 4 sections: interviews, action, activity, week summary | 02-03 | GET `/` renders all 4 sections |
| TODAY-03 | Empty states display when no data | 02-02 | Section shows "No interviews today" when empty |
| ACTION-01 | Review queue items capped at 10 | 02-01 | `actionNeeded()._count <= 10` |
| ACTION-02 | Stale foray indicator (>7 days no activity) | 02-02 | Stale badge renders on old applications |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Page load time | <500ms (realistic data: 50 apps, 200 emails) |
| Performance | Query time (all 4 queries) | <100ms combined |
| Usability | Sections have clear visual separation | Distinct borders/spacing |
| Reliability | Empty state doesn't confuse (not placeholder) | Clear "No X" messaging |

---

## Boundary Conditions

- **Realistic scale**: 50+ applications, 200+ emails
- **Week summary**: Delta calculation must match reality (not hardcoded)
- **Stale threshold**: Exactly 7 days (168 hours) of no activity
- **Review queue limit**: Capped at 10 items (not unlimited)

---

## Dependencies

- **Standard-1 complete**: Applications created via bookmarklet exist
- **Lean complete**: Email classification, application model stable
- **No new schema changes** (except optional `lastActivityAt` index)

---

## Out of Scope

- Advanced analytics (saved for Full-5)
- Custom date ranges (just "today" + "this week")
- Export/backup (saved for Full-6)

