# Phase 4: Gmail Ingestion + Pipeline + Cron - Research

**Researched:** 2026-05-09
**Domain:** Gmail OAuth, Gmail API (history.list, messages.list), four-stage email pipeline orchestration, node-cron scheduling, Postgres advisory locks
**Confidence:** HIGH

## Summary

Phase 4 is the only legitimate cross-slice composition in the Lean milestone. The `inbox/` slice orchestrates the four-stage pipeline (`ingest -> match -> classify -> act`) by importing `matcher/service.ts` and `classifier/service.ts` -- the one allowed dependency-cruiser exception already configured in `.dependency-cruiser.cjs` (line 27).

The phase builds on substantial existing infrastructure: Phase 1 provides `withRls`, encryption, env validation; Phase 2 provides `applyAutoStatusChange` and `undoStatusChange` with status-regression guard; Phase 3 provides `classifyEmail` and `matchEmail`. The `googleapis` (v171.4.0), `google-auth-library` (v10.6.2), and `node-cron` (v4.2.1) packages are already installed.

The critical gap is the `processing_status` column on the `Email` model -- PRINCIPLES.md describes the state machine (`received -> matched -> classified -> acted | needs_review | failed`) but `prisma/schema.prisma` does not have this column. A migration is required before the pipeline can track per-email stage progress.

**Primary recommendation:** Build the pipeline as a single `pollOnce(userId)` orchestrator in `src/features/inbox/service.ts` that composes the existing matcher and classifier services, then wire it into `src/instrumentation.ts` via node-cron with the four guards (NEXT_RUNTIME, globalThis, advisory lock, NODE_ENV).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
All implementation choices are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GMAIL-01 | Google OAuth flow at /api/gmail/auth + /api/gmail/callback; refresh token stored AES-256-GCM encrypted | OAuth2Client from google-auth-library; encryptToken/decryptToken from core/crypto/encryption.ts |
| GMAIL-02 | /settings page shows connection state + Connect/Disconnect/Sync-now + token-health banner | User model has gmailRefreshTokenEncrypted + gmailLastSyncAt; settings page does not exist yet |
| GMAIL-03 | pollOnce fetches threads since watermark; falls back to messages.list on 404; stores <=500 char bodyExcerpt | Gmail API history.list + messages.list; Email model needs processing_status column |
| GMAIL-04 | node-cron in instrumentation.ts with 4 guards | node-cron v4.2.1 installed; @types/node-cron v3.0.11 installed; Next.js instrumentation hook native in v16 |
| AUTO-01 | Auto-update when confidence >= threshold AND matched AND not regression | applyAutoStatusChange already built in applications/service.ts; isStatusRegression already built; meetsThreshold in classifier/thresholds.ts |
| AUTO-02 | Low-confidence/unmatched/regression -> needs_review for /inbox | Email.processing_status = 'needs_review' routes to Phase 5 review queue |
| AUTO-03 | First 50 emails after Gmail connect bypass auto-update | Counter on User row or query count of emails since gmailLastSyncAt |
| AUTO-04 | Undo writes email.reviewedByUser=true; pg_try_advisory_lock per email for act serialization | undoStatusChange already writes reviewedByUser=true (applications/service.ts:286) |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | 171.4.0 | Gmail API client (history.list, messages.list, messages.get) | Official Google SDK; auto-generated types; handles pagination |
| google-auth-library | 10.6.2 | OAuth2 client (generateAuthUrl, getToken, refreshAccessToken) | Official Google auth SDK; handles token refresh, credential management |
| node-cron | 4.2.1 | In-process cron scheduling (15-min polling) | Lightweight; no external process; PRINCIPLES.md recommended |
| @types/node-cron | 3.0.11 | TypeScript types for node-cron | Type safety for schedule() and ScheduledTask |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| neverthrow | 8.2.0 | Result<T, AppError> for pipeline error handling | Every service function |
| zod | 4.4.3 | Input validation at boundaries | OAuth callback params, email parsing |

