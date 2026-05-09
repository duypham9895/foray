# Architecture Research — foray Lean (v0.1)

**Domain:** Single-user job-application tracker (Next.js 16 + Prisma 7 + Postgres, Vertical Slice)
**Researched:** 2026-05-09
**Confidence:** HIGH (architecture is locked by ADR-0010; this document is implementation guidance, verified against Prisma 7 docs + scaffold reality)

---

## What this document is (and is not)

This is **not** an architecture-selection document. ADR-0010 already chose Vertical Slice. The folder layout under `src/` is fixed. The five module-boundary rules in `.dependency-cruiser.cjs` are CI-enforced.

This **is** a wiring document: how the six Lean slices (`auth`, `applications`, `capture`, `inbox`, `classifier`, `matcher`) compose into a coherent system without violating slice isolation, how the request lifecycle threads `userId` from cookie → `tenantDb` → service → row, how the cron pipeline chains `ingest → match → classify → act` across slice boundaries, and the order in which to build them so each slice can be merged independently and pre-commit-green.

The reader is the roadmap author. They need: phase ordering, slice dependency graph, the few "thin glue" surfaces that touch multiple slices, and the concrete shape of cross-cutting hooks (RLS extension, request context, instrumentation cron).

---

## System overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                     │
│   /login      /applications   /applications/new   /applications/[id]         │
│   /inbox      /settings                                                      │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ Server Actions + page renders
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router  (src/app/  — THIN: ≤5 lines per handler)             │
│                                                                              │
│   middleware.ts ── unauth → /login redirect (defense-in-depth, NOT auth)     │
│                                                                              │
│   /api/gmail/auth      ─┐                                                    │
│   /api/gmail/callback  ─┤  Route Handlers (cross-origin or browser-driven)   │
│   /api/gmail/poll      ─┘                                                    │
│                                                                              │
│   instrumentation.ts ── node-cron schedules /api/gmail/poll every 15 min     │
│                          guarded by pg_try_advisory_lock('poll-gmail')       │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ delegates
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  src/features/  ── Vertical slices (no cross-slice imports)                  │
│                                                                              │
│   ┌───────┐   ┌──────────────┐   ┌─────────┐   ┌───────┐                     │
│   │ auth  │   │ applications │   │ capture │   │ inbox │                     │
│   └───┬───┘   └──────┬───────┘   └────┬────┘   └───┬───┘                     │
│       │              │                │            │                         │
│       │   ┌──────────┴──────────────┐ │            │                         │
│       │   │                         │ │            │                         │
│       │   ▼                         ▼ ▼            ▼                         │
│   ┌───────────┐              ┌────────────┐    ┌──────────────┐              │
│   │ classifier│   <orchestr.>│  matcher   │    │ inbox calls: │              │
│   │  rules +  │              │ thread →   │    │  match →     │              │
│   │  LLM fb   │              │ domain →   │    │  classify →  │              │
│   └───────────┘              │ unmatched  │    │  act         │              │
│                              └────────────┘    └──────────────┘              │
│                                                                              │
│  Cross-slice rule: a slice service NEVER imports another slice's service.    │
│  Cross-slice composition happens in the THIN edge (Route Handler / page).    │
│  Exception: `inbox` is a pipeline orchestrator and may import `matcher` and  │
│  `classifier` services — see "The one allowed exception" below.              │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  src/core/  ── leaf layer; nobody downstream of features (CI-enforced)       │
│                                                                              │
│   db/client.ts        prisma singleton + pg.Pool (max 10) + RLS extension    │
│   db/tenant.ts        tenantDb(userId) wrapper                               │
│   db/withRls.ts       runs SET LOCAL inside an interactive $transaction      │
│   auth/session.ts     requireUser() → Result<{id: UserId}, Unauthorized>     │
│   logger/index.ts     pino + AsyncLocalStorage(requestId, userId)            │
│   errors/index.ts     AppError union + neverthrow re-export                  │
│   types/ids.ts        branded UserId, ApplicationId, EmailId, …              │
│   env.ts              Zod-parsed process.env                                 │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (docker compose)                                              │
│   • RLS policies on every tenant-scoped table                                │
│   • app.user_id GUC set per transaction (SET LOCAL)                          │
│   • Indexes leading-userId composite (see PRINCIPLES.md §"Indexes")          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component responsibilities

### `src/core/` (leaf — additions for Lean)

| Module | Status | Lean responsibility |
|---|---|---|
| `core/db/client.ts` | scaffold ✓ | Add `$extends({ query })` block once `withRls()` lands |
| `core/db/tenant.ts` | scaffold ✓ (Application only) | **FND-01:** add `email`, `event`, `company`, `stage` wrappers |
| `core/db/withRls.ts` | NEW | Open `prisma.$transaction(async (tx) => { … })`; first statement is `tx.$executeRaw\`SELECT set_config('app.user_id', ${userId}, true)\``. Returns whatever the callback returns. |
| `core/auth/session.ts` | scaffold (stubbed to userId=1) | **AUTH-01:** wire to real cookie; HMAC over `APP_PASSWORD`-derived secret |
| `core/logger/index.ts` | scaffold ✓ | Add `requestContext` (AsyncLocalStorage) helper for `requestId` + `userId` propagation |
| `core/errors/index.ts` | scaffold ✓ | No new variants needed for Lean |
| `core/types/ids.ts` | scaffold ✓ | No additions for Lean |
| `core/env.ts` | scaffold ✓ | Already covers `CLASSIFIER_AUTO_THRESHOLD`, `ANTHROPIC_API_KEY`, OAuth vars |

### `src/features/` (the slices)

