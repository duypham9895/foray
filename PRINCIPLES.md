# Engineering Principles — `foray`

The principal-SWE rulebook for this codebase. Every contributor (human or AI agent) reads this once at session start and refers back when uncertain. Strong opinions throughout. Where two reasonable options exist, this document picks one.

This file is **strategic**: *why* we shape code this way. The tactical counterpart is [CLAUDE.md](./CLAUDE.md) (Karpathy rules, testing rules, naming, commits). The agent contract — *where things live* — is [AGENTS.md](./AGENTS.md). Read all three.

---

## The four laws

These four come before everything else. When the rest of this doc conflicts with them, they win.

1. **Honesty over cleverness.** Clear names, explicit types, surgical changes. If a function lies about its return value, fix the signature, not the comment. If an abstraction obscures what's happening, inline it. The compiler is your truthteller — give it real types, not `any` or unsound casts.

2. **Boundaries enforced by the type system, not by discipline.** `userId` filters that "we always remember to add" *will* leak tenant data. Auth checks that "live in middleware" *will* be bypassed by a future router refactor. Every safety property must be encoded — branded types for IDs, `tenantDb(userId)` wrappers for queries, RLS policies in Postgres, ESLint boundary rules in CI. Discipline is for cleaning your room, not for production safety.

3. **Earn each abstraction.** Per Sandi Metz: duplication is far cheaper than the wrong abstraction. The first occurrence: write it inline. The second: wince and duplicate. The third: only *then* extract — and only if the three sites genuinely share their axis of variation. If the third use diverges, leave the duplication; the abstraction would have been wrong.

4. **Ship the smallest correct thing.** Speculative flexibility — config knobs you might need, layers for adapters that might exist, error cases that can't happen — is liability disguised as foresight. Code for the requirement on the desk. When the future arrives, you'll have evidence about what it actually needs.

---

## Architecture — Vertical Slice

`foray` uses **Vertical Slice Architecture** (VSA), feature-first. Each user-visible capability is a self-contained slice under `src/features/`. Cross-cutting code lives in a thin `src/core/`. Truly shared UI primitives go in `src/ui/`. The Next.js App Router (`src/app/`) is intentionally *thin* — pages and route handlers delegate to slice services within five lines.

**Why not Clean Architecture / Hexagonal / Ports & Adapters at our scale**

Those patterns are insurance for events — domain swap, framework swap, multi-team coordination — that almost certainly won't happen on a single-dev project. They impose a tax on every feature: more files, more indirection, more "where does this go?". At our scale, that tax compounds without ever paying out. Bogard's argument lands: rigid horizontal layering creates false symmetry, where a five-line CRUD slice carries the same ceremony as the classifier pipeline.

When we'd reconsider: a second `core/db/` adapter (Postgres + something else), or a second team owning a subset of `features/`. Until then, VSA is correct.

### Folder structure

```
src/
├── app/                       # Next.js App Router — pages, layouts, route handlers
│                              # Each file is THIN: validate → call slice service → return
├── features/                  # ⭐ The meat. One folder per user-visible capability.
│   ├── applications/          #
│   │   ├── actions.ts         # Server Actions (validate → authorize → call service)
│   │   ├── service.ts         # Business logic for this slice
│   │   ├── queries.ts         # Prisma reads (always via tenantDb)
│   │   ├── schema.ts          # Zod schemas (input + output types)
│   │   └── components/        # UI components used ONLY by this slice
│   ├── capture/               # Bookmarklet / extension capture flow
│   ├── classifier/            # LLM + rule-based classifier
│   ├── matcher/               # Email→application matching
│   ├── inbox/                 # Gmail sync + review queue
│   └── auth/                  # Single-user gate (replaceable with Clerk later)
├── core/                      # Cross-cutting, feature-agnostic. Keep small.
│   ├── db/                    # Prisma client + tenantDb wrapper
│   ├── logger/                # pino instance + request context (AsyncLocalStorage)
│   ├── errors/                # AppError taxonomy + Result re-export from neverthrow
│   ├── types/                 # Branded IDs, shared primitives
│   └── auth/                  # session helpers (verifySession, requireUser)
├── ui/                        # Shared design-system components (Button, Input, Card)
│                              # These are imported by multiple features.
├── generated/                 # Prisma generated client (gitignored)
└── test/                      # Test factories (fishery), DB helpers, fixtures
```

