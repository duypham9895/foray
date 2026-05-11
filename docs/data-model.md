# Data Model — `foray`

Schema explanation. Read this alongside [`prisma/schema.prisma`](../prisma/schema.prisma).

## Entity overview

```
┌──────────┐       owns
│   User   │──────────────┐
└──────────┘              │
                          ▼
┌──────────┐ has   ┌─────────────┐ to ┌──────────┐
│  Company │◄──────│ Application │───►│ Recruiter│
└──────────┘       └─────┬───────┘    └──────────┘
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
  ┌─────────┐       ┌─────────┐       ┌──────────┐
  │  Stage  │       │  Event  │       │ Document │
  └─────────┘       └─────────┘       └──────────┘
                          ▲
                          │
                    ┌─────────┐
                    │  Email  │
                    └─────────┘
```

## Entities

### `User`
The owner of the data. Single user for now (Duy). `userId` exists on every other table for future multi-tenant flip.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `email` | String | unique |
| `name` | String? | |
| `gmailRefreshTokenEncrypted` | String? | AES-256-GCM, key in `ENCRYPTION_KEY` env |
| `gmailLastSyncAt` | DateTime? | last successful Gmail poll |
| `gmailHistoryId` | String? | Gmail history watermark for incremental polling |
| `calendarRefreshTokenEncrypted` | String? | AES-256-GCM Google Calendar refresh token, separate from Gmail |
| `calendarLastSyncAt` | DateTime? | last successful Google Calendar sync |
| `extensionApiTokenHash` | String? | hashed bearer token for the Chrome extension capture API |
| `classifierLlmProvider` | Enum | `anthropic` or `openai`; per-user provider for low-confidence classifier fallback |
| `createdAt` / `updatedAt` | DateTime | |

### `Company`
A company you've applied to (or are watching). Reused across multiple `Application` if you apply to multiple roles at the same place.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `userId` | Int | FK |
| `name` | String | "Stripe", "Acme Inc" |
| `domain` | String? | "stripe.com" — used by matcher to attribute incoming emails |
| `website` | String? | |
| `industry` | String? | "Fintech", "Logistics" |
| `size` | String? | "1-10", "11-50", "51-200", "201-1k", "1k+" |
| `notes` | String? | free-form |
| `createdAt` / `updatedAt` | DateTime | |

### `Application` ⭐ central entity
A single foray — one application to one role at one company.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `userId` | Int | FK |
| `companyId` | Int | FK |
| `roleTitle` | String | "Senior Product Manager" |
| `roleUrl` | String? | original job posting URL |
| `jobDescription` | String? | full JD text (captured by bookmarklet) |
| `location` | String? | "HCMC, Vietnam" / "Remote (US)" |
| `salaryMin` | Int? | currency-agnostic; UI shows currency from `salaryCurrency` |
| `salaryMax` | Int? | |
| `salaryCurrency` | String? | "USD", "VND", default null |
| `source` | String | enum: `linkedin`, `direct`, `referral`, `recruiter`, `other` |
| `referredBy` | String? | name of referrer if `source = referral` |
| `appliedAt` | DateTime | the date you applied |
| `canonicalStatus` | Enum | `applied` \| `screening` \| `interviewing` \| `offer` \| `rejected` \| `withdrawn` |
| `currentStage` | String? | per-application free text: "Tech round 2 with hiring manager" |
| `rejectedAt` | DateTime? | set when canonicalStatus → `rejected` |
| `rejectionReason` | String? | free text or LLM-extracted |
| `lastActivityAt` | DateTime | updated on any Event; used to compute "stale" |
| `priority` | Int | 1-3, default 2; lets user pin top forays |
| `tags` | String[] | free-form tags ("dream-job", "remote", "vietnam") |
| `notes` | String? | free-form |
| `searchText` | String? | denormalized search corpus |
| `followUpAt` | DateTime? | follow-up reminder date shown in Today when overdue |
| `archivedAt` | DateTime? | nullable; archived forays hidden from default views |
| `createdAt` / `updatedAt` | DateTime | |

### `Stage`
A phase within a single application. Free-form per-application — every company calls them differently.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `applicationId` | Int? | FK; null for user-level/system events |
| `name` | String | "Recruiter call", "Take-home", "Tech round 1", "Bar raiser" |
| `order` | Int | 1, 2, 3... |
| `scheduledAt` | DateTime? | for upcoming interviews |
| `completedAt` | DateTime? | |
| `outcome` | String? | enum-ish: `passed` \| `failed` \| `no_response` \| null |
| `notes` | String? | |
| `createdAt` / `updatedAt` | DateTime | |

### `Event`
Append-only log of everything that happened to an application. Used for the timeline view, audit trail, and undo.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `applicationId` | Int | FK |
| `userId` | Int | FK |
| `type` | Enum | `created`, `status_changed`, `auto_status_changed`, `stage_added`, `stage_completed`, `email_received`, `note_added`, `manual_classification`, ... |
| `source` | Enum | `manual`, `gmail`, `bookmarklet`, `extension`, `cron`, `system` |
| `data` | Json | flexible — includes prevValue/newValue for changes, gmailMessageId for emails, etc. |
| `undoable` | Boolean | true for auto_status_changed events |
| `undoneAt` | DateTime? | set when user clicks undo |
| `occurredAt` | DateTime | |