| Slice | Owns | External callers (the *only* legitimate import points) |
|---|---|---|
| `auth/` | `actions.login`, `actions.logout` Server Actions; client `<LoginForm />`. Reads/writes `foray_session` cookie. | `src/app/login/page.tsx`, `src/app/logout/route.ts` |
| `applications/` | List, detail, create, status-update, stage CRUD, undo. `service.archiveApplication`, `service.applyAutoStatusChange`, `service.undoStatusChange`. | `src/app/applications/**/page.tsx`, `src/app/applications/**/actions` (already in slice), `inbox` slice (for `act` stage) |
| `capture/` | `POST /api/capture` cross-origin handler (bookmarklet stub for Lean); shares Zod schema with `applications/schema.ts` | `src/app/api/capture/route.ts` |
| `inbox/` | (a) Gmail OAuth + token refresh; (b) `pollOnce(userId)` orchestrator; (c) review-queue page logic. `service.ingestSinceWatermark`, `service.runReviewPipeline`, `service.confirmReviewRow`. | `src/app/api/gmail/{auth,callback,poll}/route.ts`, `src/app/inbox/page.tsx`, `src/app/settings/page.tsx`, `src/instrumentation.ts` |
| `classifier/` | `service.classifyEmail({ subject, bodyExcerpt }) → Result<{label, confidence, classifiedBy}, AppError>`. `rules.ts` regex table. Anthropic SDK call wrapped in `Result`. | `inbox/service.ts` (the single legitimate caller) |
| `matcher/` | `service.matchEmail({ gmailThreadId, fromDomain }) → Result<{applicationId: ApplicationId \| null}, AppError>`. | `inbox/service.ts` (the single legitimate caller) |

---

## The one allowed exception: `inbox/` is a pipeline orchestrator

The slice-isolation rule (`features/A` cannot import `features/B`) is foundational — but the email pipeline is a four-stage state machine where `match` and `classify` produce inputs the *next* stage consumes. Three honest options for composition:

| Option | What it looks like | Verdict |
|---|---|---|
| **A. Inject services into a shared orchestrator in `core/`** | `core/pipeline/email-pipeline.ts` takes `{matcher, classifier}` deps | ❌ Forbidden by Rule 3: `core/` cannot import from `features/`. Pushing matcher/classifier into `core/` makes `core/` a junk drawer. |
| **B. Event bus / pub-sub** | `inbox` emits `email_ingested`, `matcher` subscribes, `classifier` subscribes | ❌ Speculative flexibility (PRINCIPLES law 4). Single-process, single-user, four-stage linear pipeline — events add async indirection that nothing benefits from. |
| **C. `inbox/` orchestrates `matcher` + `classifier` directly** | `inbox/service.ts` imports `matcher/service` and `classifier/service` | ✅ Recommended. **Codify in dependency-cruiser:** add a single `name: 'inbox-pipeline-exception'` allow rule that lets `features/inbox/**` import `features/{matcher,classifier}/service.ts` only. Document the exception in `inbox/README.md` and link to this section. |

Option C is the smallest correct thing. The "slice isolation" principle exists to prevent gravitational pull where every feature touches every feature. One named, narrow exception (one direction, two specific service imports, one orchestrator slice) does not weaken the rule — it documents the actual data flow honestly.

**The `applications` slice still must NOT be imported by `inbox`.** When `inbox` wants to apply an auto-status-change (Stage 4: `act`), it does so by writing through `tenantDb` directly to the `Application` row + an `Event` row. `applications/service.ts` is a peer reader of those tables, not a gateway. This keeps the dependency graph one-way.

---

## Recommended project structure (Lean additions only)

```
src/
├── app/
│   ├── middleware.ts                 ← NEW (AUTH-03): unauth → /login redirect
│   ├── instrumentation.ts            ← NEW (GMAIL-04): node-cron registers poll
│   ├── login/
│   │   └── page.tsx                  ← NEW (AUTH-02): renders <LoginForm/>
│   ├── logout/
│   │   └── route.ts                  ← NEW: clears cookie, redirects /login
│   ├── applications/
│   │   ├── page.tsx                  ← NEW (APP-01): list view
│   │   ├── new/page.tsx              ← NEW (CAPT-01): renders <NewApplicationForm/>
│   │   └── [id]/page.tsx             ← NEW (APP-02..04): detail timeline
│   ├── inbox/page.tsx                ← NEW (REVIEW-01): review queue
│   ├── settings/page.tsx             ← NEW (GMAIL-02): connect/disconnect/sync
│   └── api/
│       ├── capture/route.ts          ← NEW (Standard milestone stub OK in Lean)
│       └── gmail/
│           ├── auth/route.ts         ← NEW (GMAIL-01)
│           ├── callback/route.ts     ← NEW (GMAIL-01)
│           └── poll/route.ts         ← NEW (GMAIL-03): calls inbox.pollOnce()
│
├── features/
│   ├── auth/
│   │   ├── actions.ts                ← login/logout Server Actions
│   │   ├── service.ts                ← HMAC verify/issue, password compare
│   │   ├── schema.ts                 ← loginSchema (Zod)
│   │   └── components/
│   │       └── login-form.tsx        ← 'use client' useActionState form
│   │
│   ├── applications/
│   │   ├── actions.ts                ← createApplication, updateStatus, undoChange, addStage…
│   │   ├── service.ts                ← createApplication, applyAutoStatusChange, undoStatusChange
│   │   ├── queries.ts                ← list/detail reads via tenantDb
│   │   ├── schema.ts                 ← createApplicationSchema, statusChangeSchema
│   │   └── components/
│   │       ├── application-list.tsx
│   │       ├── application-detail.tsx
│   │       ├── new-application-form.tsx
│   │       ├── stage-editor.tsx
│   │       └── undo-toast.tsx
│   │
│   ├── capture/                      ← Lean: scaffold only. Bookmarklet ships in Standard.
│   │   ├── actions.ts                ← (empty for Lean — manual form is via applications/)
│   │   ├── service.ts                ← shares applications/service for the hot path
│   │   └── schema.ts                 ← re-exports applications/schema for shape parity
│   │
│   ├── inbox/
│   │   ├── service.ts                ← pollOnce(userId), ingestSinceWatermark, runReviewPipeline
│   │   ├── queries.ts                ← review queue listing (low-confidence + unmatched emails)
│   │   ├── actions.ts                ← confirmReviewRow, overrideClassification, ignoreEmail
│   │   ├── schema.ts                 ← reviewActionSchema
│   │   ├── gmail-client.ts           ← thin googleapis wrapper (token refresh, history.list)
│   │   ├── encryption.ts             ← AES-256-GCM for refresh-token storage
│   │   ├── components/
│   │   │   ├── review-row.tsx
│   │   │   ├── settings-panel.tsx
│   │   │   └── connect-gmail-button.tsx
│   │   └── README.md                 ← documents pipeline exception (imports matcher + classifier)
│   │
│   ├── classifier/
│   │   ├── service.ts                ← classifyEmail({subject, bodyExcerpt})
│   │   ├── rules.ts                  ← regex table (CLASS-01)
│   │   ├── llm.ts                    ← Claude Haiku call wrapped in fromPromise
│   │   ├── log.ts                    ← appends to data/classifier-log.jsonl
│   │   └── schema.ts                 ← ClassificationResult (Zod)
│   │
│   └── matcher/
│       ├── service.ts                ← matchEmail({gmailThreadId, fromDomain, userId})
│       ├── queries.ts                ← thread-continuity + domain lookups via tenantDb
│       └── schema.ts                 ← MatchResult (Zod)
│
├── core/                             ← additions only, see table above
│   ├── db/
│   │   ├── client.ts                 ← extend with $extends({ query }) for RLS
│   │   ├── tenant.ts                 ← FND-01: add email/event/company/stage wrappers
│   │   └── withRls.ts                ← NEW: $transaction + SET LOCAL helper
│   ├── auth/session.ts               ← AUTH-01: real cookie verify
│   └── logger/request-context.ts     ← NEW: AsyncLocalStorage(requestId, userId)
│
└── ui/                               ← shadcn primitives added on demand (Button, Input, Card, Toast)
```