### No new dependencies needed
All required packages are already in `package.json`. Phase 4 adds zero new dependencies.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/inbox/
│   ├── service.ts              # pollOnce orchestrator (the 4-stage pipeline)
│   ├── gmail-client.ts         # OAuth2 setup + Gmail API wrapper (thin)
│   ├── ingest.ts               # Stage 1: ingestSinceWatermark + fallback
│   ├── act.ts                  # Stage 4: auto-update or route to review
│   ├── schema.ts               # Zod schemas for Gmail-related inputs
│   └── service.test.ts         # Integration tests for pipeline
├── app/
│   ├── api/gmail/
│   │   ├── auth/route.ts       # GET /api/gmail/auth -- redirect to Google consent
│   │   └── callback/route.ts   # GET /api/gmail/callback -- exchange code for token
│   └── settings/
│       └── page.tsx            # Settings page (Connect/Disconnect/Sync-now + banner)
└── instrumentation.ts          # node-cron registration with 4 guards
```

### Pattern 1: OAuth2 Flow with google-auth-library

**What:** Two Route Handlers implement the OAuth2 authorization code flow. `/api/gmail/auth` generates the consent URL and redirects. `/api/gmail/callback` exchanges the code for tokens, encrypts the refresh token, and stores it on the User row.

**When to use:** Always for Gmail connection. The access token is never stored -- only the refresh token. Access tokens are fetched per-batch via `oauth2Client.refreshAccessToken()`.

**Example:**
```typescript
// src/features/inbox/gmail-client.ts
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { env } from '@/core/env'

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  )
}

// In /api/gmail/auth route handler:
const oauth2Client = createOAuth2Client()
const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',        // required for refresh_token
  prompt: 'consent',             // force consent to get refresh_token every time
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
})
redirect(url)

// In /api/gmail/callback route handler:
const { tokens } = await oauth2Client.getToken(code)
// tokens.refresh_token is only present on first consent or when prompt='consent'
const encrypted = encryptToken(tokens.refresh_token!)
// Store encrypted on User.gmailRefreshTokenEncrypted
```

**Source:** [google-auth-library OAuth2Client docs](https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/oauth2client.ts); verified against installed v10.6.2 types at `node_modules/google-auth-library/build/src/auth/oauth2client.d.ts:414`.

### Pattern 2: Gmail API -- history.list with messages.list Fallback

**What:** The ingest stage uses `gmail.users.history.list` with `startHistoryId` for incremental sync. When Gmail returns 404 (history expired, >7 days), fall back to `gmail.users.messages.list` with `q: 'newer_than:7d'`.

**When to use:** Every poll cycle. The watermark (`User.gmailLastSyncAt` stores the historyId) enables efficient incremental fetches.

**Example:**
```typescript
// src/features/inbox/ingest.ts
import { google } from 'googleapis'

async function ingestSinceWatermark(
  gmail: gmail_v1.Gmail,
  startHistoryId: string | null,
): Promise<{ messages: gmail_v1.Schema$Message[]; newHistoryId: string }> {
  if (!startHistoryId) {
    // First sync -- no watermark yet
    return fallbackToMessagesList(gmail)
  }

  try {
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
    })
    const messages = (res.data.history ?? [])
      .flatMap(h => h.messages ?? [])
    // Dedupe on id (PITFALLS.md: messagesAdded is unreliable)
    const unique = dedupeById(messages)
    return {
      messages: unique,
      newHistoryId: res.data.historyId ?? startHistoryId,
    }
  } catch (err: unknown) {
    if (isGmail404(err)) {
      return fallbackToMessagesList(gmail)
    }
    throw err
  }
}

