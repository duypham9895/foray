---
phase: 15-analytics-dashboard
status: complete
completed: 2026-05-11
tags: [analytics, dashboard, funnel, reporting, rls]
---

# Phase 15: Analytics Dashboard Summary

Implemented campaign-level analytics for funnel health, response metrics, weekly activity, and source effectiveness.

## Accomplishments

- Added `/analytics` as an authenticated app-shell page.
- Added analytics navigation and localized nav labels.
- Added `src/features/analytics` with RLS-backed aggregate queries.
- Added funnel counts by canonical status.
- Added response rate and median days-to-first-response metrics.
- Added an eight-week activity chart for applications created per week.
- Added source effectiveness reporting by `ApplicationSource`.
- Added stale forays count with a link back to the applications list.
- Added integration coverage for the analytics dashboard query.

## Verification

- `pnpm typecheck` passed.
- `pnpm lint` passed with existing dependency-boundary deprecation warnings.
- `pnpm exec vitest run tests/integration/analytics.test.ts` passed.
- `pnpm test:run` passed: 41 files, 491 tests passed, 4 todos.
- `pnpm build` passed with the known Turbopack NFT tracing warning from the classifier budget import path.

## Notes

- Aggregations stay SQL-backed through Prisma `groupBy`, `count`, and `$queryRaw`; the feature only maps aggregate rows for display.
- No database migration was needed for this phase.