### Structure rationale

- **`inbox/` owns BOTH Gmail I/O and the review-queue UI.** They share the `Email` table, the `processing_status` state machine, and the user's mental model ("the inbox is what came in, what needs review, what got linked"). Splitting "ingestion" from "review" into two slices would create a four-arrow circular concern.
- **`capture/` is a near-empty slice for Lean.** Manual capture is the in-app form (`/applications/new` Server Action), which is `applications/`'s natural surface. We keep `capture/` as a stub so bookmarklet/extension routes have a home in Standard milestone. Don't delete the folder; don't fill it with speculative code either.
- **`classifier/` and `matcher/` are pure-ish services.** No UI components, no actions. They're called by `inbox` only. Keeps the testable "pure logic" surface large.
- **`auth/` slice owns the login form + actions; `core/auth/session.ts` owns `requireUser`.** This mirrors the rule: *cross-cutting reads* live in `core/`, *user-facing flows* live in `features/`. `auth/actions.ts` writes the cookie; `core/auth/session.ts` reads and verifies it.

---

## Architectural patterns

### Pattern 1: The five-line page/handler

Every `src/app/**/{page,route}.tsx` is delegation, nothing else.

```tsx
// src/app/applications/page.tsx
import { requireUser } from '@/core/auth/session'
import { listApplications } from '@/features/applications/queries'
import { ApplicationList } from '@/features/applications/components/application-list'
import { redirect } from 'next/navigation'

export default async function ApplicationsPage() {
  const user = await requireUser()
  if (user.isErr()) redirect('/login')
  const rows = await listApplications(user.value.id, { canonicalStatus: 'all' })
  return <ApplicationList rows={rows} />
}
```

```ts
// src/app/api/gmail/poll/route.ts
import { NextResponse } from 'next/server'
import { requireUser } from '@/core/auth/session'
import { pollOnce } from '@/features/inbox/service'

export async function POST() {
  const user = await requireUser()
  if (user.isErr()) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const result = await pollOnce(user.value.id)
  return result.match(
    (data) => NextResponse.json({ ok: true, ...data }),
    (e) => NextResponse.json({ ok: false, error: e._tag }, { status: 500 }),
  )
}
```

**Why:** the `app/` layer is the place Next.js owns. We keep it boring on purpose so a Next.js framework breaking change rewrites five lines per page, not five hundred.

### Pattern 2: Server Action shape — parse → authorize → service → return

```ts
// src/features/applications/actions.ts
'use server'
import { requireUser } from '@/core/auth/session'
import { createApplicationSchema } from './schema'
import * as service from './service'

type ActionState =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string[]> }

export async function createApplication(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()
  if (user.isErr()) return { ok: false, errors: { _root: ['Not signed in'] } }

  const parsed = createApplicationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  const result = await service.createApplication(user.value.id, parsed.data)
  return result.match(
    (app) => ({ ok: true as const, id: app.id }),
    (e) => ({ ok: false as const, errors: { _root: [e._tag] } }),
  )
}
```

**Why:** every Server Action is the same four phrases. Reviewers only have to check the unique service call; the shell is identical. CSRF, validation, auth, error shape — all uniform.

### Pattern 3: `withRls(userId, async (tx) => …)` for transaction-scoped RLS