### Slice anatomy

Every slice is a quartet that fits on one screen:

- **`schema.ts`** — Zod schemas for inputs and outputs. Single source of truth for shape.
- **`service.ts`** — Business logic. Returns `Result<T, AppError>`. Pure-ish (DB allowed via injected `tenantDb`).
- **`queries.ts`** — Prisma reads. Always via `tenantDb(userId)`. No business logic.
- **`actions.ts`** — Server Actions. Each is the same shape: parse → authorize → call service → return.

Slices may import from `core/` and `ui/`. Slices **must not import from each other**. If two slices need to share something, it goes in `core/` (if cross-cutting) or in a new shared slice (if domain-specific). This rule is enforced by `dependency-cruiser` — see Module Boundaries below.

### When to add layers

Don't extract a port/adapter pair until you have *two real adapters in production*. Don't introduce a `domain/` vs `infrastructure/` split until a feature has >600 LOC of business logic *and* you've felt the friction of Prisma types leaking into business code at least twice. Until then: a single `service.ts` that calls Prisma via `tenantDb` is correct.

---

## TypeScript discipline

### `tsconfig.json` — the strict flags we enable

| Flag | Setting | Why |
|---|---|---|
| `strict` | `true` | Non-negotiable |
| `noUncheckedIndexedAccess` | `true` | Highest-leverage flag — catches `arr[i]` is `T \| undefined`, matches runtime reality of `FormData`, `findFirst`, dynamic dispatch |
| `noImplicitOverride` | `true` | `override` keyword required when overriding base class methods |
| `verbatimModuleSyntax` | `true` | `import type` vs `import` matters; this enforces it |
| `isolatedModules` | `true` | Required by Next.js + bundlers; catches transpile-unsafe code |
| `skipLibCheck` | `true` | Skip type checking node_modules. Faster, fewer false alarms |
| `moduleDetection` | `force` | Treat every file as a module (not a script) |
| `module` / `moduleResolution` | `preserve` / `bundler` | Next.js / modern bundler defaults |
| `target` | `ES2022` | Wide enough; we don't ship to old runtimes |
| `noEmit` | `true` | Next.js + tsx do the emitting; tsc only typechecks |

**Deferred:** `exactOptionalPropertyTypes`. Useful in theory (distinguishes `{x?: string}` from `{x: string | undefined}`) but fights with React prop spreading and Radix/shadcn type unions. Revisit when the ecosystem catches up.

**Path alias:** one. `@/*` → `./*`. Don't invent `@components/*`, `@server/*`, etc. — one alias is enough and matches every shadcn `add` command.

### Branded types for IDs

`UserId`, `ApplicationId`, `EmailId`, etc. are not just `string` — they're **branded** so the compiler refuses `function foo(applicationId: ApplicationId)` called with a `userId`. The `userId/tenantId` mixup is the #1 multi-tenant bug; this is type-system insurance against it.

```ts
// src/core/types/ids.ts
declare const brand: unique symbol
export type Brand<T, B> = T & { readonly [brand]: B }

export type UserId        = Brand<string, 'UserId'>
export type ApplicationId = Brand<string, 'ApplicationId'>
export type EmailId       = Brand<string, 'EmailId'>

// Constructors validate at the boundary, then trust the type.
export const UserId = (s: string): UserId => {
  if (!/^\d+$/.test(s)) throw new Error(`Invalid UserId: ${s}`)
  return s as UserId
}
```

Pair with Zod for runtime: `z.string().brand<'UserId'>()`. Use the constructor at every boundary that produces an ID (parsing form data, reading from DB, etc.); after that the type system tracks them.

### Zod at every boundary

Every input from outside the trust boundary (form data, request body, URL params, env vars, external API responses) goes through `safeParse` before use. Zod schemas live in `src/features/<slice>/schema.ts` (for slice-specific) or `src/core/schemas/` (for cross-cutting like env validation).

Rules:

- **Always `safeParse`** at boundaries; `parse` only inside trusted internal code where a throw is acceptable.
- **One schema, two consumers.** Server Action and any matching Route Handler use the same exported schema. Bookmarklet's POST body and the in-app form use the same schema.
- **Don't auto-generate from Prisma.** The input shape (what the user submits) is a strict subset of the storage shape. Auto-derivation creates coupling that breaks more often than it helps. Manual duplication is cheaper.
- **Co-locate; don't centralize.** Cross-slice schema lives in `core/`; everything else lives in the slice that owns it.

```ts
// src/features/applications/schema.ts
import { z } from 'zod'

export const createApplicationSchema = z.object({
  companyName: z.string().min(1).max(120),
  roleTitle:   z.string().min(1).max(160),
  roleUrl:     z.string().url().optional(),
  source:      z.enum(['linkedin', 'direct', 'referral', 'recruiter', 'other']).default('other'),
  notes:       z.string().max(2000).optional(),
})

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>
```

---

## Next.js — server vs client, Server Actions vs Route Handlers

### Default to Server Components

`'use client'` is a *boundary*, not a label. Every file with `'use client'` plus all its imports become part of the client bundle. So push the boundary to interactive **leaves**: dropdown menus, inputs, status togglers. Pages, layouts, dashboards, list views, detail views all stay server.

Heuristic for `'use client'`:
- Component calls `useState`/`useEffect`/`useRef` → client
- Component attaches `onClick`/`onChange`/`onSubmit` → client
- Component touches `window`/`localStorage`/`document` → client
- Otherwise → server

When a client wrapper needs server content inside it (e.g., a `<Sheet>` with a server-rendered detail body), use the **children-slot pattern**: the wrapper accepts `children` as a prop, and the parent (a Server Component) passes server-rendered JSX as that child. Client and server compose, neither leaks.

### Server Actions vs Route Handlers — when to use which

| Use case | Mechanism |
|---|---|
| In-app form (capture, edit, classify) | **Server Action** in `features/<slice>/actions.ts` |
| OAuth callback (`/api/auth/gmail/callback`) | **Route Handler** (browser redirect needs a URL) |
| Bookmarklet `POST /api/capture` | **Route Handler** (cross-origin) |
| Future Chrome extension API | **Route Handler** (cross-origin) |
| Cron tick (`/api/cron/poll-gmail`) | **Route Handler** (called by scheduler) |
| External webhook receiver | **Route Handler** |
| RPC-like client→server call | **Server Action** |

**Server Actions are public HTTP endpoints. Treat them like one:**

- Validate every input with Zod (`safeParse`)
- Re-check `requireUser()` inside the action body
- Rate-limit by `userId`
- Return structured errors (`{ ok: false, errors: { fieldName: [...] } }`) so `useActionState` can render field-level UI
- Don't catch and rethrow — return `Result`

**Route Handlers for cross-origin endpoints:**

- Authenticate via `Authorization: Bearer <api-token>` (NOT cookies). Cookie-based auth + `Access-Control-Allow-Origin: *` is forbidden by browsers when credentials are sent.
- Issue tokens from the settings page; store **hashed** in DB.
- Explicitly export an `OPTIONS` handler for CORS preflight.
- Validate `Content-Type`; reject with 415 if mismatched.
- Cap body size (`request.json()` doesn't enforce one).

### Forms — the `useActionState` pattern

Forms in `foray` use `<form action={serverAction}>` + `useActionState` + `useFormStatus`. Progressive enhancement is free if you don't break it (don't attach `onSubmit`, don't `e.preventDefault()`, don't drive submit via `fetch()`).

```tsx
// src/features/applications/components/new-application-form.tsx
'use client'
import { useActionState } from 'react'
import { createApplication } from '../actions'

const initial = { ok: false as const, errors: {} as Record<string, string[]> }

export function NewApplicationForm() {
  const [state, formAction, pending] = useActionState(createApplication, initial)
  return (
    <form action={formAction}>
      <input name="companyName" aria-invalid={!!state.errors?.companyName} />
      {state.errors?.companyName && <p role="alert">{state.errors.companyName[0]}</p>}
      <button disabled={pending}>{pending ? 'Saving…' : 'Add'}</button>
    </form>
  )
}
```

`useOptimistic` only for high-frequency, low-risk updates (status toggle, mark-as-classified). Don't use it for creates — silent dedup loss is worse than a moment of "Saving…".

---

## Database — Prisma 7 + multi-tenancy

### Singleton + adapter pattern

