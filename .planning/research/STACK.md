# Stack Research — `foray` Lean milestone (v0.1)

**Domain:** Single-user, local-first job-application tracker with Gmail auto-classification
**Researched:** 2026-05-09
**Overall confidence:** HIGH (all baseline decisions verified against npm registry + official docs)

---

## TL;DR — what's already pinned, what's missing

The Next.js / React / Prisma / Anthropic / googleapis baseline is **already installed and current** in `package.json` as of 2026-05-08. The Lean milestone needs four additions and one replacement:

| Status | Package | Version | Reason |
|--------|---------|---------|--------|
| ➕ ADD | `node-cron` | `^4.2.1` | In-process scheduler for Gmail poll. Already named in PROJECT.md (GMAIL-04). |
| ➕ ADD | `iron-session` | `^8.0.4` | HMAC+encrypted session cookie — single dep replaces 60 LOC of homegrown HMAC code |
| ➕ ADD | `msw` | `^2.14.5` | Network-seam mocks for Gmail + Anthropic in unit tests (PRINCIPLES.md §"Mocking philosophy") |
| ➕ ADD | `@testcontainers/postgresql` | `^11.14.0` | Real Postgres for integration tests — required by FND-03 (≥30 tests) and PRINCIPLES.md §"Testing strategy" |
| ➕ ADD | `nuqs` | `^2.x` (deferred) | URL state for filters. Needed in Standard milestone, NOT Lean — defer |

**One contradiction to fix in docs:** PROJECT.md line 99 says "Next.js 15" but `package.json` and `eslint-config-next` are pinned to `16.2.6`. The installed version is correct (and post-CVE-2026-27978 patch); update PROJECT.md.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | `16.2.6` | App Router, Server Components, Server Actions, route handlers | Already installed. Post-CVE-2026-27978 patched (16.1.7+ required). React 19 native. Server Actions are the in-app form mechanism per PRINCIPLES.md §"Next.js" |
| React | `19.2.4` | UI runtime; `useActionState`, `useFormStatus`, `useOptimistic` | Already installed. `useActionState` (replaces deprecated `useFormState`) is the canonical Server Action client binding |
| TypeScript | `^5` | Strict types + branded IDs | `noUncheckedIndexedAccess` and `verbatimModuleSyntax` already enforced per PRINCIPLES.md §"TypeScript discipline" |
| Node.js | `>=20.9.0` | Runtime | Forced by Next 16. Prisma 7 wants `^20.19 \|\| ^22.12 \|\| >=24.0` — pick **Node 22 LTS** for the dev container |

### Database + ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | `16` (Docker) | Storage; RLS for tenant isolation | Local-first per ADR-0003. RLS = belt to `tenantDb` suspenders (PRINCIPLES.md §"Database") |
| Prisma | `^7.8.0` | Schema-first ORM | Already installed. Note Prisma 7 breaking changes: schema URL lives in `prisma.config.ts` (not `schema.prisma`), client imports come from `@/generated/prisma/client` (not `@prisma/client`) — both already configured |
| `@prisma/adapter-pg` | `^7.8.0` | Driver adapter for `pg` Pool | Required at runtime in Prisma 7. Lets us pass an explicit `Pool({ max: 10 })` for connection control |
| `pg` | `^8.20.0` | Postgres driver | Pinned by `@prisma/adapter-pg` |

### Gmail integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `googleapis` | `^171.4.0` | Gmail REST client + OAuth2 client | Already installed. Official Google library. `OAuth2Client.setCredentials({ refresh_token })` auto-refreshes access tokens transparently. Engines: Node `>=18` |
| `google-auth-library` | `^10.6.2` | OAuth2 helper (re-exported by googleapis) | Already installed; needed if we want to use `OAuth2Client` standalone (cleaner imports) |

**Polling vs Pub/Sub (decided):** **Polling.** Google's own docs say push notifications are for backend servers; *polling is the recommended approach for installed apps and personal use* ([Gmail API push docs](https://developers.google.com/workspace/gmail/api/guides/push)). Pub/Sub also requires a public HTTPS endpoint that Gmail can call — incompatible with local-first (ADR-0003). Polling every 15 min is fine for a single user. Revisit only if we flip to public deployment **and** we need <15-min latency.