```ts
// src/core/db/withRls.ts
import 'server-only'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from './client'
import type { UserId } from '@/core/types/ids'

// Open an interactive transaction with app.user_id set so RLS policies fire.
// All Prisma calls inside the callback use `tx`, NOT the global `prisma`.
export async function withRls<T>(
  userId: UserId,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // SET LOCAL is transaction-scoped — required under pgBouncer transaction mode.
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`
    return fn(tx)
  })
}
```

**Use it for any multi-statement operation that must be atomic AND tenant-checked:**

```ts
// src/features/applications/service.ts (auto-status update with undoable Event)
export async function applyAutoStatusChange(
  userId: UserId,
  emailId: EmailId,
  applicationId: ApplicationId,
  newStatus: CanonicalStatus,
  classification: { label: EmailClassification; confidence: number },
): Promise<Result<{ eventId: EventId }, AppError>> {
  return withRls(userId, async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id: Number(applicationId) } })
    const event = await tx.event.create({
      data: {
        applicationId: Number(applicationId),
        userId: Number(userId),
        type: 'auto_status_changed',
        source: 'cron',
        undoable: true,
        data: { from: app.canonicalStatus, to: newStatus, emailId, classification },
      },
    })
    await tx.application.update({
      where: { id: Number(applicationId) },
      data: { canonicalStatus: newStatus, lastActivityAt: new Date() },
    })
    return ok({ eventId: EventId(event.id) })
  })
}
```

Inside `withRls`, **direct `tx.application.*` is allowed** (RLS guarantees scoping). For single-row reads outside transactions, `tenantDb(userId)` remains the path. Two layers, two callsite shapes, both type-safe.

**Tradeoff acknowledged:** this means some service code uses `tenantDb` and some uses `withRls(userId, tx => …)`. The split is honest: `tenantDb` for one-off reads, `withRls` for multi-statement atomicity. Document this in `core/db/README.md` and the pre-commit linter is unchanged (no direct `prisma.*` outside `core/db/`).

### Pattern 4: `Result<T, AppError>` boundaries

Every service returns `Result`. `inbox.pollOnce` is the orchestrator that fans out + collects:

```ts
// src/features/inbox/service.ts (sketch)
import { ResultAsync, ok, err } from '@/core/errors'
import { matchEmail } from '@/features/matcher/service'
import { classifyEmail } from '@/features/classifier/service'
import { applyAutoStatusChange } from '@/features/applications/service'

export async function pollOnce(userId: UserId): Promise<Result<{ ingested: number; acted: number; queued: number }, AppError>> {
  // Stage 1: ingest
  const ingestResult = await ingestSinceWatermark(userId)
  if (ingestResult.isErr()) return err(ingestResult.error)
  const newEmails = ingestResult.value

  let acted = 0, queued = 0
  for (const email of newEmails) {
    // Stage 2: match
    const matched = await matchEmail({ userId, gmailThreadId: email.gmailThreadId, fromDomain: email.fromDomain })
    if (matched.isErr()) continue // log + leave row at processing_status='received' for retry
    // Stage 3: classify
    const classified = await classifyEmail({ subject: email.subject, bodyExcerpt: email.bodyExcerpt })
    if (classified.isErr()) continue
    // Stage 4: act OR queue
    const shouldAutoApply =
      matched.value.applicationId !== null &&
      classified.value.confidence >= env.CLASSIFIER_AUTO_THRESHOLD &&
      !(await isWithinFirst50EmailsForUser(userId)) // AUTO-03
    if (shouldAutoApply) {
      await applyAutoStatusChange(userId, email.id, matched.value.applicationId, classified.value.label, classified.value)
      acted++
    } else {
      await markNeedsReview(userId, email.id, matched.value.applicationId, classified.value)
      queued++
    }
  }
  return ok({ ingested: newEmails.length, acted, queued })
}
```

**Critical invariants captured here:**
- Each per-email failure is logged and **does not abort the batch.** A poisoned email cannot starve the rest.
- The four stages each write to their own column (`processing_status`); next tick resumes from `received` / `matched` / `classified` rows where Stage N+1 didn't run.
- `applyAutoStatusChange` and `markNeedsReview` are themselves transactional via `withRls`.

---

## Data flow

### Flow 1: Manual capture (`/applications/new` form)

```
User fills form
   │
   ▼
<NewApplicationForm/> (client)
   │  useActionState submit
   ▼
applications/actions.createApplication
   │  ├─ requireUser()                                    [core/auth]
   │  ├─ createApplicationSchema.safeParse(formData)     [features/applications/schema]
   │  └─ applications/service.createApplication(userId, input)
   │      └─ withRls(userId, async tx => {
   │           // upsert Company by (userId, name)
   │           // create Application
   │           // create Event(type='created', source='manual')
   │         })
   │      returns Result<{id}, AppError>
   ▼
revalidatePath('/applications')  → ok ? redirect(`/applications/${id}`)
```

**Verifiable outcomes:** one `Application` row, one `Company` row (or reused), one `Event` with `type='created'`. All within one transaction (tenant-scoped via `withRls`).

### Flow 2: Auto-classify and update (cron-driven happy path)

```
node-cron tick (15 min)        [src/instrumentation.ts]
   │
   ▼
pg_try_advisory_lock('poll-gmail')
   │  if !locked → return (previous tick still running)
   ▼
fetch('/api/gmail/poll', { method: 'POST', headers: {Cookie: <session>} })
   │
   ▼
src/app/api/gmail/poll/route.ts
   │  requireUser() → POST inbox.pollOnce(userId)
   ▼