One `PrismaClient` instance, lives in `src/core/db/client.ts`. Globalize across hot reloads in dev. Pass an explicit `pg.Pool` so we can tune `max` connections:

```ts
// src/core/db/client.ts
import 'server-only'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg(pool) })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### `tenantDb(userId)` — multi-tenant safety in TypeScript

**Every query against a tenant-scoped model goes through `tenantDb(userId)`, never raw `prisma.application.*`.** The wrapper auto-injects `userId` into every `where`. ESLint rule (`no-restricted-imports` plus a custom check) bans `prisma.application` and friends outside `core/db/`.

```ts
// src/core/db/tenant.ts
import 'server-only'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from './client'
import type { UserId } from '@/core/types/ids'

export function tenantDb(userId: UserId) {
  return {
    application: {
      findMany: (args: Prisma.ApplicationFindManyArgs = {}) =>
        prisma.application.findMany({ ...args, where: { ...args.where, userId } }),

      findUnique: async (args: Prisma.ApplicationFindUniqueArgs) => {
        const row = await prisma.application.findUnique(args)
        return row?.userId === userId ? row : null
      },

      create: (args: Omit<Prisma.ApplicationCreateArgs, 'data'> & { data: Omit<Prisma.ApplicationCreateInput, 'user'> }) =>
        prisma.application.create({ ...args, data: { ...args.data, user: { connect: { id: userId } } } }),

      // ...same for update / delete / count / aggregate
    },
    // ...same for company, stage, event, email, recruiter, document
  }
}
```

### Postgres Row-Level Security (RLS) — belt-and-suspenders

`tenantDb` is the primary line of defense. **RLS is the safety net** that catches the bug `tenantDb` would have caught — and vice versa. Both layers are cheap; we run both.

In the Lean milestone we add to migrations:

```sql
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON applications
  USING       (user_id = current_setting('app.user_id', true)::int)
  WITH CHECK  (user_id = current_setting('app.user_id', true)::int);
```

And a Prisma client extension that runs before each query inside a transaction:

```sql
SELECT set_config('app.user_id', $1, true);  -- 'true' = transaction-local
```

`SET LOCAL` (the `true` flag) scopes the value to the current transaction — critical when behind pgBouncer transaction-pooling, where connections rotate between requests.

### When raw SQL is allowed

Two cases:
1. RLS context setup (`set_config`) at start of each transaction
2. Window functions, recursive CTEs, complex `INSERT ... ON CONFLICT ... DO UPDATE`, full-text search ranking

Use `prisma.$queryRaw` with `Prisma.sql` tagged templates. **Never string-concat user input.** Tagged templates parameterize automatically.

### Indexes

Every multi-tenant table gets a leading-`user_id` composite index for the queries actually run. Examples:
- `(user_id, last_activity_at DESC)` for the application list
- `(user_id, canonical_status)` for filtered views
- Partial: `(user_id, last_activity_at DESC) WHERE canonical_status NOT IN ('rejected', 'withdrawn')` for the active-only list

Add them in the migration that introduces them. Verify with `EXPLAIN ANALYZE` on realistic data sizes (use the seed script + a stress-multiplier).

---

## Error handling — `Result<T, AppError>`

We use **neverthrow's** `Result` type at all expected-failure boundaries: Server Actions, service functions, external API calls. We **throw** only for genuine programmer errors and at the very edges (Next.js error boundaries, top-level `instrumentation.ts`).

### Why Result over throwing

Throwing in TypeScript makes the type system lie. `getApplication(id): Promise<Application>` says "you'll get one" but means "you'll get one or any of seven errors I forgot to document." Result types make the contract honest: `Promise<Result<Application, NotFoundError | DbError | AuthError>>` forces the caller to handle every documented failure mode.

This matters disproportionately in Server Actions because the boundary between *user-facing validation error* and *500 internal error* must be explicit. Result makes it impossible to accidentally leak a Prisma error message into a UI string.

### Why `neverthrow` specifically

- De facto standard (most stars, mature)
- Has `eslint-plugin-neverthrow` that fails CI if a `Result` is constructed but never `unwrap`'d
- Tree-shakable; small footprint
- Doesn't drag in Effect's enormous conceptual surface (Effect is excellent but a different language inside TS — overkill for one dev)

### Flat error taxonomy

```ts
// src/core/errors/index.ts
import type { ZodIssue } from 'zod'
import type { Prisma } from '@/generated/prisma/client'

