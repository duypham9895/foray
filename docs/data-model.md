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
| `archivedAt` | DateTime? | nullable; archived forays hidden from default views |
| `createdAt` / `updatedAt` | DateTime | |

### `Stage`
A phase within a single application. Free-form per-application — every company calls them differently.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `applicationId` | Int | FK |
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
| `receivedAt` | DateTime | from Gmail headers |
| `classification` | Enum? | `rejection`, `interview_invite`, `recruiter_outreach`, `noise`, `unmatched`, null = unclassified |
| `confidence` | Float? | 0–1 |
| `classifiedBy` | Enum | `rules`, `llm`, `manual`, null |
| `reviewedByUser` | Boolean | true once user has triaged from inbox |
| `createdAt` / `updatedAt` | DateTime | |

### `Recruiter` (Full milestone)
A person on the other side. Optional — at v1-Lean we just use `Application.referredBy` as a string. Full milestone introduces the entity.

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

`ApplicationRecruiter` — many-to-many join table linking Recruiter ↔ Application.

### `Document` (Full milestone)
Files attached to an application — resume version, cover letter, JD PDF, take-home submission.

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `applicationId` | Int | FK |
| `kind` | Enum | `resume`, `cover_letter`, `jd_pdf`, `take_home`, `other` |
| `filename` | String | |
| `mimeType` | String | |
| `storagePath` | String | path under `data/uploads/` (local fs at v1; swap for S3/Supabase Storage if going public) |
| `sizeBytes` | Int | |
| `notes` | String? | |
| `createdAt` | DateTime | |

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
- `Application(userId, companyId, roleTitle, appliedAt)` unique-ish — soft-prevent dupes; if user re-applies to same role we allow it but flag in UI
- `Email.gmailMessageId` unique (idempotent ingestion)
- Indexed: `Application.canonicalStatus`, `Application.lastActivityAt`, `Application.archivedAt`, `Email.applicationId`, `Email.classification`, `Event.applicationId`, `Stage.applicationId`

## Migration discipline

- Never edit a migration file after it's committed. Create a new migration.
- Never edit `schema.prisma` and skip migration generation. Always `pnpm prisma migrate dev`.
- Schema changes that drop or rename columns require a 3-step migration: add new → backfill → remove old. (Premature for v1 with one user, but build the habit.)