inbox/service.pollOnce(userId)
   │
   ├─ Stage 1 (ingest)  — inbox/service.ingestSinceWatermark(userId)
   │     │  • read User.gmailLastSyncAt
   │     │  • googleapis.gmail.users.history.list({startHistoryId})
   │     │  • for each msg: tenantDb(userId).email.create({…}) with
   │     │    @@unique(userId, gmailMessageId) → ON CONFLICT DO NOTHING
   │     │  • update User.gmailLastSyncAt + gmail_history_id watermark
   │     └─ returns Email[] (just-ingested rows, processing_status='received')
   │
   ├─ Stage 2 (match)   — for each email: matcher/service.matchEmail({…})
   │     │  • try email.gmailThreadId → existing application.gmailThreadId
   │     │  • try email.fromDomain → company.domain → application
   │     │  • else applicationId=null
   │     │  • UPDATE emails SET application_id=$, processing_status='matched'
   │     └─ returns Result<{applicationId}, AppError>
   │
   ├─ Stage 3 (classify) — for each email: classifier/service.classifyEmail({subject, bodyExcerpt})
   │     │  • run rules.ts regex table → {label, confidence, classifiedBy:'rules'}
   │     │  • if confidence < 0.85 AND email is job-shaped → llm.ts (Claude Haiku)
   │     │  • UPDATE emails SET classification, confidence, classified_by, processing_status='classified'
   │     │  • appendToClassifierLog({…})  → data/classifier-log.jsonl
   │     └─ returns Result<{label, confidence, classifiedBy}, AppError>
   │
   └─ Stage 4 (act)
         IF confidence ≥ env.CLASSIFIER_AUTO_THRESHOLD
            AND applicationId !== null
            AND NOT first-50-emails-after-connect (AUTO-03)
         → applications/service.applyAutoStatusChange(userId, …)
              │  withRls(userId, tx => { update Application + insert Event(undoable=true) })
              │  UPDATE emails SET processing_status='acted'
         ELSE
         → inbox/service.markNeedsReview(userId, emailId, …)
              │  UPDATE emails SET processing_status='needs_review'
              │  (no Application or Event mutation)
```

**Idempotency:** rerunning the entire pipeline on already-`acted` rows is a no-op because each stage filters by the *previous* stage's status, then advances the row's status. A crash mid-batch is recovered by the next cron tick.

### Flow 3: Review queue triage (user-driven)

```
User opens /inbox
   │
   ▼
src/app/inbox/page.tsx
   │  requireUser() → inbox/queries.listReviewQueue(userId)
   │  returns rows with processing_status IN ('matched','classified','needs_review')
   │  AND (confidence < threshold OR applicationId IS NULL)
   ▼
<ReviewQueue rows={rows}/>  (server component, lists <ReviewRow/> per email)
   │
   ▼
User clicks "Confirm" / "Override" / "Link to app" / "Ignore" on a row
   │
   ▼
inbox/actions.confirmReviewRow(formData)
   │  requireUser → reviewActionSchema.safeParse → inbox/service.applyReviewDecision(userId, …)
   │  └─ withRls(userId, tx => {
   │       // if confirm: update Application via applications/service.applyAutoStatusChange
   │       // if override: update emails.classification + classified_by='manual'
   │       // if link: update emails.application_id + applicationId-linked event
   │       // if ignore: update emails.reviewed_by_user=true
   │     })
   │  revalidatePath('/inbox')
```

### Flow 4: Undo of an auto-applied change

```
Toast appears after auto-status-change (10s) AND row is permanent in /applications/[id] timeline
   │
   ▼
User clicks Undo
   │
   ▼
applications/actions.undoStatusChange(eventId)
   │  requireUser → eventIdSchema.safeParse →
   │  applications/service.undoStatusChange(userId, eventId)
   │  └─ withRls(userId, async tx => {
   │       const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } })
   │       if (!event.undoable || event.undoneAt) return err(conflict('not undoable'))
   │       const { from } = event.data as { from: CanonicalStatus }
   │       await tx.application.update({ where: { id: event.applicationId },
   │                                     data: { canonicalStatus: from, lastActivityAt: new Date() } })
   │       await tx.event.update({ where: { id: eventId }, data: { undoneAt: new Date() } })
   │       await tx.event.create({ data: { type: 'status_undone', source: 'manual', applicationId, userId } })
   │     })