**Sync watermark pattern:** Use `users.history.list?startHistoryId=<watermark>` per PRINCIPLES.md §"Email pipeline → Stage 1: ingest". On HTTP 404 (watermark expired, ~1 week old), fall back to `users.messages.list` with `q=after:<lastSyncTime>`. Persist `gmailHistoryId` on the `User` row alongside `gmailLastSyncAt` (already in schema).

### Classifier

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@anthropic-ai/sdk` | `^0.95.1` | Claude Haiku LLM fallback | Already installed (current as of 2026-05-07). Default `maxRetries: 2` with exp backoff; default `timeout: 600_000ms` — **override to 15s per call** in foray (we're not generating long completions). Configure in client constructor: `new Anthropic({ maxRetries: 3, timeout: 15_000 })` |
| Model | `claude-3-5-haiku-latest` | Cheapest current Haiku for short classification | Cost: ~$0.80/M input, ~$4/M output → at ~600 tokens/email and 5-email LLM batch/day, ≈ $0.01/day. Well under $0.50/day cap (ADR-0006) |

**Structured output pattern:** Use **tool use with JSON schema** rather than parsing free-form JSON from text. The SDK exposes `client.messages.toolRunner()` (per [SDK docs](https://platform.claude.com/docs/en/api/sdks/typescript)) but for foray a single tool definition with `input_schema` is enough — no agent loop needed. Validate the response with the same Zod schema used internally for `EmailClassification`. **Don't** trust the model to return clean JSON without a schema — that's how silent corruption gets in.

### Background jobs

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node-cron` | `^4.2.1` | In-process scheduler for `pollGmailAllUsers()` every 15 min | PRINCIPLES.md §"Background jobs" already names it. v4 is TypeScript-native (no `@types` needed), Node 18+ required. v4 breaking changes vs v3: removed `scheduled` and `runOnInit` options — use `createTask()` if you need a paused-on-create job. We don't, so the simple `cron.schedule()` API still works |

**Why not Croner:** Croner is also good (zero deps, DST-aware, 600K weekly downloads) but PRINCIPLES.md §"Background jobs" explicitly names `node-cron` and the codebase already cites the API in its example. Switching mid-spec adds zero capability for foray's use case (one job, one user, fixed 15-min interval). If a future job needs DST-correct semantics, switch then.

**Don't add BullMQ / Inngest / Bree in Lean.** Per PRINCIPLES.md §"Background jobs → Threshold to introduce a real queue", we don't need a queue until (a) tick can't finish under platform timeout, (b) per-user fairness matters, or (c) >1 worker is needed. None apply at Lean.

**Locking:** Wrap each tick in `pg_try_advisory_lock(hashtext('poll-gmail'))` exactly as PRINCIPLES.md shows. Prevents overlap if a sync runs long.

### Auth

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `iron-session` | `^8.0.4` | HMAC+encrypted, signed, stateless session cookie | Pure cookie-based, no DB session table. Uses `@hapi/iron` (HMAC-SHA256 sign + AES-256 encrypt). 60-line replacement for hand-rolled HMAC code. Works with App Router, Server Actions, Route Handlers, Middleware. Last release 2024-11 — stable, no breakage in Next 16 (the API surface uses `cookies()` from `next/headers`, which is unchanged) |

**Why not roll our own HMAC:** PROJECT.md asks "HMAC over `APP_PASSWORD`-derived secret". We *could* hand-roll it in 60 LOC of `crypto.createHmac`, but iron-session adds the same amount of code surface to your trust boundary, plus encryption, plus rotation support, plus an audited library. Per PRINCIPLES.md Law 4 ("ship the smallest correct thing"): the smallest **correct** auth for foray is an audited library, not bespoke crypto.

**Why not JWT:** Per PRINCIPLES.md §"Security baseline" implication and explicit user requirement ("HMAC session cookies, not JWT") — JWT was popularised for serverless statelessness foray doesn't need. Iron-session is the closest "stateless cookie, no JWT spec overhead" option.

**Configuration:**
```ts
// src/core/auth/session-config.ts
import type { SessionOptions } from 'iron-session'
export const sessionOptions: SessionOptions = {
  password: process.env.APP_PASSWORD!, // ≥32 chars, validated by env Zod schema
  cookieName: 'foray_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // 'lax' lets bookmarklet POST work; 'strict' would break it
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}
```

