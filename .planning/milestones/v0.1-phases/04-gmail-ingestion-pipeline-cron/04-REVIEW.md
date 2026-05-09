---
phase: 04-gmail-ingestion-pipeline-cron
reviewed: 2026-05-09T12:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - eslint.config.mjs
  - prisma/migrations/20260510120000_add_phase4_schema_changes/migration.sql
  - prisma/schema.prisma
  - src/app/api/gmail/auth/route.ts
  - src/app/api/gmail/callback/route.ts
  - src/app/settings/page.tsx
  - src/features/inbox/act.ts
  - src/features/inbox/actions.ts
  - src/features/inbox/components/connect-gmail-button.tsx
  - src/features/inbox/components/disconnect-gmail-button.tsx
  - src/features/inbox/components/sync-now-button.tsx
  - src/features/inbox/components/token-health-banner.tsx
  - src/features/inbox/gmail-client.ts
  - src/features/inbox/ingest.ts
  - src/features/inbox/schema.ts
  - src/features/inbox/service.test.ts
  - src/features/inbox/service.ts
  - src/instrumentation.ts
  - tests/integration/act-stage.test.ts
  - tests/integration/gmail-oauth.test.ts
  - tests/integration/inbox-pipeline.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-09T12:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The Gmail ingestion pipeline is well-structured following the four-stage design (ingest -> match -> classify -> act). The codebase demonstrates strong multi-tenant safety through `tenantDb`, `withRls`, and branded ID types. Error handling follows the `Result<T, AppError>` pattern consistently. However, the review found two critical security issues (OAuth CSRF gap and advisory lock collision risk) and four warnings related to test coverage, type misuse, and UX gaps in error feedback.

## Critical Issues

### CR-01: OAuth callback missing `state` parameter (CSRF)

**Files:** `src/app/api/gmail/auth/route.ts:14`, `src/app/api/gmail/callback/route.ts:15`

**Issue:** The OAuth authorization URL is generated without a `state` parameter, and the callback does not verify one. This is a standard CSRF vulnerability in OAuth flows. An attacker could craft a link that causes a victim to authorize the attacker's Gmail account. Per PRINCIPLES.md: "Middleware is not your auth boundary" -- but neither is trusting an unverified callback parameter.

**Fix:**
```typescript
// src/app/api/gmail/auth/route.ts
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET() {
  const userResult = await requireUser()
  if (userResult.isErr()) return new Response('Unauthorized', { status: 401 })

  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  const oauth2Client = createOAuth2Client()
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state,
  })

  logger.info({ op: 'gmail.auth.redirect', userId: userResult.value.id })
  redirect(url)
}

// src/app/api/gmail/callback/route.ts -- add state verification
const stateParam = request.nextUrl.searchParams.get('state')
const cookieStore = await cookies()
const expectedState = cookieStore.get('gmail_oauth_state')?.value

if (!stateParam || stateParam !== expectedState) {
  return new Response('Invalid OAuth state', { status: 403 })
}

cookieStore.delete('gmail_oauth_state')
```

---

### CR-02: Advisory lock collision risk in act stage

**File:** `src/features/inbox/act.ts:63`

**Issue:** `hashtext('act:${emailId}')` returns a 32-bit integer. By the birthday problem, at ~77,000 emails there is a 50% chance of two emails hashing to the same value. When a collision occurs, the second email's advisory lock attempt returns `locked: false` and the email is silently skipped (`action: 'skipped'`), with no retry or error surfaced. For a growing job-hunt tracker this is not theoretical -- a user with 100 applications and 20 emails each reaches 2,000 emails quickly.

**Fix:** Use `pg_try_advisory_xact_lock(int4, int4)` with two arguments derived from userId and emailId. This reduces collision space to essentially zero and scopes the lock to the transaction:
```typescript
// src/features/inbox/act.ts:62-67
const lockResult = await prisma.$queryRaw<{ locked: boolean }[]>`
  SELECT pg_try_advisory_xact_lock(
    hashtext(${`user:${userId}`}),
    hashtext(${`email:${emailId}`})
  ) AS locked`
if (!lockResult[0]?.locked) {
  log.debug('advisory lock held by another process -- skipping')
  return ok({ action: 'skipped', emailId })
}
```
Also remove the explicit `pg_advisory_unlock` in the `finally` block since `pg_try_advisory_xact_lock` auto-releases at transaction end.

---

## Warnings

### WR-01: `service.test.ts` tests `gmail-client.ts`, not `service.ts`

**File:** `src/features/inbox/service.test.ts`

**Issue:** The file is named `service.test.ts` but contains unit tests for `extractEmailMetadata` from `gmail-client.ts`. Per project conventions (`service.ts -> service.test.ts`), this name implies tests for `pollOnce`. The actual orchestrator (`service.ts`) has zero test coverage -- neither unit nor integration. The `pollOnce` function is the most complex code in the slice (4-stage pipeline with error handling and watermark updates) and is the most likely to regress.

