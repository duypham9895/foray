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
│  │  ├ /capture        ← bookmarklet POSTs new application     │ │
│  │  ├ /gmail/auth     ← OAuth start                           │ │
│  │  ├ /gmail/callback ← OAuth complete                        │ │
│  │  ├ /gmail/poll     ← cron-triggered or manual sync         │ │
│  │  └ /classify       ← manual classification override        │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ src/lib/     │ │ src/lib/     │ │ src/lib/     │              │
│  │   gmail.ts   │ │  classifier  │ │   matcher    │              │
│  │ (Gmail API   │ │   (rules +   │ │  (email →    │              │
│  │   wrapper)   │ │  LLM hybrid) │ │ application) │              │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘              │
│         └────────────────┴────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│                  ┌──────────────┐                                │
│                  │ Prisma Client│                                │
│                  │  (db.ts)     │                                │
│                  └──────┬───────┘                                │
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
                │ Cron (15 min)    │ ──────→ │ Anthropic API  │
                │ /api/gmail/poll  │         │ (Claude Haiku, │
                │                  │ ───┐    │  fallback only)│
                └──────────────────┘    │    └────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  Gmail API       │
                              │  (OAuth, scope:  │
                              │  gmail.readonly) │
                              └──────────────────┘
```

## Data flow: new email arrives

```
  Cron tick (every 15 min)
        │
        ▼
  /api/gmail/poll  ──→  gmail.ts: fetch threads modified since lastSyncAt
        │
        ▼
  For each new email:
    1. matcher.ts: find matching Application
       (priority: existing thread match → sender domain match → unmatched)
    2. classifier.ts:
       a. rules-first: regex against subject + body excerpt
       b. if confidence < 0.85 AND email seems relevant: LLM fallback (Haiku)
       c. produce { label, confidence, suggestedStage? }
    3. Decision:
       - confidence ≥ 0.85 AND matched application:
         → update Application.canonical_status
         → write Event (type='auto_status_change', undoable=true)
       - else:
         → store Email row with classification
         → surface in /inbox review queue
```

## Module responsibilities

| Module | Responsibility | Pure? |
|---|---|---|
| `src/lib/db.ts` | Prisma singleton; type re-exports | I/O wrapper |
| `src/lib/env.ts` | Zod-validated environment variables; parsed once at boot | Pure config |
| `src/lib/gmail.ts` | OAuth flow + Gmail API wrapper; thread fetching | I/O |
| `src/lib/classifier.ts` | Rules + LLM hybrid; takes email → returns `{label, confidence}` | Pure given inputs |
| `src/lib/matcher.ts` | Email → Application matching logic | Pure given DB state |
| `src/lib/auth.ts` | Single-user gate; replaceable with Clerk on public flip | I/O |
| `src/app/api/capture/route.ts` | Receives bookmarklet/extension POST → creates Application | Thin endpoint |
| `src/app/api/gmail/poll/route.ts` | Triggered by cron OR manual button → orchestrates ingestion | Orchestrator |

**Convention**: I/O modules wrap external state and surface narrow interfaces. Pure modules take inputs and return outputs without side effects. The boundary is `src/lib/db.ts` — anything below it (Prisma calls) is I/O; anything above it should be pure where possible.

## Cron strategy

For local dev: a tiny in-process scheduler (`node-cron`) runs alongside Next.js. Triggers `/api/gmail/poll` every 15 minutes when the app is up.

For future deployment (when foray flips public): replace with Vercel Cron, Inngest, or a separate scheduler service. The endpoint stays the same.

## Why we don't use Gmail Push (yet)

Gmail Push API uses Cloud Pub/Sub. That's:
- Another GCP service to configure
- Another OAuth scope (`gmail.modify` for watch label)
- A public webhook endpoint (we're localhost — would need a tunnel)
- Higher operational complexity for a personal-scale problem

15-minute polling is good enough for job hunt urgency (you're not getting an offer call 5 minutes after a rejection email — and if you are, you'll see the email). Revisit at v2 if needed.

## Security model

- **Gmail token**: stored encrypted in `User.gmail_refresh_token_encrypted` using AES-256-GCM with `ENCRYPTION_KEY` from env. Never logged, never sent to LLM.
- **Anthropic API key**: server-side only. Never reaches the browser.
- **Single-user gate**: `src/lib/auth.ts` reads `APP_PASSWORD` from env; middleware redirects unauthenticated requests to `/login`. Trivial to swap for Clerk later.
- **CORS**: `/api/capture` accepts requests from `chrome-extension://*` (extension) and the bookmarklet's host page (any origin). Body is validated by Zod; reject malformed payloads.

## See also

- [data-model.md](./data-model.md) — entity relationships
- [decisions/](./decisions/) — why each architectural decision was made
- [milestones/](./milestones/) — what ships in each milestone