export type AppError =
  | { _tag: 'NotFound';     resource: string; id: string }
  | { _tag: 'Unauthorized' }
  | { _tag: 'Forbidden';    reason: string }
  | { _tag: 'Validation';   issues: ZodIssue[] }
  | { _tag: 'ExternalApi';  service: 'gmail' | 'llm'; cause: unknown }
  | { _tag: 'Db';           cause: Prisma.PrismaClientKnownRequestError }
  | { _tag: 'RateLimited';  retryAfterSeconds: number }
  | { _tag: 'Conflict';     reason: string }

export { ok, err, Result, ResultAsync } from 'neverthrow'
```

### Where throw is legal

1. **Branded type constructors** when input is malformed at boundary (programmer error if it reaches an internal call)
2. **`requireUser()`** when no session — caught by Next.js auth middleware that redirects to `/login`
3. **Genuine invariants** that shouldn't ever happen ("queue must not be empty here" with `assertNever` exhaustiveness)

Everything else: return `Result`.

```ts
// src/features/applications/service.ts
import { ok, err, type Result } from 'neverthrow'
import type { AppError } from '@/core/errors'
import type { ApplicationId, UserId } from '@/core/types/ids'

export async function archiveApplication(
  userId: UserId,
  applicationId: ApplicationId,
): Promise<Result<{ id: ApplicationId }, AppError>> {
  const found = await tenantDb(userId).application.findUnique({ where: { id: applicationId } })
  if (!found) return err({ _tag: 'NotFound', resource: 'Application', id: applicationId })
  if (found.archivedAt) return err({ _tag: 'Conflict', reason: 'already archived' })

  await tenantDb(userId).application.update({
    where: { id: applicationId },
    data: { archivedAt: new Date() },
  })
  return ok({ id: applicationId })
}
```

---

## Email pipeline — 4 idempotent stages

Gmail ingestion is structured as four explicit stages, each idempotent, each resumable.

```
ingest → match → classify → act
```

State machine on the `Email` row's `processing_status` column:

```
received → matched → classified → acted | needs_review | failed
```

### Stage 1: `ingest`

Fetch from Gmail. Persist into `emails` table with `UNIQUE(user_id, gmail_message_id)`. Use `INSERT ... ON CONFLICT DO NOTHING RETURNING id` — if it returns nothing, you've seen this message and the rest of the pipeline is a no-op.

**Watermark:** track `gmail_history_id` per user. On every poll, request `history.list?startHistoryId=<watermark>`. On HTTP 404 (>1 week old), fall back to `messages.list` for the last N days. Mixmax's hard-won lesson: `messagesAdded` in history responses is unreliable — iterate the broader `messages` array and dedupe on `gmail_message_id`.

### Stage 2: `match`

Find the `Application` this email belongs to (or stash as orphan):

1. **Existing thread continuity** — `gmail_thread_id` already linked to an application
2. **Sender domain match** — `from_domain` matches `Company.domain`
3. **Fall back to "unmatched"** — surfaces in review queue with no application link

Set `processing_status = 'matched'`. Never auto-link on weak match — the review queue is cheap, false attribution is expensive.

### Stage 3: `classify`

Rules-first regex against subject + body excerpt. If rules give confidence ≥0.85, done. Otherwise route to LLM (Claude Haiku, prompt-cached). Persist `classifier_version`, `confidence`, `rule_id` (if rules-matched), `prompt_hash` (if LLM-matched). Set `processing_status = 'classified'`.

### Stage 4: `act`

Apply the state transition iff `confidence >= CLASSIFIER_AUTO_THRESHOLD` (env, default 0.85) AND application is matched. Otherwise queue for human review.

The action writes a `Stage` and an `Event`. The `Event` is `undoable=true` and references the `Email`'s id — so "undo" is a reverse insert + status recompute.

### Idempotency rules

- **Claim the slot first.** Insert the row before doing any side effects. Never classify-then-record — a crash between the two replays the side effects.
- **Each stage reads the previous stage's column, writes its own.** Re-running a stage on an already-acted row is a no-op.
- **`pg_message_id` is the natural idempotency key.** Use it everywhere there's deduplication.

### Retry + dead-letter

Transient errors (5xx, network timeouts, rate limits) → retry with jittered exponential backoff. Permanent errors (4xx, parse failures) → set `processing_status = 'failed'` with `failure_reason` and `attempts`, exclude from active pipeline. Don't build a separate DLQ table for v1.

---

## Background jobs

### v1 (local-only): `node-cron` + Postgres advisory lock

A single in-process scheduler in `src/instrumentation.ts` (Next.js's official hook). Wrap every tick in `pg_try_advisory_lock(hashtext('<job-name>'))` — non-blocking, returns false if previous tick is still running. Costs zero infra. Prevents overlap during slow LLM batches.

```ts
// src/instrumentation.ts
import { prisma } from '@/core/db/client'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const cron = await import('node-cron')

  cron.schedule('*/15 * * * *', async () => {
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext('poll-gmail')) AS locked`
    if (!locked) return
    try { await pollGmailAllUsers() }
    finally { await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('poll-gmail'))` }
  })
}
```

### v2 (deployed): Vercel Cron + Inngest

When `foray` flips to public deployment: Vercel Cron is the trigger; the handler immediately enqueues an Inngest step function and returns 200. Inngest gives durable steps (each step is its own retry/cache boundary), built-in idempotency keys, survives the serverless function timeout. **Not BullMQ** — that requires a persistent worker process which defeats Vercel's deployment model.

### Threshold to introduce a real queue

(a) Single tick can't finish under the platform timeout (5 min on Vercel Pro), or
(b) You need per-user fairness so one heavy user doesn't starve others, or
(c) You need >1 worker

Until then, in-process node-cron is correct. Every infra component is a thing that can wake you at 3 a.m.

---

## State management

For `foray` the answer is: **`useState` + URL state. That's it.**

This is single-user, mostly server-rendered. There is no global client state worth managing. Local component state (form drafts, dropdown open/close, expanded card) → `useState`. Filter, sort, pagination, "show archived?", selected tab → URL state via `useSearchParams` or `nuqs` for type-safe parsing.

**No Zustand, no Jotai, no Redux for v1.** Server Components + Server Actions + `revalidatePath` already give the cache invalidation that Redux Toolkit Query was invented to provide. The moment you add a client-side store, you've duplicated the source of truth and signed up for staleness bugs.

**Use `nuqs` if URL state grows beyond ~3 params.** Native `useSearchParams` returns read-only `URLSearchParams` and forces manual string concat. `nuqs` gives `useState`-like ergonomics, type-safe, sync'd to URL, ~2KB. Worth the dep when the applications-list filters land in Standard milestone.

---

## Testing strategy — 70/25/5

### The pyramid

| Tier | Share | What | Tool |
|---|---|---|---|
| Unit | 70% | Pure logic, classifier rules, matcher tiebreak, schema validation | Vitest |
| Integration | 25% | DB-touching, real Postgres, slice services end-to-end | Vitest + Testcontainers / docker compose |
| E2E | 5% | Critical user flows: capture → save, sync → review queue → confirm | Playwright |

Coverage floor: **80% on `src/features/**`**. Don't chase coverage on `src/app/**` (route handlers are mostly delegation).

### What to test obsessively

- **Anything touching `userId`.** Multi-tenant safety regressions are catastrophic. Test that queries filter, that creates assign correctly, that updates don't cross tenants.
- **Classifier rules + scoring deltas.** Lots of unit tests, table-driven, with real example email subjects + bodies as fixtures.
- **Matcher tiebreak rules.** Integration with seeded DB.

### What NOT to test

- Framework code (don't test that Next.js renders a page)
- Trivial getters
- Type-only constructs
- Third-party libs
- Generated Prisma code

### Mocking philosophy

**Mock at the network seam, not the function seam.**

- ✅ `msw` to intercept HTTP calls to Gmail and Anthropic in unit tests — your service code is real, only the network is faked
- ❌ Mocking your own functions — a smell that says the function does too much
- ❌ Mocking Prisma — use a real Postgres via Testcontainers or `docker compose up -d db`, wrap each test in a transaction that rolls back

### Test data builders — `fishery`

Hand-built fixtures rot. Builders make tests *say what they care about*:

```ts
// src/test/factories.ts
import { Factory } from 'fishery'
import { ApplicationId, UserId } from '@/core/types/ids'

export const applicationFactory = Factory.define<Application>(({ sequence }) => ({
  id: ApplicationId(`${sequence}`),
  userId: UserId('1'),
  companyId: 1,
  roleTitle: 'Senior Engineer',
  canonicalStatus: 'applied',
  createdAt: new Date('2026-01-01'),
  // ...
}))

// In a test:
const app = applicationFactory.build({ canonicalStatus: 'interviewing' })
```

---

## Observability

The minimum viable stack: **pino for structured JSON logs + AsyncLocalStorage for request context + Sentry for error tracking** (Sentry deferred until public flip).

### The killer property

Every log line carries `requestId` (UUID generated at request entry) and `userId` (when authenticated). When something fails at 11pm: filter Sentry by `requestId` → see the exact log timeline. Without correlation IDs you cannot reconstruct a request.

### `console.log` is forbidden

Outside of explicit dev-only branches. Enforce with ESLint `no-console`. Use `logger.info(...)` everywhere.

### `pino` over `winston`

Materially faster, JSON-by-default, child-logger pattern propagates context trivially:

```ts
// src/core/logger/index.ts
import 'server-only'
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: ['password', 'token', '*.authorization', '*.cookie'], censor: '[REDACTED]' },
  ...(process.env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
})
```

### Pattern for the Gmail sync (illustrative)

```ts
const log = logger.child({ op: 'gmail.sync', userId, syncId: randomUUID() })
log.info({ phase: 'start' })
const messages = await fetchMessages(userId)
log.info({ phase: 'fetched', count: messages.length })

for (const msg of messages) {
  const child = log.child({ messageId: msg.id, gmailId: msg.gmailId })
  // ... classify, log per-step with phase tags
}
```

Every log line is greppable by `syncId`, `userId`, or `messageId`.

---

## Security baseline

### The post-CVE-2025-29927 rule

**Middleware is not your auth boundary.** Auth checks belong close to the data:

1. In a **Data Access Layer** (the `tenantDb` wrapper)
2. In `requireUser()` calls inside Server Actions
3. In Postgres RLS policies

Middleware is fine for redirects and rate limiting; it is *not* fine as the only gate keeping unauthenticated users away from data.

### The hard rules

- Every Server Action begins with `const user = await requireUser()`
- Every Prisma call goes through `tenantDb(user.id)` — enforced by ESLint
- Every input parsed by Zod via `safeParse`
- Strict CSP with per-request nonces (Next.js 16 supports natively)
- Secrets: `process.env` only, never logged (pino redact paths configured)
- CSRF: Server Actions get free protection from Origin/Host check; verify `experimental.serverActions.allowedOrigins` in `next.config.ts`
- Never trust `request.headers` for identity — always re-fetch from session cookie inside the action

### Bookmarklet / extension

Authenticate with `Authorization: Bearer <api-token>`, not cookies. Issue tokens from the settings page; store **hashed** in DB (bcrypt or argon2). Token rotation from settings.

---

## Module boundaries

### Tools

`dependency-cruiser` is the source of truth (runs in CI, fails PRs on violations). `eslint-plugin-boundaries` is the editor-time companion. Both. Madge is a strict subset of dep-cruiser; not worth running separately.

### The 5 rules

1. **No circular dependencies, ever.** Most painful bug class.
2. **Slice isolation.** `features/applications/**` cannot import from `features/classifier/**`. Sharing goes in `core/` or a new shared slice.
3. **`core/` is a leaf.** Anyone can import from `core/`; `core/**` cannot import from `features/**` or `app/**`.
4. **`app/` is the only thing that imports from `next/*` page-level APIs.** Server Actions live in slices; `notFound()`, `redirect()` only in `app/`.
5. **No `prisma` imports outside `core/db/`.** Forces every query through `tenantDb`. *This is the rule that prevents multi-tenant leaks.*

Configured in `.dependency-cruiser.cjs` — see Commit 3.

---

## Code review checklist

Run on every PR — yours included. Skip the obvious stuff (tests, types, formatter). These are the principal-level questions, ordered by frequency-of-payoff.

1. **Is this the right boundary?** Does this code belong in *this* slice, or is it actually a `core/` concern bleeding into a feature?
2. **Does this abstraction earn its complexity?** One caller, one implementation = not an abstraction. Inline it.
3. **Could a stranger replace this in 6 months without context?** Are names load-bearing? Is the *why* in a comment or commit? Slack history doesn't count.
4. **Where is the auth check?** Trace request from edge to DB. Name the line that enforces "this user can do this." If middleware-only, reject.
5. **What happens on the unhappy path?** Disconnect, timeout, malformed input, partial failure. For each external call: retry policy? Timeout? Logged?
6. **Does this leak tenant scope?** Find every Prisma call. Confirm each goes through `tenantDb(userId)` or has a documented reason not to.
7. **Is the test testing behavior or implementation?** A test that breaks on rename of a private function tests the wrong thing.
8. **What invariants does this assume?** Make them explicit — assert or encode in the type.
9. **Is the ubiquitous language preserved?** `application` not `job`, `foray` not `tracker`, `canonical_status` not `status`.
10. **What's the rollback story?** Schema changes especially: backward-compatible migration → code change → cleanup migration.
11. **Does this introduce a new cross-cutting concept?** New error type, new log shape, new ID format, new auth role → ADR, not a PR comment.
12. **Is anything here speculative?** Code for *speculated* future needs almost always gets the speculation wrong. Cut it. Add it back when the need is real.
13. **What did this *not* test that it should have?** Name an edge case with no test. There's always one.
14. **Is the smallest possible change being made?** Drive-by refactors hide regressions. Extract them to a separate PR.
15. **What is the failure mode in production telemetry?** When this breaks, is there enough context in the error/log to act without paging the author?

---

## Tech debt vocabulary

Use these markers consistently. Searchable. Each has different rules:

| Marker | Meaning | Rule |
|---|---|---|
| `TODO(name, YYYY-MM-DD): description` | Work I'd do if I had time | No urgency. Quarterly cleanup pass |
| `FIXME(name, YYYY-MM-DD): description` | Known incorrect behavior, not yet harmful | Must fix before relevant feature ships to non-test users |
| `HACK(name, YYYY-MM-DD): description (because <reason>)` | Intentional shortcut with justification | The `because` clause is mandatory; HACK without justification is just bad code |
| **ADR** in `docs/decisions/NNNN-title.md` | Decision worth interrogating later | Nygard format. Append-only. Supersede; never edit. |

When in doubt, use an ADR. Cheap to write, expensive to lose.

---

## Refactoring discipline

### The rule of three is a ceiling, not a floor

First time: write inline. Second time: wince and duplicate. Third time: refactor *only if* the three sites genuinely share their axis of variation. If they diverge on the very axis your would-be abstraction would unify, leave the duplication. **Sandi Metz's rule trumps Fowler's**: duplication is far cheaper than the wrong abstraction.

### Boy Scout rule has limits

The healthy version is *limited Boy Scout*: while you're already in a file, fix obvious local issues — typos, dead imports, badly named locals. **Do not** fix the architecture, rename a public API, or split a file. If you spot something bigger: file it as a TODO with a date and move on. Drive-by refactors hide regressions and balloon review.

### When to refactor in early-stage code

Heuristics:

- **Refactor before adding the third feature that touches an area**, never as a standalone task
- **If a file crosses 400 lines or three responsibilities**, split when next touched
- **If a Prisma model gets a fourth callsite outside its slice's `service.ts`**, extract to `core/`
- **Name every refactor's *trigger condition* in an ADR** — refactors with named triggers happen on time; refactors without them never happen

### Default to "deletion is the highest form of refactor"

If you can delete code instead of restructuring it, do that. If the feature isn't being used, delete it. If the configuration option is always set to the same value, hardcode it and remove the option. Code you delete will never break.

---

## When this document is wrong

If you find this document tells you to do something that conflicts with codebase reality (a path that doesn't exist, a tool that fails, a convention that no file follows), **fix this document**. The principles must match the code. If you can't fix it because you're not authorized: write a note in your response and surface the contradiction to the user.

This document is **append-friendly, edit-cautiously**. Adding new sections is normal; rewriting existing prescriptions is an ADR-worthy event because every change to a principle ripples through every PR after it.