async function fallbackToMessagesList(
  gmail: gmail_v1.Gmail,
): Promise<{ messages: gmail_v1.Schema$Message[]; newHistoryId: string }> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'newer_than:7d',
    maxResults: 100,
  })
  // After full sync, update watermark from current history
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return {
    messages: res.data.messages ?? [],
    newHistoryId: profile.data.historyId ?? '',
  }
}
```

**Source:** [Gmail API history.list reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/history/list); [PITFALLS.md Integration Gotchas table]; verified against installed types at `node_modules/googleapis/build/src/apis/gmail/v1.d.ts:544`.

### Pattern 3: Extracting Email Metadata from Gmail Message

**What:** Parse the Gmail `Message` object to extract `from`, `fromDomain`, `subject`, `bodyExcerpt` (<=500 chars), `gmailMessageId`, `gmailThreadId`, `receivedAt`.

**When to use:** After fetching each message via `messages.get` with `format: 'metadata'` or `format: 'full'`.

**Example:**
```typescript
function extractEmailMetadata(msg: gmail_v1.Schema$Message): ParsedEmail {
  const headers = msg.payload?.headers ?? []
  const from = findHeader(headers, 'From') ?? ''
  const subject = findHeader(headers, 'Subject') ?? ''
  const fromDomain = extractDomain(from) // parse "Name <email@domain>" -> "domain"
  const bodyExcerpt = extractPlainTextBody(msg.payload).slice(0, 500)
  const receivedAt = new Date(Number(msg.internalDate))

  return {
    gmailMessageId: msg.id!,
    gmailThreadId: msg.threadId!,
    from,
    fromDomain,
    subject,
    bodyExcerpt,
    receivedAt,
  }
}

function extractPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8')
  }
  // Recurse into multipart
  for (const child of part.parts ?? []) {
    const body = extractPlainTextBody(child)
    if (body) return body
  }
  return ''
}
```

**Source:** [Gmail API Message schema](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages#Message); verified against installed types at `node_modules/googleapis/build/src/apis/gmail/v1.d.ts:610`.

### Pattern 4: Four-Stage Pipeline Orchestrator (pollOnce)

**What:** `pollOnce(userId)` is the single entry point that runs all four stages per email. Each email is processed independently; failures are logged and never abort the batch.

**When to use:** Called by the cron job and by the "Sync now" button in /settings.

```typescript
// src/features/inbox/service.ts
export async function pollOnce(userId: UserId): Promise<Result<PollSummary, AppError>> {
  const gmail = await getGmailClient(userId) // decrypt refresh token, create OAuth2, set credentials
  const user = await tenantDb(userId).user.findUnique({ where: { id: Number(userId) } })

  // Stage 1: Ingest
  const { messages, newHistoryId } = await ingestSinceWatermark(gmail, user?.gmailHistoryId)

  let processed = 0, autoUpdated = 0, needsReview = 0, failed = 0

  for (const msgRef of messages) {
    try {
      // Fetch full message (needed for body + headers)
      const full = await gmail.users.messages.get({ userId: 'me', id: msgRef.id!, format: 'full' })
      const parsed = extractEmailMetadata(full.data)

      // Idempotency: skip if already ingested
      const existing = await tenantDb(userId).email.findUnique({
        where: { gmailMessageId: parsed.gmailMessageId }
      })
      if (existing) { processed++; continue }

      // Stage 2: Match
      const matchResult = await matchEmail({ userId: String(userId), gmailThreadId: parsed.gmailThreadId, fromDomain: parsed.fromDomain })
      if (matchResult.isErr()) { failed++; continue }

      // Stage 3: Classify
      const classifyResult = await classifyEmail({ subject: parsed.subject, bodyExcerpt: parsed.bodyExcerpt })
      if (classifyResult.isErr()) { failed++; continue }

      // Stage 4: Act (inside a transaction)
      await actOnEmail(userId, parsed, matchResult.value, classifyResult.value)
      processed++
    } catch (err) {
      logger.error({ op: 'inbox.pollOnce.email', messageId: msgRef.id, err })
      failed++
    }
  }

  // Update watermark
  await tenantDb(userId).user.update({ where: { id: Number(userId) }, data: { gmailLastSyncAt: new Date() } })

  return ok({ processed, autoUpdated, needsReview, failed })
}
```

**Source:** PRINCIPLES.md "Email pipeline -- 4 idempotent stages"; ROADMAP.md Phase 4 success criteria.

### Pattern 5: Act Stage with First-50 Grace + Regression Block + Advisory Lock

**What:** The act stage decides whether to auto-update or route to review. Three gates must pass: (1) confidence >= per-label threshold, (2) application matched, (3) not a status regression. Plus the first-50 grace period.

```typescript
// src/features/inbox/act.ts
export async function actOnEmail(
  userId: UserId,
  parsed: ParsedEmail,
  match: MatchEmailOutput,
  classification: ClassifyEmailOutput,
): Promise<Result<void, AppError>> {
  // Per-email advisory lock for race prevention (AUTO-04)
  const emailId = parsed.gmailMessageId
  const lockResult = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${`act:${emailId}`})) AS locked`
  if (!lockResult[0]?.locked) return ok(undefined) // another process is handling this

  try {
    // First-50 grace (AUTO-03)
    const emailCount = await tenantDb(userId).email.count()
    const isFirst50 = emailCount < 50

    // Check all gates
    const canAutoUpdate =
      !isFirst50 &&
      match.applicationId !== null &&
      meetsThreshold(classification.label, classification.confidence)

    if (canAutoUpdate && match.applicationId) {
      // Map classification label to canonical status
      const newStatus = labelToStatus(classification.label)
      if (newStatus) {
        const result = await applyAutoStatusChange(userId, match.applicationId, {
          newStatus,
          source: 'cron',
          emailId: /* inserted email id */,
          classifierConfidence: classification.confidence,
          classifiedBy: classification.classifiedBy,
        })
        if (result.isErr()) {
          // Status regression or conflict -> route to review
          // ... store as needs_review
        }
      }
    } else {
      // Route to review queue
      // ... store as needs_review
    }
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${`act:${emailId}`}))`
  }
}
```

**Source:** ADR-0012 (status-regression block); PITFALLS.md sections 4, 8; classifier/thresholds.ts `meetsThreshold`.

### Pattern 6: node-cron in instrumentation.ts with Four Guards

**What:** Register a 15-minute cron job in `src/instrumentation.ts` with four safety guards.

```typescript
// src/instrumentation.ts
import { prisma } from '@/core/db/client'