```

**Why this shape:** undo is a forward-only insert + reversal-of-effect, never a delete. The original Event stays for audit; `undoneAt` flags it; a new `status_undone` Event narrates "the user reverted this." Trust crisis (per PROJECT.md) is managed by making undo *visible everywhere it matters* — toast + permanent timeline entry.

---

## Build order — recommended phase sequence

The roadmap should sequence phases so each phase ends pre-commit-green and merges independently. The dependency graph implies this order:

| Phase | Slice / surface | Depends on | Why this order |
|---|---|---|---|
| **0. Setup (already done)** | scaffold, schema, tenantDb skeleton, env | — | v0.1.0 |
| **1. Core foundation** | `core/db/withRls.ts`, RLS migration, `tenantDb` extensions (FND-01), `requireUser` cookie verify (AUTH-01), middleware redirect (AUTH-03), request-context logger | scaffold | Every later slice writes through these. Cheaper to land them all together than retrofit. RLS migration is reversible, but adding it AFTER apps exist means a backfill story. |
| **2. Auth slice** | `features/auth/` + `/login` page + `/logout` route (AUTH-02) | Phase 1 | First user-visible slice. Validates the request lifecycle end-to-end before adding business logic. |
| **3. Applications slice — manual capture** | `features/applications/` actions/service/queries/schema, `/applications/new` page, `/applications` list (CAPT-01..03, APP-01) | Phase 2 (needs requireUser) | Standalone usable product slice. After this, foray is already a usable manual tracker — useful checkpoint to ship even before Gmail. |
| **4. Applications slice — detail & edit** | `/applications/[id]` page, status dropdown, stage editor (APP-02..04) | Phase 3 | Same slice; iterate. Tests for `applyAutoStatusChange` + `undoStatusChange` belong here even though the cron isn't wired yet. |
| **5. Classifier slice** | `features/classifier/` rules.ts, service.ts, llm.ts, log.ts (CLASS-01..04) | Phase 1 (env, errors); none of phases 2-4 | Pure-ish; testable in isolation against fixtures. **Build before matcher** — matcher's value is partly proven by feeding classifier real outputs. |
| **6. Matcher slice** | `features/matcher/` service.ts, queries.ts (MATCH-01..03) | Phase 3 (Application + Company tables exist with seed data) | Tested with seeded apps + synthetic email rows. No Gmail dependency. |
| **7. Inbox slice — Gmail OAuth + ingest** | `features/inbox/` gmail-client.ts, encryption.ts, ingestSinceWatermark, `/api/gmail/{auth,callback}`, `/settings` page (GMAIL-01..03) | Phase 1 (env), Phase 2 (auth) | Owner can connect Gmail and see Email rows land in DB; pipeline not yet running. |
| **8. Inbox slice — pipeline orchestration** | `pollOnce` orchestrator (the legitimate `inbox → matcher + classifier` import), `markNeedsReview`, `applyAutoStatusChange` callsite, AUTO-01..04 | Phases 5, 6, 7 | The single moment three slices compose. Minimal cross-slice surface; clearly tested end-to-end via integration test (`tests/integration/poll-pipeline.test.ts`). |
| **9. Cron** | `src/instrumentation.ts` with node-cron + pg advisory lock (GMAIL-04) | Phase 8 | Trivial wrapper once `pollOnce` works manually. Build after `pollOnce` so dev iteration doesn't fight a 15-minute timer. |
| **10. Review queue UI** | `features/inbox/components/`, `/inbox` page, action handlers (REVIEW-01..02) | Phase 8 (rows in `needs_review` exist) | Iterates on real data. |
| **11. Foundational hardening** | RLS test coverage, cross-tenant safety tests (FND-03), depcheck CI gate verification (FND-04) | All prior phases | Cleanup phase; pre-commit gate enforcement. |

**Why this ordering and not, say, "auth → applications → Gmail → classifier → matcher → review":**

- **Classifier before matcher** — classifier has zero DB dependencies (pure functions over `{subject, bodyExcerpt}`); matcher needs `Application + Company` rows. Building classifier early means the rules table can be tuned against real-shape fixtures during phases 5-6.
- **Both before inbox pipeline orchestration** — Phase 8 is the *only* legitimate cross-slice import. It must come last among the pipeline pieces so each contributing slice exists and is unit-tested.
- **Gmail OAuth (Phase 7) independent of classifier/matcher** — the OAuth + ingest flow can land before classification works; Email rows just sit at `processing_status='received'`. This decouples "I can connect my Gmail" (high user signal) from "the pipeline runs" (more complex).
- **Cron last in the Gmail subgraph** — manual `pollOnce(userId)` invocation (a button in `/settings` for "Sync now") is enough to develop and test the pipeline. Adding cron is a one-file addition once everything else works.

---

## Where RLS hooks in (concrete)

### Step 1: migration adds policies on every tenant-scoped table

```sql
-- prisma/migrations/<ts>_add_rls/migration.sql
ALTER TABLE applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications  FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON applications
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);

