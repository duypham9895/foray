# Architecture — `foray`

System overview, data flow, and module responsibilities.

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  ┌────────────────┐    ┌────────────────┐                        │
│  │ Next.js UI     │    │ Bookmarklet    │                        │
│  │ (App Router)   │    │ / Extension    │                        │
│  └───────┬────────┘    └────────┬───────┘                        │
│          │ fetch                │ fetch                          │
└──────────┼──────────────────────┼─────────────────────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Server (localhost:3000)                                │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Routes (src/app/api/)                                      │ │
│  │  ├ /capture        ← bookmarklet / extension capture       │ │
│  │  ├ /gmail/auth     ← OAuth start                           │ │
│  │  ├ /gmail/callback ← OAuth complete                        │ │
│  │  ├ /calendar/auth  ← Calendar OAuth start                  │ │
│  │  ├ /calendar/callback ← Calendar OAuth complete            │ │
│  │  ├ /inbox/full-body← on-demand Gmail full-body fetch       │ │
│  │  └ /documents/*    ← upload/download/delete documents      │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ features/    │ │ features/    │ │ features/    │              │
│  │   inbox/     │ │  classifier/ │ │   matcher/   │              │
│  │ (Gmail API + │ │   (rules +   │ │  (email →    │              │
│  │  ingest)     │ │  LLM hybrid) │ │ application) │              │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘              │
│         └────────────────┴────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│                  ┌──────────────────┐                            │
│                  │  core/db/        │                            │
│                  │   tenant.ts      │  ← every Prisma call       │
│                  │  (tenantDb)      │    auto-injects userId     │
│                  └──────┬───────────┘                            │
└─────────────────────────┼─────────────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  PostgreSQL 16   │
                │   (in Docker)    │
                └──────────────────┘
                          ▲
                          │
                ┌──────────────────┐         ┌────────────────┐
                │ Cron (15 min)    │ ──────→ │ LLM Provider   │
                │ pollOnce service │         │ API            │
                │                  │ ───┐    │ (fallback only)│
                └──────────────────┘    │    └────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  Gmail API       │
                              │  (OAuth, scope:  │
                              │  gmail.readonly) │
                              └──────────────────┘
```

## Email pipeline — 4 idempotent stages

Gmail ingestion is structured as four explicit stages, each idempotent, each resumable. State machine on the `Email` row's `processing_status` column:

```
received  →  matched  →  classified  →  acted
                                     ↘  needs_review
                                     ↘  failed
```

```
Cron tick (every 15 min, registered from `src/instrumentation.ts`)
      │
      ▼
features/inbox/service.pollOnce
      │
      ├─→ Stage 1: ingest          [features/inbox/service.ts]
      │   • fetch from Gmail (history.list + watermark)
      │   • INSERT INTO emails ... ON CONFLICT(user_id, gmail_message_id) DO NOTHING
      │   • set processing_status = 'received'
      │
      ├─→ Stage 2: match            [features/matcher/service.ts]
      │   • try thread continuity (gmail_thread_id → existing application)
      │   • try sender domain match (from_domain → Company.domain)
      │   • else: status = 'matched' with application_id = NULL
      │
      ├─→ Stage 3: classify         [features/classifier/service.ts]
      │   • rules-first regex against subject + body_excerpt
      │   • if confidence < 0.85 AND relevant: LLM fallback
      │   • provider is selected from User.classifierLlmProvider
      │   • persist {label, confidence, classified_by}
      │   • set processing_status = 'classified'
      │
      └─→ Stage 4: act              [features/inbox/service.ts]
          • if confidence >= CLASSIFIER_AUTO_THRESHOLD AND matched:
              → update Application.canonical_status (via tenantDb)
              → write Event(type='auto_status_changed', undoable=true)
              → status = 'acted'
          • else:
              → status = 'needs_review' (surfaces in /inbox)
```

**Why this shape:** each stage reads the previous stage's column and writes its own. Re-running a stage on an already-acted row is a no-op. Replay is free. Crashes between stages are safe — the next tick picks up where the previous left off. `gmail_message_id` is the natural idempotency key (`UNIQUE(user_id, gmail_message_id)` constraint).

See [PRINCIPLES.md §"Email pipeline"](../PRINCIPLES.md) for full rules.

## Module responsibilities (Vertical Slice layout)

The codebase uses Vertical Slice Architecture (see [ADR-0010](./decisions/0010-architecture-vertical-slice.md)). Every feature is a self-contained slice; cross-cutting code lives in `src/core/`.

### `src/core/` — cross-cutting (keep small)

| Module | Responsibility | Notes |
|---|---|---|
| `core/db/client.ts` | Prisma singleton with `@prisma/adapter-pg` | Globalized for hot reload; `pg.Pool` with `max: 10` |
| `core/db/tenant.ts` | `tenantDb(userId)` wrapper auto-injecting `userId` filter | **All Prisma queries go through this** |
| `core/db/with-rls.ts` | Sets `app.user_id` via `SET LOCAL` per transaction | Belt-and-suspenders to `tenantDb` |
| `core/logger/index.ts` | pino instance + AsyncLocalStorage request context | Every log line carries `requestId` + `userId` |
| `core/errors/index.ts` | `AppError` union taxonomy + `Result` re-export | `_tag`-discriminated, exhaustively checked |
| `core/types/ids.ts` | Branded ID types (`UserId`, `ApplicationId`, ...) | Compile-time tenant safety |
| `core/auth/session.ts` | `requireUser()`, `verifySession()` | Replace with Clerk on public flip |
| `core/env.ts` | Zod-validated `process.env` | Parsed once at module load |

### `src/features/` — feature slices

Each slice has a fixed quartet:

| File | Responsibility | Returns |
|---|---|---|
| `<slice>/actions.ts` | Server Actions: parse → authorize → call service | `{ ok: true, data } \| { ok: false, errors }` |
| `<slice>/service.ts` | Business logic | `Result<T, AppError>` |
| `<slice>/queries.ts` | Prisma reads (via `tenantDb`) | Typed rows |
| `<slice>/schema.ts` | Zod input/output schemas | — |
| `<slice>/components/` | UI used only by this slice | — |

Slices known so far: `analytics`, `applications`, `auth`, `calendar`, `classifier`, `documents`, `inbox`, `matcher`, `recruiters`, `search`, `settings`, `shortcuts`, and `today`.

### `src/app/` — Next.js App Router (thin)

Each `page.tsx` and `route.ts` is intentionally THIN — five lines of "validate, delegate, return". Real work lives in slices.

### Convention

- **I/O modules** (`core/db/`, `core/logger/`, anything in `features/<slice>/queries.ts`) wrap external state and surface narrow interfaces.
- **Pure-ish modules** (`features/<slice>/service.ts`) take inputs and return `Result`. They may call `core/db/` but shouldn't otherwise touch I/O directly — passing `tenantDb` as the dependency keeps services testable.
- The boundary is the `tenantDb` wrapper. Anything below it (raw Prisma) is I/O; anything above it should be pure where possible.

## Cron strategy

For local dev: a tiny in-process scheduler (`node-cron`) runs alongside Next.js through `src/instrumentation.ts` and `src/core/cron/registry.ts`. It runs Gmail polling and reminder-check jobs every 15 minutes, plus Google Calendar sync every 30 minutes when the app is up.

For future deployment (when foray flips public): replace with Vercel Cron, Inngest, or a separate scheduler service. The job handler shape can stay the same even if the trigger changes.

## Why we don't use Gmail Push (yet)

Gmail Push API uses Cloud Pub/Sub. That's:
- Another GCP service to configure
- Another OAuth scope (`gmail.modify` for watch label)
- A public webhook endpoint (we're localhost — would need a tunnel)
- Higher operational complexity for a personal-scale problem

15-minute polling is good enough for job hunt urgency (you're not getting an offer call 5 minutes after a rejection email — and if you are, you'll see the email). Revisit at v2 if needed.

## Security model

See [PRINCIPLES.md §"Security baseline"](../PRINCIPLES.md) for the full ruleset. Highlights:

- **Multi-tenant isolation in the type system**, not in discipline. Every Prisma query goes through `tenantDb(userId)` (auto-injects `userId` filter). Direct `prisma.application.*` outside `core/db/` is banned by ESLint. Postgres RLS is the belt-and-suspenders safety net.
- **Auth checks live in the Data Access Layer**, not Proxy. Every Server Action begins with `await requireUser()`. `src/proxy.ts` is for optimistic redirects only (post-CVE-2025-29927 lesson).
- **Gmail token**: stored encrypted in `User.gmail_refresh_token_encrypted` using AES-256-GCM with `ENCRYPTION_KEY` from env. Never logged, never sent to LLM.
- **Calendar token**: stored encrypted in `User.calendar_refresh_token_encrypted` separately from Gmail, using the readonly Calendar Events scope.
- **LLM API keys**: Anthropic is the default classifier provider; OpenAI can be selected from Settings when `OPENAI_API_KEY` is configured. Keys are server-side only and never reach the browser.
- **Single-user gate (v1)**: `src/core/auth/session.ts` reads `APP_PASSWORD` from env; `src/proxy.ts` redirects unauthenticated requests to `/login`. Trivial to swap for Clerk later.
- **Bookmarklet / extension auth**: `Authorization: Bearer <api-token>` (NOT cookies — enables `Access-Control-Allow-Origin: *` safely). Tokens issued from settings, stored hashed.
- **CORS**: `/api/capture` accepts cross-origin requests with bearer auth. Body validated by Zod (`safeParse`); rejects malformed payloads with structured error.
- **CSRF**: Server Actions get free protection from Origin/Host check. Configured via `experimental.serverActions.allowedOrigins` in `next.config.ts`.

## See also

- [PRINCIPLES.md](../PRINCIPLES.md) — the principal-SWE rulebook (read first)
- [data-model.md](./data-model.md) — entity relationships
- [decisions/0010-architecture-vertical-slice.md](./decisions/0010-architecture-vertical-slice.md) — VSA stance
- [decisions/](./decisions/) — all ADRs
- [milestones/](./milestones/) — what ships in each milestone