const g = globalThis as unknown as { __forayCron?: { stop: () => void } }

export async function register() {
  // Guard 1: Skip on Edge runtime (node-cron requires Node.js)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Guard 2: Skip in test environment
  if (process.env.NODE_ENV === 'test') return

  const cron = await import('node-cron')

  // Guard 3: Stop previous cron on hot reload
  g.__forayCron?.stop()

  g.__forayCron = cron.schedule('*/15 * * * *', async () => {
    // Guard 4: Advisory lock prevents overlap
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext('poll-gmail')) AS locked`
    if (!locked) return

    try {
      const { pollOnce } = await import('@/features/inbox/service')
      const userId = /* get sole user id */
      await pollOnce(userId)
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('poll-gmail'))`
    }
  })
}
```

**Source:** PRINCIPLES.md "Background jobs v1"; PITFALLS.md section 3; Next.js instrumentation docs.

### Anti-Patterns to Avoid

- **Storing access_token:** Only store the refresh token (encrypted). Fetch access_token per-batch via `oauth2Client.refreshAccessToken()`. [PITFALLS.md Integration Gotchas]
- **Calling messages.get in a tight loop:** Use `batchGet` or process in `Promise.all` chunks of 5. Respect 250 quota-units/user/sec. [PITFALLS.md Performance Traps]
- **Trusting history.list messagesAdded:** Iterate the broader `messages` array and dedupe on `gmail_message_id`. [PRINCIPLES.md "Stage 1: ingest"]
- **Single CLASSIFIER_AUTO_THRESHOLD env var:** Use the per-label `THRESHOLDS` map from `classifier/thresholds.ts`. [ADR-0012]
- **Not checking reviewedByUser before act:** The act stage MUST check `email.reviewedByUser` to prevent re-acting after undo. [PITFALLS.md section 8]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 flow | Custom HTTP calls to Google | `google-auth-library` OAuth2Client | Handles token refresh, credential management, PKCE |
| Gmail API calls | Raw fetch to Gmail REST | `googleapis` gmail client | Auto-generated types, pagination, retry, quota handling |
| Cron scheduling | setInterval or custom scheduler | `node-cron` | Standard cron expressions, timezone support, clean stop/start |
| Advisory locks | Application-level mutex | `pg_try_advisory_lock` | Process-safe, connection-pool-safe, zero infra |
| Encryption | Custom AES implementation | `core/crypto/encryption.ts` | Already built with AES-256-GCM, per-row IV, authenticated encryption |

## Common Pitfalls

### Pitfall 1: Test-mode OAuth refresh token silently dies after 7 days
**What goes wrong:** Google revokes refresh tokens after 7 days when OAuth consent screen is in Testing mode. Polling silently stops.
**Why it happens:** Google's policy for test-mode OAuth apps.
**How to avoid:** Surface token health in /settings (warn when >5 days since last successful sync). Document the 7-day clock. Consider flipping to "In production" with single-user audience.
**Warning signs:** `User.gmailLastSyncAt` stops advancing; Gmail API returns `invalid_grant`.
**Source:** [PITFALLS.md section 1]; [Google Cloud docs on test-mode token expiry]

### Pitfall 2: node-cron double-fires under hot reload
**What goes wrong:** Every file save in dev re-runs `register()`, accumulating duplicate cron jobs.
**Why it happens:** Next.js dev server keeps the parent Node process alive; `cron.schedule` adds tasks without destroying previous ones.
**How to avoid:** `globalThis.__forayCron?.stop()` before each `cron.schedule`. Plus `NODE_ENV !== 'test'` guard.
**Warning signs:** Duplicate log lines for the same sync operation.
**Source:** [PITFALLS.md section 3]

### Pitfall 3: Auto-update + undo race when cron re-acts
**What goes wrong:** User undoes a status change; next cron tick re-applies it because the act stage doesn't check `reviewedByUser`.
**Why it happens:** The act stage's idempotency relies on `email.reviewedByUser` being set by undo.
**How to avoid:** The act stage MUST check `reviewedByUser` before acting. Plus `pg_try_advisory_lock(hashtext('act:'||emailId))` for serialization.
**Warning signs:** Status changes reappear after undo within 15 minutes.
**Source:** [PITFALLS.md section 8]; [ADR-0012]

### Pitfall 4: processing_status column missing from Email model
**What goes wrong:** PRINCIPLES.md describes the state machine but `schema.prisma` doesn't have the column. Pipeline can't track per-email stage progress.
**Why it happened:** The column was designed in research but not added during Phase 1-3 schema work.
**How to avoid:** Add a `ProcessingStatus` enum and `processing_status` column to Email model via migration before building the pipeline.
**Warning signs:** No way to distinguish "ingested but not matched" from "matched but not classified."
**Source:** PRINCIPLES.md "Email pipeline -- 4 idempotent stages"; `prisma/schema.prisma` (verified: column absent)

### Pitfall 5: Gmail history.list returns 404 on expired watermarks
**What goes wrong:** If the app hasn't polled in >7 days, the history ID is expired and Gmail returns 404.
**Why it happens:** Gmail history records expire after ~7 days.
**How to avoid:** Catch 404, fall back to `messages.list?q=newer_than:7d`, reset the watermark.
**Source:** [Gmail API history.list docs]; [PRINCIPLES.md "Stage 1: ingest"]

## Code Examples

### Creating an OAuth2 Client and Generating Auth URL
```typescript
// Source: google-auth-library v10.6.2 types at node_modules/google-auth-library/build/src/auth/oauth2client.d.ts:459
import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI,
)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
})
```

### Exchanging Code for Tokens
```typescript
// Source: google-auth-library v10.6.2 types at node_modules/google-auth-library/build/src/auth/oauth2client.d.ts:475
const { tokens } = await oauth2Client.getToken(code)
// tokens.access_token -- short-lived, do NOT store
// tokens.refresh_token -- long-lived, encrypt and store
// tokens.expiry_date -- epoch ms when access_token expires
```

### Using the Gmail Client with Stored Refresh Token
```typescript
// Source: googleapis v171.4.0 types at node_modules/googleapis/build/src/apis/gmail/v1.d.ts:68
import { google } from 'googleapis'

