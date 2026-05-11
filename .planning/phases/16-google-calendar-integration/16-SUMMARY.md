---
phase: 16-google-calendar-integration
status: complete
completed: 2026-05-11
tags: [calendar, oauth, interviews, cron, rls]
---

# Phase 16: Google Calendar Integration Summary

Implemented one-way Google Calendar sync for interview visibility on Today.

## Accomplishments

- Added a separate Google Calendar OAuth flow at `/api/calendar/auth` and `/api/calendar/callback`.
- Stored Calendar refresh tokens separately from Gmail refresh tokens.
- Added `CalendarEvent` persistence with RLS, event `etag` idempotency, and application matching by attendee or organizer email domain.
- Added manual Calendar sync and disconnect actions from Settings.
- Added Calendar connection state to Settings.
- Added a 30-minute Calendar cron job through the existing `CronRegistry`.
- Added upcoming synced Calendar interviews to the Today interviews card.
- Added integration coverage for Calendar event sync, domain matching, Today surfacing, and unchanged `etag` skips.
- Updated setup, architecture, data model, and env docs for Calendar.

## Verification

- `pnpm exec vitest run tests/integration/calendar.test.ts` passed.
- `pnpm lint` passed with existing dependency-boundary deprecation warnings.
- `pnpm typecheck` passed.
- `pnpm test:run` passed: 42 files, 492 tests passed, 4 todos.
- `pnpm build` passed with the known Turbopack NFT tracing warning from the classifier budget import path.

## Notes

- Calendar sync fetches a rolling window from 7 days ago through 30 days ahead.
- The sync persists interview-like events or events matched to an active application by company domain.
- The Calendar OAuth state check uses a short-lived HTTP-only cookie.