### `Email`
Raw + classified Gmail messages relevant to job hunt.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `userId` | Int | FK |
| `applicationId` | Int? | FK; null = unmatched, surfaced in inbox |
| `gmailMessageId` | String | unique; Gmail's permanent ID |
| `gmailThreadId` | String | for thread continuity matching |
| `from` | String | sender email |
| `fromDomain` | String | extracted for matcher |
| `subject` | String | |
| `bodyExcerpt` | String | first ~500 chars of plain text body (privacy: don't store full body) |
| `processingStatus` | Enum | `received`, `matched`, `classified`, `acted`, `needs_review`, `failed` |
| `receivedAt` | DateTime | from Gmail headers |
| `classification` | Enum? | `rejection`, `interview_invite`, `recruiter_outreach`, `noise`, `unmatched`, null = unclassified |
| `confidence` | Float? | 0–1 |
| `classifiedBy` | Enum | `rules`, `llm`, `manual`, null |
| `reviewedByUser` | Boolean | true once user has triaged from inbox |
| `createdAt` / `updatedAt` | DateTime | |

### `Recruiter` (Full Phase 14 shipped)
A person on the other side. Recruiter records can be managed at `/recruiters` and linked to applications from the application detail view.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `userId` | Int | FK |
| `companyId` | Int? | FK; null if independent recruiter |
| `name` | String | |
| `email` | String? | |
| `linkedinUrl` | String? | |
| `phone` | String? | |
| `notes` | String? | |

`ApplicationRecruiter` — many-to-many join table linking Recruiter ↔ Application with a free-form role label such as "Recruiter", "Hiring Manager", or "Founder".

### `Document` (Full Phase 12 shipped)
Files attached to an application — resume version, cover letter, JD PDF, take-home submission.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `applicationId` | Int | FK |
| `kind` | Enum | `resume`, `cover_letter`, `jd_pdf`, `take_home`, `other` |
| `filename` | String | |
| `mimeType` | String | |
| `storagePath` | String | server-generated path under `data/documents/` (local fs at v1; swap for object storage if going public) |
| `sizeBytes` | Int | |
| `notes` | String? | |
| `createdAt` | DateTime | |

### `CalendarEvent` (Full Phase 16 shipped)
Google Calendar events synced from the user's primary calendar. The sync stores event metadata needed for interview visibility and application matching, not arbitrary calendar state beyond the rolling sync window.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `userId` | Int | FK |
| `applicationId` | Int? | matched application, if attendee domain matched a company domain |
| `calendarId` | String | currently `primary` |
| `googleEventId` | String | Google Calendar event id |
| `etag` | String | idempotency key for skipping unchanged events |
| `status` | String | Google event status, e.g. `confirmed` or `cancelled` |
| `summary` | String | event title |
| `descriptionExcerpt` | String? | first 500 chars of description |
| `location` | String? | |
| `htmlLink` | String? | Google Calendar event link |
| `hangoutLink` | String? | meeting link when present |
| `organizerEmail` | String? | |
| `attendeeEmails` | String[] | stored to support domain matching/debugging |
| `matchedDomain` | String? | attendee/organizer domain that matched `Company.domain` |
| `startAt` / `endAt` | DateTime | event time bounds |
| `createdAt` / `updatedAt` | DateTime | |

## The hybrid status model (read this carefully)

This is the single most important schema concept. Misunderstanding it will cause cascading bugs.

Two fields, two purposes:

1. **`canonicalStatus`** — fixed enum, 6 values. Drives:
   - Dashboard counts ("3 in screening, 2 in interviewing")
   - Filtered list views
   - Funnel analytics
   - Auto-classification (Gmail rejection email → `rejected`)

2. **`currentStage`** — free text. Drives:
   - Detail view: "what's the actual current state?" ("Tech round 2 with hiring manager scheduled Tuesday")
   - User's mental model
   - Notes that don't fit an enum

Plus `Stage[]` array for the **timeline** of stages (past + scheduled).

**Rule of thumb**:
- If you're querying or aggregating: use `canonicalStatus`.
- If you're displaying detail or capturing nuance: use `currentStage` + `Stage[]`.

Auto-classifier only ever sets `canonicalStatus`. It never touches `currentStage` (it would always be wrong/lossy).

## Constraints + indexes

- `User.email` unique
- `Company(userId, name)` unique (one user can have only one "Stripe" record)
- `Email.gmailMessageId` unique (idempotent ingestion)
- `CalendarEvent(userId, calendarId, googleEventId)` unique (idempotent Calendar sync)
- Indexed: tenant ownership fields, `Company.domain`, `Application.companyId`, `Application.canonicalStatus`, `Application.lastActivityAt`, `Application.archivedAt`, `Application.followUpAt`, `Email.applicationId`, `Email.gmailThreadId`, `Email.fromDomain`, `Email.classification`, `Email.processingStatus`, `Event.applicationId`, `Event.userId`, `Event.occurredAt`, `Event.type`, `Stage.applicationId`, `Stage.scheduledAt`, `Document.applicationId`, `Document.kind`, `CalendarEvent.applicationId`, `CalendarEvent.startAt`, `CalendarEvent.status`

## Migration discipline

- Never edit a migration file after it's committed. Create a new migration.
- Never edit `schema.prisma` and skip migration generation. Always `pnpm prisma migrate dev`.
- Schema changes that drop or rename columns require a 3-step migration: add new → backfill → remove old. (Premature for v1 with one user, but build the habit.)
