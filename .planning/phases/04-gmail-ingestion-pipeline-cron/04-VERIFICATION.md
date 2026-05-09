---
phase: 04-gmail-ingestion-pipeline-cron
verified: 2026-05-10T12:30:00Z
status: passed
score: 5/5 success criteria verified
overrides_applied: 0
re_verification: false
---

# Phase 4: Gmail Ingestion + Pipeline + Cron Verification Report

**Phase Goal:** Connecting Gmail, ingesting threads, running the four-stage pipeline (`ingest -> match -> classify -> act`), and scheduling it every 15 minutes -- all with the trust safety nets (first-50 grace, status-regression block, undo race fix) wired in. This is the only legitimate cross-slice composition (`inbox/` imports `matcher/` + `classifier/`).
**Verified:** 2026-05-10T12:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner completes Google OAuth at `/api/gmail/auth` -> `/api/gmail/callback`; refresh token stored AES-256-GCM-encrypted; `/settings` shows connection state + Connect/Disconnect/Sync-now + token-health banner (>=5 days, 7-day Test-mode) | VERIFIED | `auth/route.ts`: `access_type: 'offline'`, `prompt: 'consent'`, `scope: gmail.readonly`. `callback/route.ts`: `encryptToken(tokens.refresh_token)`, stores on `gmailRefreshTokenEncrypted`, resets `gmailLastSyncAt`/`gmailHistoryId` to null. `settings/page.tsx`: Connected/Disconnected badge, ConnectGmailButton, SyncNowButton, DisconnectGmailButton, TokenHealthBanner. `token-health-banner.tsx`: `daysSinceSync >= 5` threshold, mentions "7 days" and "Test mode". |
| 2 | `inbox.pollOnce(userId)` orchestrates 4 stages end-to-end: ingest (history.list + messages.list fallback on 404) -> match -> classify -> act; per-email failures logged, never abort batch; <=500-char bodyExcerpt | VERIFIED | `service.ts`: imports `ingestSinceWatermark`, `matchEmail`, `classifyEmail`, `actOnEmail`; sequential loop with try/catch per email. `ingest.ts`: `history.list` with `historyTypes: ['messageAdded']`, catches 404 via `isGmail404()`, falls back to `messages.list` with `q: 'newer_than:7d'`. `gmail-client.ts`: `bodyExcerpt = extractPlainTextBody(...).slice(0, 500)`. |
| 3 | Auto-update fires only when confidence >= per-label threshold AND application matched AND NOT status regression AND NOT first-50; otherwise routes to `processing_status='needs_review'` | VERIFIED | `act.ts` lines 84-89: `canAutoUpdate` checks `!isFirst50`, `match.applicationId !== null`, `newStatus !== null`, `meetsThreshold(label, confidence)`. Line 117: `isStatusRegression(appCanonicalStatus, newStatus)` check before auto-update. Lines 74-75: `emailCount < 50` for first-50 grace. Line 157-168: fallback routes to `needs_review`. |
| 4 | Auto-applied changes write `Event(type='auto_status_changed', undoable=true)`; undo writes `email.reviewedByUser=true` preventing re-action; `pg_try_advisory_lock` per email serializes act-stage | VERIFIED | `act.ts` line 124: `applyAutoStatusChange(userId, match.applicationId, { source: 'cron', emailId, ... })`. Line 110: `email?.reviewedByUser` check returns `skipped`. Line 63: `pg_try_advisory_lock(hashtext('act:${emailId}'))`. Line 173: `pg_advisory_unlock` in finally block. |
| 5 | `instrumentation.ts` registers 15-min node-cron guarded by NEXT_RUNTIME + globalThis + advisory lock + NODE_ENV; calls pollOnce directly in-process | VERIFIED | `instrumentation.ts` line 8: `NEXT_RUNTIME !== 'nodejs'`. Line 11: `NODE_ENV === 'test'`. Line 16: `g.__forayCron?.stop()`. Line 18: `cron.schedule('*/15 * * * *', ...)`. Line 21: `pg_try_advisory_lock(hashtext('poll-gmail'))`. Line 25: `import pollOnce` (dynamic). Line 40: `pg_advisory_unlock` in finally. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | ProcessingStatus enum + processing_status on Email + gmailHistoryId on User | VERIFIED | Enum at line 96 (6 values), column at line 261 (`@default(received) @map("processing_status")`), index at line 283, `gmailHistoryId` at line 116 |
| `src/features/inbox/gmail-client.ts` | OAuth2 factory, Gmail client from refresh token, email metadata extraction | VERIFIED | 97 lines, exports `createOAuth2Client`, `getGmailClient`, `extractEmailMetadata`, `ParsedEmail` type. Uses `decryptToken`, `google.gmail({ version: 'v1' })`, `Buffer.from(body.data, 'base64url')` |
| `src/features/inbox/schema.ts` | Zod schema for parsed email | VERIFIED | 13 lines, exports `parsedEmailSchema` with all 7 fields, `bodyExcerpt: z.string().max(500)` |
| `src/features/inbox/ingest.ts` | history.list + messages.list fallback, idempotent persistEmail | VERIFIED | 148 lines, exports `ingestSinceWatermark`, `persistEmail`, `IngestResult`. Uses `withRls` for persist, `UNIQUE(gmailMessageId)` idempotency |
| `src/features/inbox/act.ts` | actOnEmail with all 5 gates | VERIFIED | 191 lines, exports `actOnEmail`, `ActResult`. Gates: advisory lock, reviewedByUser, first-50, meetsThreshold, isStatusRegression |
| `src/features/inbox/service.ts` | pollOnce orchestrator | VERIFIED | 189 lines, exports `pollOnce`, `PollSummary`. Composes all 4 stages, per-email try/catch, watermark update after loop |
| `src/features/inbox/actions.ts` | syncNow + disconnectGmail Server Actions | VERIFIED | 49 lines, exports both. `syncNow` calls `pollOnce`, `disconnectGmail` nulls all Gmail fields |
| `src/app/api/gmail/auth/route.ts` | GET handler for OAuth redirect | VERIFIED | 22 lines, exports `GET`. Uses `createOAuth2Client`, `generateAuthUrl`, `requireUser()` |
| `src/app/api/gmail/callback/route.ts` | GET handler for code exchange + token storage | VERIFIED | 49 lines, exports `GET`. Exchanges code, encrypts token, stores on User, resets watermarks |
| `src/app/settings/page.tsx` | Server Component settings page | VERIFIED | 64 lines, Server Component (no `'use client'`). Imports all 4 components, queries `tenantDb` for connection state |
| `src/features/inbox/components/connect-gmail-button.tsx` | Links to /api/gmail/auth | VERIFIED | 12 lines, `'use client'`, `<a href="/api/gmail/auth">` |
| `src/features/inbox/components/sync-now-button.tsx` | Calls syncNow Server Action | VERIFIED | 19 lines, `'use client'`, `useTransition`, `void syncNow()` |
| `src/features/inbox/components/disconnect-gmail-button.tsx` | Calls disconnectGmail Server Action | VERIFIED | 19 lines, `'use client'`, `useTransition`, `void disconnectGmail()` |
| `src/features/inbox/components/token-health-banner.tsx` | Warns at >=5 days stale | VERIFIED | 25 lines, `daysSinceSync >= 5` check, mentions "7 days" and "Test mode" |
| `src/instrumentation.ts` | node-cron with 4 guards | VERIFIED | 43 lines, all 4 guards present, dynamic imports, advisory lock |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `auth/route.ts` | `gmail-client.ts` | `import createOAuth2Client` | WIRED | Line 4: `import { createOAuth2Client } from '@/features/inbox/gmail-client'` |
| `callback/route.ts` | `encryption.ts` | `import encryptToken` | WIRED | Line 4: `import { encryptToken } from '@/core/crypto/encryption'` |
| `callback/route.ts` | `tenant.ts` | `tenantDb.user.update` | WIRED | Line 33: `tenantDb(userId).user.update({ data: { gmailRefreshTokenEncrypted: encrypted, ... } })` |
| `service.ts` | `ingest.ts` | `import ingestSinceWatermark` | WIRED | Line 24: `import { ingestSinceWatermark, persistEmail } from './ingest'` |
| `service.ts` | `matcher/service.ts` | `import matchEmail` | WIRED | Line 21: `import { matchEmail } from '@/features/matcher/service'` |
| `service.ts` | `classifier/service.ts` | `import classifyEmail` | WIRED | Line 20: `import { classifyEmail } from '@/features/classifier/service'` |
| `act.ts` | `applications/service.ts` | `import applyAutoStatusChange` | WIRED | Line 25: `import { applyAutoStatusChange } from '@/features/applications/service'` |
| `act.ts` | `classifier/thresholds.ts` | `import meetsThreshold` | WIRED | Line 27: `import { meetsThreshold } from '@/features/classifier/thresholds'` |
| `act.ts` | `applications/status-transitions.ts` | `import isStatusRegression` | WIRED | Line 26: `import { isStatusRegression } from '@/features/applications/status-transitions'` |
| `instrumentation.ts` | `service.ts` | `import pollOnce` | WIRED | Line 25: `const { pollOnce } = await import('@/features/inbox/service')` |
| `settings/page.tsx` | `components/` | imports all 4 components | WIRED | Lines 6-9: imports ConnectGmailButton, DisconnectGmailButton, SyncNowButton, TokenHealthBanner |
| `sync-now-button.tsx` | `actions.ts` | `import syncNow` | WIRED | Line 5: `import { syncNow } from '@/features/inbox/actions'` |
| `disconnect-gmail-button.tsx` | `actions.ts` | `import disconnectGmail` | WIRED | Line 5: `import { disconnectGmail } from '@/features/inbox/actions'` |
| `actions.ts` | `service.ts` | `import pollOnce` | WIRED | Line 10: `import { pollOnce } from './service'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GMAIL-01 | 04-02 | OAuth flow + encrypted refresh token on User row | SATISFIED | `auth/route.ts`: OAuth redirect with correct params. `callback/route.ts`: `encryptToken(tokens.refresh_token)` stored on `gmailRefreshTokenEncrypted`. `gmail-oauth.test.ts`: 4 tests covering encrypt/decrypt round-trip |
| GMAIL-02 | 04-04 | `/settings` page with connection state + actions + token-health banner | SATISFIED | `settings/page.tsx`: Connected/Disconnected badge, 3 action buttons. `token-health-banner.tsx`: warns >=5 days, mentions 7-day Test-mode revocation |
| GMAIL-03 | 04-03 | Polling with history.list + messages.list fallback + persist | SATISFIED | `ingest.ts`: `ingestSinceWatermark` with `history.list` + `messages.list?q=newer_than:7d` fallback on 404. `persistEmail` idempotent via UNIQUE constraint. `inbox-pipeline.test.ts`: 3 persist tests |
| GMAIL-04 | 04-04 | node-cron in instrumentation.ts with 4 guards | SATISFIED | `instrumentation.ts`: NEXT_RUNTIME, NODE_ENV, globalThis, advisory lock guards. 15-min schedule. `inbox-pipeline.test.ts`: 2 guard logic tests |
| AUTO-01 | 04-03 | Auto-update with per-label threshold + not regression | SATISFIED | `act.ts`: `meetsThreshold` gate + `isStatusRegression` check. `applyAutoStatusChange` writes undoable Event. `act-stage.test.ts`: T1 (below threshold), T3 (regression), T7 (auto-update) |
| AUTO-02 | 04-03 | Route to review when below threshold or unmatched | SATISFIED | `act.ts`: routes to `needs_review` when `canAutoUpdate` is false. `act-stage.test.ts`: T1, T2, T5 verify review routing |
| AUTO-03 | 04-03 | First-50 emails bypass auto-update | SATISFIED | `act.ts` line 75: `emailCount < 50` check. `act-stage.test.ts`: T6 seeds <50 emails, verifies `needs_review` even at 0.99 confidence |
| AUTO-04 | 04-03 | Undo idempotency via reviewedByUser + per-email advisory lock | SATISFIED | `act.ts` line 110: `email?.reviewedByUser` check returns `skipped`. Line 63: `pg_try_advisory_lock`. `act-stage.test.ts`: T4 verifies skip when reviewedByUser=true |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck passes | `pnpm typecheck` | Exit 0, no errors | PASS |
| Lint passes | `pnpm lint` | Exit 0, no errors | PASS |
| Build passes | `pnpm build` | Exit 0, /settings route present | PASS |
| Tests pass | `pnpm test:run` | 23 files, 296 tests passed, 0 failures | PASS |
| ProcessingStatus enum in schema | `grep ProcessingStatus prisma/schema.prisma` | Found at line 96 with 6 values | PASS |
| gmailHistoryId in schema | `grep gmailHistoryId prisma/schema.prisma` | Found at line 116 | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | | | | |

No anti-patterns detected. No TODO/FIXME/PLACEHOLDER comments. No stub implementations. No console.log-only handlers. No hardcoded empty data flowing to user-visible output.

### Human Verification Required

### 1. Visual Settings Page Rendering

**Test:** Navigate to `/settings` in browser when Gmail is disconnected, then connected
**Expected:** Shows "Disconnected" badge with Connect Gmail button when not connected; shows "Connected" badge with Sync now + Disconnect buttons when connected
**Why human:** Visual layout verification requires rendering in a browser

### 2. OAuth Flow with Google

**Test:** Click "Connect Gmail", complete Google OAuth consent, verify redirect back to `/settings?gmail=connected`
**Expected:** Refresh token stored encrypted in DB; settings page shows "Connected" state
**Why human:** Requires real Google OAuth credentials and browser interaction

### 3. Cron Job Firing

**Test:** Start app with `pnpm dev`, wait 15+ minutes, check logs for `cron.pollOnce` entry
**Expected:** Cron fires every 15 minutes, calls pollOnce, logs results
**Why human:** Requires waiting for cron schedule; cannot verify programmatically without starting the server

### 4. Token-Health Banner Appearance

**Test:** Set `gmailLastSyncAt` to 6 days ago in DB, reload `/settings`
**Expected:** Amber banner appears with "Gmail sync is 6 days stale" and explanation of 7-day Test-mode revocation
**Why human:** Requires DB manipulation and visual verification

### Gaps Summary

No gaps found. All 5 roadmap success criteria are verified. All 8 requirement IDs (GMAIL-01 through GMAIL-04, AUTO-01 through AUTO-04) are satisfied with implementation evidence. All 15 artifacts exist, are substantive (no stubs), and are wired into the pipeline. All 14 key links verified as wired. Tests pass (296/296). Pre-commit gate passes (typecheck, lint, build, test:run).

---

_Verified: 2026-05-10T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