const oauth2Client = createOAuth2Client()
oauth2Client.setCredentials({ refresh_token: decryptedRefreshToken })
const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

// History list (incremental)
const history = await gmail.users.history.list({
  userId: 'me',
  startHistoryId: lastHistoryId,
  historyTypes: ['messageAdded'],
})

// Messages list (fallback)
const messages = await gmail.users.messages.list({
  userId: 'me',
  q: 'newer_than:7d',
  maxResults: 100,
})

// Message get (full content)
const msg = await gmail.users.messages.get({
  userId: 'me',
  id: messageId,
  format: 'full',
})
```

### Extracting Plain Text Body from MIME Structure
```typescript
// Source: Gmail API MessagePart at node_modules/googleapis/build/src/apis/gmail/v1.d.ts:655
function extractPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8')
  }
  for (const child of part.parts ?? []) {
    const found = extractPlainTextBody(child)
    if (found) return found
  }
  return ''
}
```

### node-cron Schedule with ScheduledTask
```typescript
// Source: @types/node-cron at node_modules/@types/node-cron/index.d.ts
import { schedule, type ScheduledTask } from 'node-cron'

const task: ScheduledTask = schedule('*/15 * * * *', async (now) => {
  // ... poll logic
}, { scheduled: true })

task.stop()  // clean shutdown
task.start() // restart
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@prisma/client` imports | `@/generated/prisma/client` | Prisma 7 | All Prisma imports must use the new path |
| Single CLASSIFIER_AUTO_THRESHOLD | Per-label THRESHOLDS map | Phase 3 / ADR-0012 | Phase 4 reads THRESHOLDS directly |
| Prisma client extension for RLS | `withRls(userId, tx => ...)` helper | Phase 1 / ADR-0011 | All multi-statement ops use withRls |
| `requireUser()` throws | `requireUser()` returns `Result` | Phase 1 | Route handlers check result.isOk() |

**Deprecated/outdated:**
- Single `CLASSIFIER_AUTO_THRESHOLD` env var: still exists in env.ts for backward compat but per-label gates in `classifier/thresholds.ts` are the real gate
- `experimental.instrumentationHook` in next.config.ts: no longer needed in Next.js 15+; `src/instrumentation.ts` is natively supported

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `processing_status` column needs to be added to Email model via migration | Pitfall 4 | Pipeline cannot track per-email stage progress without it |
| A2 | `gmailHistoryId` field should be added to User model (separate from `gmailLastSyncAt`) | Pattern 2 | Without it, the watermark for history.list has no storage location |
| A3 | The sole user's ID can be determined by querying `User.findFirst()` in the cron handler | Pattern 6 | If multiple users exist, cron needs to iterate all users |
| A4 | `gmail.readonly` scope is sufficient (not `gmail.modify`) | Pattern 1 | If write operations are needed later, scope must be expanded |
| A5 | `prompt: 'consent'` ensures refresh_token is returned every time | Pattern 1 | Without it, Google may not return refresh_token on subsequent consents |

## Open Questions

1. **Where to store the Gmail historyId watermark?**
   - What we know: `User.gmailLastSyncAt` exists (DateTime?) but there's no `gmailHistoryId` field
   - What's unclear: Should we add a separate `gmailHistoryId` field to User, or encode it in `gmailLastSyncAt`?
   - Recommendation: Add a separate `String?` field `gmailHistoryId` to User model. `gmailLastSyncAt` tracks *when* the last sync happened (for the 5-day health banner); `gmailHistoryId` tracks *where* in Gmail's history to resume. They serve different purposes.

2. **How to determine the sole user's ID for the cron handler?**
   - What we know: This is a single-user app. The cron runs in-process.
   - What's unclear: Should we hardcode a user ID, query for the first user, or pass it via env?
   - Recommendation: Query `User.findFirst()` inside the cron handler. It's a single-row query, runs once per 15 minutes, and avoids hardcoding.

3. **Should the settings page be a Server Component or Client Component?**
   - What we know: /settings needs Connect/Disconnect/Sync-now buttons (interactive)
   - What's unclear: How much is server-rendered vs client-interactive
   - Recommendation: Server Component page with client-interactive button components (children-slot pattern per PRINCIPLES.md). Token-health banner is server-rendered.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| googleapis | Gmail API client | Yes | 171.4.0 | -- |
| google-auth-library | OAuth2 flow | Yes | 10.6.2 | -- |
| node-cron | Cron scheduling | Yes | 4.2.1 | -- |
| @types/node-cron | TypeScript types | Yes | 3.0.11 | -- |
| Postgres (pg_try_advisory_lock) | Overlap prevention | Yes (Docker) | -- | -- |
| ENCRYPTION_KEY env var | Token encryption | Configured in .env.example | -- | -- |
| GOOGLE_CLIENT_ID env var | OAuth flow | Optional in env.ts | -- | Must be configured before OAuth works |
| GOOGLE_CLIENT_SECRET env var | OAuth flow | Optional in env.ts | -- | Must be configured before OAuth works |

**Missing dependencies with no fallback:** None -- all required packages are installed.

**Missing dependencies with fallback:**
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional in env.ts (won't crash at startup) but must be configured before the OAuth flow works. The .env.example documents where to get them.

## Validation Architecture

> nyquist_validation is false in config.json, but this section documents the test strategy for the planner anyway.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | vitest.config.ts (root) |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GMAIL-01 | OAuth flow stores encrypted refresh token | integration | `pnpm test:run -- --testPathPattern inbox/oauth` | Wave 0 |
| GMAIL-02 | Settings page shows connection state | component | `pnpm test:run -- --testPathPattern settings` | Wave 0 |
| GMAIL-03 | pollOnce orchestrates 4 stages end-to-end | integration | `pnpm test:run -- --testPathPattern inbox/service` | Wave 0 |
| GMAIL-04 | instrumentation.ts registers cron with guards | unit | `pnpm test:run -- --testPathPattern instrumentation` | Wave 0 |
| AUTO-01 | Auto-update fires when all gates pass | integration | `pnpm test:run -- --testPathPattern inbox/act` | Wave 0 |
| AUTO-02 | Low-confidence routes to needs_review | integration | `pnpm test:run -- --testPathPattern inbox/act` | Wave 0 |
| AUTO-03 | First-50 emails bypass auto-update | integration | `pnpm test:run -- --testPathPattern inbox/act` | Wave 0 |
| AUTO-04 | Undo writes reviewedByUser; advisory lock serializes | integration | `pnpm test:run -- --testPathPattern inbox/act` | Wave 0 |

### Wave 0 Gaps
- [ ] `processing_status` column + `ProcessingStatus` enum migration
- [ ] `gmailHistoryId` field on User model migration
- [ ] `src/features/inbox/` service files (service.ts, ingest.ts, act.ts, gmail-client.ts, schema.ts)
- [ ] `src/app/api/gmail/auth/route.ts` and `src/app/api/gmail/callback/route.ts`
- [ ] `src/app/settings/page.tsx`
- [ ] `src/instrumentation.ts`
- [ ] Test files for inbox service, act stage, OAuth flow

## Sources

### Primary (HIGH confidence)
- googleapis v171.4.0 types at `node_modules/googleapis/build/src/apis/gmail/v1.d.ts` -- Message, MessagePart, History, ListMessagesResponse schemas verified
- google-auth-library v10.6.2 types at `node_modules/google-auth-library/build/src/auth/oauth2client.d.ts` -- OAuth2Client.generateAuthUrl, getToken, setCredentials verified
- @types/node-cron v3.0.11 at `node_modules/@types/node-cron/index.d.ts` -- schedule, ScheduledTask, stop/start verified
- `prisma/schema.prisma` -- Email model verified (processing_status column absent)
- PRINCIPLES.md "Email pipeline -- 4 idempotent stages" -- state machine design
- PRINCIPLES.md "Background jobs v1" -- instrumentation.ts pattern with advisory lock

### Secondary (MEDIUM confidence)
- [Gmail API history.list reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/history/list) -- 404 on expired history, startHistoryId behavior
- [Gmail API messages.list reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list) -- q parameter, pagination
- [Google Cloud OAuth2 docs](https://developers.google.com/identity/protocols/oauth2) -- test-mode 7-day token expiry
- [Next.js instrumentation docs](https://nextjs.org/docs/app/guides/instrumentation) -- NEXT_RUNTIME guard, register() behavior

### Tertiary (LOW confidence)
- [PITFALLS.md](../.planning/research/PITFALLS.md) -- all 12 pitfalls verified against codebase; specific Gmail API edge cases (history expiry, batchGet quota) based on community reports + official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, types verified
- Architecture: HIGH -- patterns align with PRINCIPLES.md, existing codebase conventions, and dependency-cruiser rules
- Pitfalls: HIGH -- sourced from PITFALLS.md (which cites official docs) and verified against codebase

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days -- Gmail API and googleapis are stable; node-cron is mature)