### Encryption (OAuth refresh token at rest)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node built-in `crypto` | (Node 22 stdlib) | AES-256-GCM encrypt + authenticate `gmailRefreshTokenEncrypted` | No extra dep. AES-256-GCM provides confidentiality + integrity in one primitive |

**Pattern (write once, in `src/core/crypto/at-rest.ts`):**
- 32-byte key from `process.env.ENCRYPTION_KEY` (Zod-validated as 64-char hex → `Buffer.from(hex, 'hex')`)
- 12-byte random IV per row (`crypto.randomBytes(12)`) — 96 bits is the GCM standard ([NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf))
- 16-byte auth tag from `cipher.getAuthTag()` validated on decrypt
- Storage format: `base64(iv) || ':' || base64(authTag) || ':' || base64(ciphertext)` in the single text column `gmail_refresh_token_encrypted`

**Don't use a library.** This is ~30 LOC of stdlib code. Adding `node-forge` or `crypto-js` is more attack surface for a one-function need. The trap is **IV reuse** (catastrophic for GCM) — `crypto.randomBytes(12)` per encrypt prevents it.

**Don't use bcrypt/argon2 for this.** Those are *password hashes* (one-way). The refresh token must be decryptable to call Gmail.

### Validation + types

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zod` | `^4.4.3` | Schema validation at every boundary | Already installed. v4 is current. `safeParse` everywhere per PRINCIPLES.md |
| `neverthrow` | `^8.2.0` | `Result<T, AppError>` for fallible operations | Already installed. `eslint-plugin-neverthrow` (also installed) fails CI on unconsumed `Result`s |

### Logging

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `pino` | `^10.3.1` | Structured JSON logs with redaction | Already installed. `pino-pretty` (also installed) for dev terminal output |

### UI (kept minimal for Lean)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | `^4` | Styling | Already installed (v4 with `@tailwindcss/postcss`) |
| `@radix-ui/react-slot` | `^1.2.4` | Compound primitives for shadcn-style button/input | Already installed |
| `class-variance-authority` | `^0.7.1` | Variant API | Already installed |
| `lucide-react` | `^1.14.0` | Icons | Already installed |
| `tailwind-merge` | `^3.5.0` | Resolve conflicting Tailwind classes | Already installed |
| `date-fns` | `^4.1.0` | Date formatting in timeline / "stale foray" calc | Already installed |

**No `nuqs` in Lean.** PRINCIPLES.md §"State management" recommends `nuqs` "if URL state grows beyond ~3 params" — that's Standard milestone (filters, sort, pagination on `/applications` list). Lean has 1–2 query params at most.

**No state library (Zustand / Jotai / Redux).** Per PRINCIPLES.md §"State management": `useState` + URL state is correct for single-user, mostly server-rendered.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vitest` | `^4.1.5` | Test runner (unit + integration) | Already installed. Single runner, fast, ESM-native. Engines: Node `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |
| `@testing-library/react` | `^16.3.2` | Component testing | Already installed |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers | Already installed |
| `jsdom` | `^29.1.1` | Browser env shim for component tests | Already installed |
| `msw` | `^2.14.5` | **➕ ADD.** Network-seam mocks for Gmail + Anthropic | PRINCIPLES.md §"Mocking philosophy" — mock at network seam, not function seam. MSW intercepts at the HTTP layer including `fetch`, `node-fetch`, and (transitively) `gaxios` which `googleapis` uses |
| `@testcontainers/postgresql` | `^11.14.0` | **➕ ADD.** Real Postgres for integration tests | PRINCIPLES.md §"Testing strategy" — never mock Prisma. Use real Postgres. Testcontainers spins up a disposable container per test run |
| `fishery` | `^2.x` | **➕ ADD.** Test data builders | PRINCIPLES.md §"Test data builders" explicitly names fishery |

**Vitest config note for Testcontainers:** Use `globalSetup` to start the container *once* per test run (containers are slow to boot). Each test gets a transaction that rolls back at the end (Prisma supports this with `prisma.$transaction([…])` or by wrapping the test in `BEGIN/ROLLBACK` via `$queryRawUnsafe`). Don't share a container across `pnpm dev` and tests — keep them on different DB names.

### Module boundaries (already configured)

| Tool | Version | Purpose |
|------|---------|---------|
| `dependency-cruiser` | `^17.4.0` | CI-enforced slice isolation rules per PRINCIPLES.md §"Module boundaries" |
| `eslint-plugin-boundaries` | `^6.0.2` | Editor-time companion |
| `eslint-plugin-neverthrow` | `^1.1.4` | Fails CI if `Result` constructed but never `unwrap`'d |
| `eslint-config-next` | `16.2.6` | Next.js + React hooks rules; pinned to Next version |

---

## Installation

### What to add for Lean

```bash
# Production deps
pnpm add node-cron iron-session

