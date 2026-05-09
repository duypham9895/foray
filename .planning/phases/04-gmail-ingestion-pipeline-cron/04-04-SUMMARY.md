---
plan: 04-04
status: complete
tasks_completed: 2
tasks_total: 2
---

# Plan 04-04: Settings Page + Cron — Summary

## What Was Built

Settings page with Gmail connection state UI and in-process 15-minute cron job with 4 guards.

## Tasks Completed

1. **Settings page + Server Actions** — `/settings` Server Component with Connect/Disconnect/Sync-now buttons + token-health banner; Server Actions for syncNow and disconnectGmail
2. **instrumentation.ts** — node-cron 15-minute job with 4 guards: `NEXT_RUNTIME === 'nodejs'`, `globalThis.__forayCron?.stop()`, `pg_try_advisory_lock('poll-gmail')`, `NODE_ENV !== 'test'`

## Key Files Modified

- `src/app/settings/page.tsx` — Server Component settings page
- `src/features/inbox/actions.ts` — syncNow + disconnectGmail Server Actions
- `src/features/inbox/components/connect-gmail-button.tsx` — Links to /api/gmail/auth
- `src/features/inbox/components/sync-now-button.tsx` — Calls syncNow action
- `src/features/inbox/components/disconnect-gmail-button.tsx` — Calls disconnectGmail action
- `src/features/inbox/components/token-health-banner.tsx` — Warns at ≥5 days stale sync
- `src/instrumentation.ts` — node-cron with 4 guards

## Deviations

- Fixed `startTransition` type error — callback must return void, not Promise

## Commits

- `d2ac9bd`: feat(04-04): add settings page with Gmail connection UI and Server Actions
- `9b72f8e`: feat(04-04): add instrumentation.ts with 15-minute cron and 4 guards