**Fix:** Rename the file to `gmail-client.test.ts` to match the source file. Add integration tests for `pollOnce` that exercise the full pipeline against Testcontainers Postgres with a mocked Gmail API (via `msw` per PRINCIPLES.md mocking philosophy).

---

### WR-02: `parsedEmailSchema` defined but never used for validation

**File:** `src/features/inbox/schema.ts`

**Issue:** The schema defines `ParsedEmailInput` with `z.infer<typeof parsedEmailSchema>` but the actual pipeline uses `ParsedEmail` from `gmail-client.ts` (identical shape, separate type). The schema is never imported for runtime `safeParse` anywhere in the ingestion pipeline. Per PRINCIPLES.md: "Zod at every boundary -- every input from outside the trust boundary goes through safeParse before use." The Gmail API response is an external boundary.

**Fix:** Either (a) validate `extractEmailMetadata` output against `parsedEmailSchema.safeParse()` before persisting, or (b) remove the unused schema and use `ParsedEmail` as the single source of truth. Option (a) is preferred since it enforces the 500-char body excerpt limit at the boundary.

---

### WR-03: `disconnectGmail` / `syncNow` discard server action results

**Files:** `src/features/inbox/components/disconnect-gmail-button.tsx:11`, `src/features/inbox/components/sync-now-button.tsx:12`

**Issue:** Both buttons fire server actions via `startTransition(() => { void syncNow() })` / `void disconnectGmail()`, discarding the `{ ok, error }` return value. If the action fails, the user sees the button return to its normal state with no indication that anything went wrong. The user may believe disconnect/sync succeeded when it did not.

**Fix:** Read the action result and surface errors. Minimal approach using `useState`:
```tsx
const [error, setError] = useState<string | null>(null)

onClick={() => {
  startTransition(async () => {
    const result = await syncNow()
    if (!result.ok) setError(result.error ?? 'Sync failed')
    else setError(null)
  })
}}

// In JSX:
{error && <p className="text-sm text-red-600">{error}</p>}
```

---

### WR-04: No timeout guard on `pollOnce` in cron

**File:** `src/instrumentation.ts:18-42`

**Issue:** If `pollOnce` hangs (e.g., Gmail API timeout, slow LLM classification), the cron tick blocks indefinitely. The advisory lock remains held, so subsequent ticks silently skip. There is no timeout to fail fast and release the lock for retry.

**Fix:** Wrap the `pollOnce` call in `Promise.race` with a timeout:
```typescript
const TIMEOUT_MS = 4 * 60 * 1000 // 4 minutes (under 5-min cron interval)
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('pollOnce timed out')), TIMEOUT_MS),
)

try {
  const result = await Promise.race([pollOnce(userId), timeoutPromise])
  // ...
} catch (error) {
  logger.error({ err: error, op: 'cron.pollOnce' }, 'cron tick failed or timed out')
}
```

---

## Info

### IN-01: Unused logger import in ingest.ts

**File:** `src/features/inbox/ingest.ts:19`

**Issue:** `logger` is imported but only used in the `catch` block for history expiry. There is no logging for the happy path (message count, new watermark). This makes debugging ingestion issues harder since the orchestrator logs message count but not the watermark transition.

**Fix:** Add a log line in `ingestSinceWatermark` when returning results, or remove the import if only the catch path is needed (the catch already logs via `logger.warn`).

---

### IN-02: Non-null assertions on Gmail API fields

**Files:** `src/features/inbox/ingest.ts:86`, `src/features/inbox/gmail-client.ts:88-89`

**Issue:** `m.id!`, `m.threadId!`, `msg.id!`, `msg.threadId!` use non-null assertions. The Gmail API contract guarantees these fields on valid messages, but a malformed or partial response (e.g., from a deleted message) could cause a runtime crash. The assertions are defensible given the API contract but worth documenting.

**Fix:** No code change needed if the Gmail API contract is trusted. Optionally add a defensive check in `extractEmailMetadata`:
```typescript
if (!msg.id || !msg.threadId) {
  throw new Error(`Malformed Gmail message: missing id or threadId`)
}
```

---

### IN-03: Cron guard tests test conditionals, not behavior

**File:** `tests/integration/inbox-pipeline.test.ts:122-141`

**Issue:** T4 and T5 test that `process.env.NEXT_RUNTIME !== 'nodejs'` and `process.env.NODE_ENV === 'test'` evaluate to `true` -- these are tautological. They do not test that the cron `register()` function actually skips when these conditions hold.

**Fix:** Either mock the cron module and verify `schedule` was not called, or accept these as documentation-only tests and rename the `describe` to `'Cron guard conditions (documentation only)'` to set expectations.

---

_Reviewed: 2026-05-09T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