# Dev deps (testing)
pnpm add -D msw @testcontainers/postgresql fishery
```

### What's already there (verify with `pnpm list`)

```bash
pnpm list next react react-dom typescript prisma @prisma/client @prisma/adapter-pg \
  @anthropic-ai/sdk googleapis google-auth-library zod neverthrow pino vitest \
  @testing-library/react jsdom dependency-cruiser
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not Chosen |
|-------------|-------------|----------------|
| `node-cron` v4 | `croner`, `node-schedule`, `bree` | Croner is technically nicer (DST, error recovery, zero deps) but PRINCIPLES.md already cites `node-cron`'s API and we get no real lift. Bree/Agenda are queue-shaped — overkill |
| `iron-session` | Hand-rolled HMAC (`crypto.createHmac`) | Same code surface, less audited, no encryption, no rotation. Iron-session is one trusted dep |
| `iron-session` | `next-auth` / `auth.js` | Designed for OAuth providers + DB sessions. Massive surface for a single-password gate. Wrong tool |
| `iron-session` | JWT (`jose`, `jsonwebtoken`) | Explicitly out per project requirement. JWT solves "stateless across services" — foray is one process |
| AES-256-GCM via stdlib `crypto` | `node-forge`, `crypto-js` | 30 LOC of stdlib does it. Adding a dep for one function = liability |
| Polling (cron) | Gmail watch + Pub/Sub | Pub/Sub needs public HTTPS endpoint Gmail can hit. Local-first per ADR-0003 forbids it. Google docs say polling is correct for personal/installed apps |
| MSW (network mocks) | Mocking Prisma client / mocking SDK functions | "Mock at network seam" per PRINCIPLES.md. Function-seam mocks let bugs hide between mock and real |
| Testcontainers | docker-compose + manual lifecycle | Compose works but Testcontainers gives per-suite isolation, parallel safety, automatic cleanup. Worth the dep for ≥30 tests |
| `claude-3-5-haiku-latest` | `claude-3-haiku-20240307` (older, cheaper) | Latest Haiku is current at ~$0.80/M in. Older 3 Haiku is deprecated. Don't pin to a deprecated alias |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@prisma/client` import path | Broken under pnpm in Prisma 7 (per AGENTS.md "Prisma 7 reminders") | `import { PrismaClient } from '@/generated/prisma/client'` |
| Direct `prisma.application.*` outside `src/core/db/` | Bypasses tenant filter — multi-tenant leak | `tenantDb(userId).application.*` (enforced by ESLint + dependency-cruiser) |
| `useFormState` (React) | Deprecated in React 19 | `useActionState` from `react` |
| `axios` for Anthropic / Gmail | Both SDKs include their own clients (gaxios, undici-based) | Use the SDK methods directly |
| `bullmq`, `agenda`, `bree`, `inngest` | Queue infra for a single-user, single-process Lean | `node-cron` + advisory lock |
| `bcrypt` / `argon2` for OAuth refresh token | One-way hashes — token must be decryptable to call Gmail | `crypto.createCipheriv('aes-256-gcm', ...)` |
| `next-auth`, `clerk`, `lucia` | Provider/DB-session auth for a single-password gate | `iron-session` |
| `redux`, `zustand`, `jotai`, `tanstack-query` for v1 | Server Components + Server Actions + `revalidatePath` cover it | `useState` + URL state |
| Mocking Prisma in tests | Hides real query bugs (PRINCIPLES.md §"Mocking philosophy") | Real Postgres via `@testcontainers/postgresql`, transaction rollback per test |
| `node-cron@3.x` | Deprecated; v4 is TS-native rewrite | `node-cron@^4.2.1` (note: removed `scheduled` + `runOnInit` opts) |