-- repeat for: companies, stages, events, emails, recruiters, application_recruiters, documents
-- documents references applications; CASCADE handles deletion already
```

### Step 2: every multi-statement transaction uses `withRls(userId, …)`

(see Pattern 3 above)

### Step 3 (option A — recommended for Lean): the existing `tenantDb` continues to work as-is

`tenantDb`'s `where: { …, userId }` injection means single-row reads outside `$transaction` are still tenant-correct *without* RLS firing — because the `WHERE` clause filters before RLS would even check. RLS becomes the safety net for any code path that bypasses `tenantDb` (it shouldn't exist; ESLint enforces; RLS catches the bug if it does).

### Step 3 (option B — deferred): `$extends` adds `SET LOCAL` to every operation

This is the shape from the Prisma 7 docs:

```ts
// in core/db/client.ts (NOT recommended for Lean; here for the roadmap to consider in Standard)
export const prisma = base.$extends({
  query: {
    $allOperations: async ({ args, query }) => {
      const userId = currentRequestUserId() // from AsyncLocalStorage
      if (!userId) return query(args) // background jobs / migrations
      return prisma.$transaction([
        prisma.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`,
        query(args),
      ]).then(([, result]) => result)
    },
  },
})
```

**Why deferred:** wrapping every Prisma op in a `$transaction` doubles the round-trips per query and conflicts with the existing `tenantDb` tests (which expect non-transactional behavior). The Prisma issue tracker has multiple reports of interactive-transactions-in-extensions causing connection blocking under load (see Sources). For a single-user app at v1, **transaction-scoped `withRls` for atomic operations + `tenantDb` for everything else** is the cheaper, safer pattern. Re-evaluate at SaaS flip when load shape changes.

**Recommendation for Lean:** Step 1 + Step 2 only. Skip Step 3. Document in an ADR (suggest ADR-0011: "RLS via withRls() helper, not Prisma client extension, until SaaS flip").

---

## Where the cron lives

`src/instrumentation.ts` (Next.js's official server-init hook). One file, ~30 lines:

```ts
// src/instrumentation.ts
import { logger } from '@/core/logger'
import { prisma } from '@/core/db'
import { env } from '@/core/env'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return  // skip on edge runtime
  const cron = await import('node-cron')

  cron.schedule('*/15 * * * *', async () => {
    const log = logger.child({ op: 'cron.poll-gmail' })
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext('poll-gmail')) AS locked
    `
    if (!locked) { log.info('previous tick still running; skip'); return }
    try {
      // Find every connected user; in v1 this is one user.
      const users = await prisma.user.findMany({ where: { gmailRefreshTokenEncrypted: { not: null } } })
      for (const u of users) {
        const start = Date.now()
        const result = await pollOnce(UserId(u.id))
        log.info({ userId: u.id, durationMs: Date.now() - start, result }, 'poll complete')
      }
    } catch (err) {
      log.error({ err }, 'cron tick failed')
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('poll-gmail'))`
    }
  })
}
```

**Why this exact shape (not Vercel Cron, not BullMQ, not a separate scheduler process):**
- **Local-first** (ADR-0003): zero infra. The app is the cron host.
- **`pg_try_advisory_lock`** prevents overlap if a previous tick is still running (LLM batch slow). Costs nothing; built into Postgres.
- **`pollOnce` per user** prepares for multi-user without changing the loop shape.
- **Direct `prisma.user.findMany`** here is acceptable because it's inside `core/`-adjacent infrastructure code and doesn't have a `userId` to scope by yet (we're discovering them). If linting complains, add `instrumentation.ts` to the `no-direct-prisma` rule's ignore list — it's already excepted by the `no-orphans` rule for the same reason.

**Threshold to introduce a real queue (per PRINCIPLES.md):** none of the v1 conditions trigger.

---

## Cross-slice testing strategy

Per CLAUDE.md §2 the pre-commit gate runs `pnpm test:run`. The slice graph implies three test surfaces:

| Test scope | Location | Database | External APIs |
|---|---|---|---|
| **Unit (per-slice)** | colocated `src/features/<slice>/*.test.ts` | none (mock `tenantDb` fixture or use `vi.hoisted()` Prisma mock) — but prefer real DB when possible | mock via `msw` (Anthropic, Gmail) |
| **Slice service with DB** | `src/features/<slice>/service.test.ts` | real Postgres (docker compose up -d db); transactional rollback per test | mock at network seam |
| **Cross-slice integration** | `tests/integration/poll-pipeline.test.ts` etc. | real Postgres | mock Gmail (pre-canned thread) + mock Anthropic; rules-only path can use no LLM mock |

**Key rules from PRINCIPLES.md §"Mocking philosophy" applied:**
- ✅ Mock the network (`msw` for Gmail and Anthropic).
- ❌ Do not mock matcher inside inbox-pipeline tests — call the real `matcher.service`. The cross-slice test is the *only* place that proves the orchestration works.
- ❌ Do not mock Prisma. Real Postgres + per-test transaction rollback. Prisma mocks rot fast and miss RLS failures.

**Concrete plan:**

```
tests/integration/
├── auth-cookie-roundtrip.test.ts       # Phase 2 acceptance
├── tenant-db-cross-tenant-leak.test.ts # FND-03; tries to read user 2's app as user 1
├── rls-fallback.test.ts                # bypass tenantDb directly → RLS rejects
├── classifier-fixtures.test.ts         # Phase 5 acceptance, table-driven
├── matcher-tiebreak.test.ts            # Phase 6 acceptance
├── poll-pipeline.test.ts               # Phase 8 acceptance — Gmail mock → DB end state
└── undo-roundtrip.test.ts              # Phase 4 / Phase 8 acceptance
```

The classifier LLM call MUST be mocked (cost + flake). Rules-only paths can run unmocked; that's the desired default per ADR-0006.

---

## Anti-patterns

### Anti-pattern 1: A `services/` folder under `core/` that re-exports slice services

**What people do:** "We need to call `applications.applyAutoStatusChange` from `inbox`. Let's put it in `core/services/` so neither imports the other."
**Why it's wrong:** every "shared service" attracts more functions. Within three commits `core/services/` is a god-object that imports half of `features/` — exactly the opposite of slice isolation. Also: violates dep-cruiser Rule 3 (`core/` cannot import from `features/`).
**Do this instead:** the `inbox → applications` write path uses `tenantDb`/`withRls` directly to write `Application` + `Event` rows. `applications/service.ts` is a *peer reader* of those rows in queries. The schema is the contract; the service is just a pretty wrapper for the slice's own callsites.

### Anti-pattern 2: A "pipeline" service in `core/`

**What people do:** "The four stages need orchestration. Let's put `email-pipeline.ts` in `core/`."
**Why it's wrong:** same reason as anti-pattern 1 — `core/` cannot import `features/`. Worse, it makes the pipeline an architectural concern instead of a feature concern. Pipelines belong to the slice that owns the data they move.
**Do this instead:** `inbox/service.pollOnce` is the orchestrator. The "exception" to slice-isolation (inbox imports matcher + classifier services) is documented and narrow. One named exception with code review enforcement is cheaper than a new layer.

### Anti-pattern 3: Middleware as the auth gate

**What people do:** "I'll check the cookie in `middleware.ts` and skip `requireUser()` in actions."
**Why it's wrong:** CVE-2025-29927 (Next.js middleware bypass) is the receipt. Middleware runs on the edge runtime, can be bypassed by header tricks, and is a routing concern — not a security boundary.
**Do this instead:** `middleware.ts` redirects unauthenticated browser navigation to `/login` (UX nicety). **Every Server Action and Route Handler still calls `await requireUser()` first.** Auth check lives in the data access layer (PRINCIPLES.md §"Security baseline" rule).

### Anti-pattern 4: Auto-applying status changes without a permanent audit trail

**What people do:** Toast appears, user misses it, change is invisible afterward.
**Why it's wrong:** PROJECT.md flags trust as fatal-on-first-error. A silent auto-change with a 10s undo window is functionally a silent change for users who blink.
**Do this instead:** every `auto_status_changed` Event is permanently visible in `/applications/[id]` timeline with a permanent "Undo" affordance. The toast is a convenience, not the only surface.

### Anti-pattern 5: Storing full email bodies

**What people do:** "We have the body, let's keep it for context."
**Why it's wrong:** PROJECT.md privacy constraint, plus storage and OAuth-scope justification (`gmail.readonly` is enough; no `gmail.modify` needed).
**Do this instead:** `Email.bodyExcerpt` is `≤500` chars (truncate at ingest). For the review queue UI, fetch full body via Gmail API on demand. Schema field already enforces the contract via the column comment in `prisma/schema.prisma`.

### Anti-pattern 6: A single mega-`Email.processing_status` `update` per row

**What people do:** "I'll set `processing_status='acted'` and update the application + write the Event in three sequential queries."
**Why it's wrong:** crash between queries leaves orphan state — Email marked `acted` but Application unchanged, or Event written but Email still `classified`. Replay logic gets unbearable.
**Do this instead:** the four-stage state machine + `withRls(userId, tx => …)` for stages 2-4. A crash mid-`act` rolls back the whole transaction — the email returns to `classified`, next tick retries `act`. Idempotent by construction.

---

## Integration points

### External services

| Service | Integration pattern | Notes |
|---|---|---|
| **Gmail API** | `googleapis` SDK in `features/inbox/gmail-client.ts`. OAuth refresh stored encrypted in `User.gmailRefreshTokenEncrypted` (AES-256-GCM, key from `env.ENCRYPTION_KEY`). Scope: `gmail.readonly` only. | Use `history.list?startHistoryId=<watermark>`. On HTTP 404 (>1 week stale), fall back to `messages.list?q=newer_than:7d`. Mixmax lesson (PRINCIPLES.md): iterate broader `messages` not `messagesAdded`. |
| **Anthropic API (Claude Haiku)** | `@anthropic-ai/sdk` in `features/classifier/llm.ts`. Wrap call in `fromPromise` to convert thrown errors into `Result<…, AppError({_tag:'ExternalApi', service:'llm', cause})>`. | Cap daily spend via `env.CLASSIFIER_AUTO_THRESHOLD` budget alert (CLASS-04). 5-minute prompt cache. Log to `data/classifier-log.jsonl`. |
| **Postgres (docker compose)** | `prisma` via `@prisma/adapter-pg`. Pool `max: 10`. Singleton in `core/db/client.ts`. | RLS policies live in migrations; `app.user_id` GUC set per transaction by `withRls`. |

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `app/` → `features/` | direct import of slice service or component | five-line handler pattern; never imports another `app/` file |
| `features/X` → `features/Y` | **forbidden** by dep-cruiser, with **one exception**: `features/inbox` may import `features/{matcher,classifier}/service` | exception declared in `.dependency-cruiser.cjs` with `name: 'inbox-pipeline-exception'` |
| `features/*` → `core/*` | direct import; `core/` is a leaf | enforced by dep-cruiser Rule 3 |
| `core/db/*` → `prisma` | direct | the only place direct Prisma is allowed (dep-cruiser Rule 4) |
| `instrumentation.ts` → `prisma` (for cron user discovery) | direct | add to `no-direct-prisma` ignore list with comment |
| Server Action → service | call → `Result<…>` → return action state | identical shape across all slices (Pattern 2) |
| Service → DB | `tenantDb(userId)` for single-row, `withRls(userId, tx => …)` for multi-row atomic | both routes are tenant-safe |
| Cron tick → `inbox.pollOnce(userId)` | direct function call inside `instrumentation.ts` | NOT an HTTP self-call; same process, no cookie ceremony |

---

## Scaling considerations

The Lean milestone target is *one user, on a laptop, in Docker*. Scaling is irrelevant for v1. Sketched here only to show the architecture isn't a dead end:

| Scale | Architecture adjustments |
|---|---|
| **1 user (v1 Lean)** | Current design — node-cron + Postgres pool max 10 + single-process. Zero changes needed. |
| **10–100 users (private beta)** | Same architecture. Tighten cron to per-user fairness if sync fan-out grows: `cron.schedule('*/15 * * * *', async () => { for (const u of users) queueMicrotask(() => pollOnce(u.id)) })`. RLS option B (Step 3 Prisma extension) becomes worth adding so `requireUser` request paths fire RLS automatically. |
| **1k+ users (SaaS flip)** | Move cron to Vercel Cron + Inngest (PRINCIPLES.md §"Background jobs" v2). Replace `core/auth/session.ts` body with Clerk `auth()`. Schema unchanged (multi-tenant from day one per ADR-0002). Add per-user rate limits. |

**Scaling priorities (in order):**
1. **First bottleneck:** the synchronous per-email loop in `pollOnce` — at >50 emails per tick the LLM calls dominate. Fix: parallelize with `Promise.allSettled` capped at 5 concurrent (Anthropic rate limits). Trivial 10-line change inside `pollOnce`.
2. **Second bottleneck:** node-cron in a single Next.js process can't fan out across multiple users with isolated failure domains. Fix: move to Inngest. The interface (`pollOnce(userId)`) is unchanged.

---

## Sources

- [ADR-0010 — Vertical Slice Architecture (in-repo)](/Users/edwardpham/Documents/Programming/Projects/foray/docs/decisions/0010-architecture-vertical-slice.md) — HIGH
- [PRINCIPLES.md — §Architecture, §Database, §Email pipeline, §Background jobs (in-repo)](/Users/edwardpham/Documents/Programming/Projects/foray/PRINCIPLES.md) — HIGH
- [docs/architecture.md — system diagram + 4-stage pipeline (in-repo)](/Users/edwardpham/Documents/Programming/Projects/foray/docs/architecture.md) — HIGH
- [docs/data-model.md — entity relationships, hybrid status (in-repo)](/Users/edwardpham/Documents/Programming/Projects/foray/docs/data-model.md) — HIGH
- [.dependency-cruiser.cjs — the 5 module-boundary rules (in-repo)](/Users/edwardpham/Documents/Programming/Projects/foray/.dependency-cruiser.cjs) — HIGH
- [Prisma Client extensions: query component (official docs)](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — HIGH (verified API shape for Step 3 RLS extension)
- [Transactions within Client Extension Example — Prisma Discussion #25034](https://github.com/prisma/prisma/discussions/25034) — MEDIUM (community example, semi-official)
- [Interactive transactions with extended client for RLS in Postgres causes blocking — Prisma Issue #23583](https://github.com/prisma/prisma/issues/23583) — MEDIUM (justifies deferring Step 3 for Lean)
- [CVE-2025-29927 — Next.js middleware authorization bypass](https://nvd.nist.gov/vuln/detail/CVE-2025-29927) — HIGH (cited in PRINCIPLES.md §Security)

---

*Architecture research for: foray Lean milestone (v0.1) — slice wiring, pipeline composition, RLS strategy, build order*
*Researched: 2026-05-09*