---

## Compatibility Matrix

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.2.6` | `react@19.2.4`, `eslint-config-next@16.2.6` | Pinned together. Next 16 requires Node `>=20.9.0`; **CVE-2026-27978 patch shipped in 16.1.7** — current `16.2.6` is safe |
| `prisma@7.8.0` | Node `^20.19 \|\| ^22.12 \|\| >=24.0` | Engine constraint is **stricter** than Next.js. Use Node 22 LTS in dev container |
| `prisma@7.8.0` | `@prisma/adapter-pg@^7.8.0` | Adapter version must match Prisma client major+minor. Both at 7.8.0 — good |
| `@anthropic-ai/sdk@0.95.1` | All Node ≥18 | SDK is pre-1.0 — minor bumps may include API tweaks. Pin to `^0.95.1` (exact major+minor), review changelog before bumping |
| `googleapis@171.4.0` | Node `>=18`, transitively pulls `google-auth-library@^10.x` | The two are co-versioned. `pnpm add googleapis` already pulled compatible auth lib |
| `vitest@4.1.5` | `@testing-library/react@16.3.2`, `jsdom@29.1.1`, `msw@2.14.5` | All current. MSW v2 is the modern API (different from v1's interceptor model) |
| `iron-session@8.0.4` | Next 13+ App Router, Node 18+ | Last release 2024-11. Still works on Next 16 because it uses the stable `cookies()` API from `next/headers`. **Watch:** if Next 17 changes the cookies API, this could break |
| `node-cron@4.2.1` | Node 18+, ESM + CJS interop | v4 rewrite is TS-native. Removed `scheduled` and `runOnInit` options vs v3 |

---

## Critical Watchouts

1. **Next.js version drift in docs.** PROJECT.md line 99 still says "Next.js 15"; package.json is `16.2.6`. Update PROJECT.md or the next agent gets confused. **The runtime is 16, not 15.**

2. **Prisma 7 import path.** `import { PrismaClient } from '@prisma/client'` is **broken** under pnpm in Prisma 7. The AGENTS.md and PRINCIPLES.md both say so. Always: `import { PrismaClient } from '@/generated/prisma/client'`.

3. **Prisma 7 schema URL location.** `datasource db { url = env(...) }` is gone in Prisma 7 — URL lives in `prisma.config.ts`. Already configured in this repo, but a contributor copying old Prisma 6 docs will hit this.

4. **Anthropic SDK timeout default is 10 minutes.** Way too long for a per-email classification call. Override in the client constructor: `new Anthropic({ timeout: 15_000 })`. A hung classifier blocks the polling loop otherwise.

5. **MSW v2 API is different from v1.** All recent docs are v2 (`http.get(...)`, `setupServer(...)`, `server.listen()`). Don't follow v1 tutorials — they reference deprecated `rest.get(...)` and request handler signatures.

6. **`node-cron` v4 breaking changes.** `scheduled` and `runOnInit` options are removed; use `cron.createTask()` if you need an initially-paused job. Tasks now auto-start on `cron.schedule()` call. This is what we want — no migration concern, but worth knowing.

7. **iron-session password length.** `iron-session` requires the cookie password to be ≥32 characters. Validate in `src/core/env.ts` Zod schema: `APP_PASSWORD: z.string().min(32)`. Fail loud at startup if shorter.

8. **GCM IV reuse.** Catastrophic for AES-256-GCM. *Never* reuse an IV with the same key. Always `crypto.randomBytes(12)` per encrypt — store IV alongside ciphertext. The `node-forge`/`crypto-js` traps don't apply because we're using stdlib.

9. **Gmail OAuth: `access_type=offline` is mandatory** to get a `refresh_token`. Refresh token is **only returned on first authorization** — revoke + reauth in Google account if you lose it during dev. Per [Google OAuth docs](https://developers.google.com/identity/protocols/oauth2).

10. **`pg_advisory_lock` is connection-scoped, not transaction-scoped by default.** Use `pg_try_advisory_lock` (non-blocking) inside the cron tick exactly as PRINCIPLES.md shows, and **always** call `pg_advisory_unlock` in `finally`. If a tick crashes without unlocking, the lock is auto-released when the connection closes (which is fine for local Postgres without pgBouncer).

11. **Postgres RLS via `SET LOCAL` requires a transaction.** `set_config('app.user_id', $1, true)` only sticks for the current transaction. Wrap every tenant query in `prisma.$transaction(...)` via the client extension — the `prisma-client-extensions/row-level-security` example repo shows the canonical pattern.

12. **Don't mix native `fetch` and `node-fetch` in tests.** MSW v2 intercepts both via `@mswjs/interceptors`, but a test that uses one and asserts on the other will silently miss. Stick to native `fetch` (Node 18+) project-wide.

---

## Stack Patterns by Variant

**Lean (v0.1) — local single-user (current target):**
- `node-cron` in-process, advisory lock, Postgres in Docker, `iron-session` over `APP_PASSWORD`
- No queue, no Sentry, no Inngest, no Pub/Sub
- Tests: Vitest + Testcontainers + MSW

**Standard (v0.2):**
- Add `nuqs` for URL filters on `/applications` list
- Add Playwright for 5% E2E layer per PRINCIPLES.md §"Testing strategy"
- Likely add Sentry (still local) for error tracking
- Bookmarklet capture (Route Handler with `Authorization: Bearer` token, hashed in DB)

**Full (v0.3+) / public flip:**
- Vercel Cron + Inngest replaces `node-cron` (PRINCIPLES.md §"v2 deployed")
- Real auth provider (Clerk or self-hosted) replaces `iron-session`
- Cloud Postgres (Neon / Supabase) replaces local Docker
- Gmail Pub/Sub becomes viable (now we have a public endpoint)

---

## Sources

### Verified against npm registry (HIGH confidence — 2026-05-09)

- All version numbers above queried via `npm view <pkg> version time.modified engines.node` on 2026-05-09.

### Official documentation (HIGH confidence)

- [Next.js: Server Actions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) — `experimental.serverActions.allowedOrigins` for CSRF
- [Next.js: Forms guide](https://nextjs.org/docs/app/guides/forms) — `useActionState` pattern
- [Gmail API: push notifications](https://developers.google.com/workspace/gmail/api/guides/push) — explicitly says polling is correct for personal/installed apps
- [google-api-nodejs-client GitHub](https://github.com/googleapis/google-api-nodejs-client) — OAuth2 refresh token handling
- [Anthropic TypeScript SDK docs](https://platform.claude.com/docs/en/api/sdks/typescript) — `maxRetries`, `timeout`, `toolRunner`
- [Prisma Client extensions: RLS example](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security) — canonical `SET LOCAL` pattern
- [iron-session npm](https://www.npmjs.com/package/iron-session) — HMAC-SHA256 + AES seal pattern
- [node-cron v3→v4 migration guide](https://nodecron.com/migrating-from-v3) — breaking changes
- [MSW Node.js integration](https://mswjs.io/docs/integrations/node/) — `setupServer` pattern for Vitest
- [Testcontainers PostgreSQL module](https://node.testcontainers.org/modules/postgresql/) — container lifecycle

### Secondary (MEDIUM confidence — community)

- [Better Stack: Top 10 Node schedulers](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) — node-cron vs Croner comparison
- [LogRocket: Comparing best Node.js schedulers](https://blog.logrocket.com/comparing-best-node-js-schedulers/) — same comparison, more detail
- [Nikola Milovic: Integration testing Node + Vitest + Testcontainers](https://nikolamilovic.com/posts/2025-4-15-integration-testing-node-vitest-testcontainers/) — practical Vitest globalSetup config

### Security (HIGH confidence)

- [CVE-2026-27978: Next.js CSRF](https://www.sentinelone.com/vulnerability-database/cve-2026-27978/) — patched in Next 16.1.7+; current pin (16.2.6) is safe

---

*Stack research for: foray Lean milestone v0.1*
*Researched: 2026-05-09*
*Source priority: npm registry (versions) → official docs (behavior) → community (patterns)*
