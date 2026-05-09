<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Contract — `foray`

If you are an AI agent (Claude Code, Cursor, GitHub Copilot, anything similar) reading this file, this is your contract for working in this repository. Read it once at the start of every session. Re-read it when you encounter unfamiliar conventions.

## What `foray` is

A personal job-application tracker that ingests Gmail, classifies emails, and gives the (single) user a daily campaign-room dashboard. Local-only, runs on the owner's laptop, multi-tenant-ready schema for a future public flip. See [README.md](./README.md) for the full pitch.

## Read these before writing any code

1. **[PRINCIPLES.md](./PRINCIPLES.md)** — *strategic* rulebook. Architecture (Vertical Slice), TypeScript discipline, error handling (`Result<T, AppError>`), multi-tenant safety (`tenantDb`), code review checklist. **The most important file in the repo.** Re-read at session start.
2. **[CLAUDE.md](./CLAUDE.md)** — *tactical* rules (Karpathy guidelines, testing, naming, commit style). Non-negotiable.
3. **[docs/architecture.md](./docs/architecture.md)** — system diagram and data flow.
4. **[docs/data-model.md](./docs/data-model.md)** — entity relationships and the `canonical_status` vs `current_stage` semantics. The data model is load-bearing; misunderstanding it will cause cascading bugs.
5. **The relevant ADR** in [docs/decisions/](./docs/decisions/) — every architectural decision has an ADR. Before changing one, read the ADR that established it.
6. **The current milestone doc** in [docs/milestones/](./docs/milestones/) — defines what's in scope for the current sprint.

## File layout (Vertical Slice Architecture — see ADR-0010 + PRINCIPLES.md §Architecture)

```
foray/
├── README.md, AGENTS.md, CLAUDE.md, SETUP.md, DESIGN.md   ← root docs (read these)
├── PRINCIPLES.md                                          ← ⭐ the rulebook
├── package.json, tsconfig.json, next.config.ts            ← config (don't touch unless needed)
├── eslint.config.mjs, postcss.config.mjs                  ← lint/style
├── .dependency-cruiser.cjs                                ← module boundary rules (CI-enforced)
├── prisma.config.ts                                       ← Prisma 7 config (URL, seed)
├── Dockerfile, Dockerfile.dev                             ← container build
├── docker-compose.yml, docker-compose.dev.yml             ← service orchestration
│
├── prisma/
│   ├── schema.prisma                                      ← database schema (source of truth)
│   └── migrations/                                        ← Prisma migrations (auto-generated)
│
├── src/
│   ├── app/                                               ← Next.js App Router (THIN — delegate to slices)
│   │   ├── layout.tsx, page.tsx                           ← root + Today dashboard
│   │   ├── applications/                                  ← pages (list, detail, new)
│   │   ├── inbox/                                         ← page (review queue)
│   │   ├── settings/                                      ← page
│   │   └── api/
│   │       ├── capture/route.ts                           ← bookmarklet/extension POST (Route Handler)
│   │       ├── gmail/                                     ← OAuth callback + cron poll
│   │       └── cron/                                      ← scheduled triggers
│   │
│   ├── features/                                          ← ⭐ Vertical slices. One folder per capability.
│   │   ├── applications/
│   │   │   ├── actions.ts                                 ← Server Actions (validate → authorize → service)
│   │   │   ├── service.ts                                 ← business logic, returns Result<T, AppError>
│   │   │   ├── queries.ts                                 ← Prisma reads via tenantDb
│   │   │   ├── schema.ts                                  ← Zod input/output schemas
│   │   │   └── components/                                ← UI used ONLY by this slice
│   │   ├── capture/                                       ← bookmarklet/extension capture
│   │   ├── classifier/                                    ← rules + LLM hybrid
│   │   ├── matcher/                                       ← email → application matching
│   │   ├── inbox/                                         ← Gmail sync + review queue
│   │   └── auth/                                          ← single-user gate (Clerk-replaceable)
│   │
│   ├── core/                                              ← Cross-cutting (KEEP SMALL — see PRINCIPLES.md)
│   │   ├── db/                                            ← Prisma client singleton + tenantDb wrapper
│   │   ├── logger/                                        ← pino + request context (AsyncLocalStorage)
│   │   ├── errors/                                        ← AppError taxonomy + Result re-export
│   │   ├── types/                                         ← branded IDs (UserId, ApplicationId)
│   │   └── auth/                                          ← session helpers (requireUser)
│   │
│   ├── ui/                                                ← shared design-system primitives (Button, Input, Card)
│   │
│   ├── generated/                                         ← ⚠️ generated by `pnpm prisma generate`, gitignored
│   │   └── prisma/                                        ←   import: `@/generated/prisma/client`
│   │
│   └── test/                                              ← factories (fishery), DB helpers, fixtures
│
├── extension/                                             ← Chrome MV3 extension (Full milestone)
├── bookmarklet/                                           ← bookmarklet source (Standard milestone)
│
├── docs/
│   ├── architecture.md, data-model.md
│   ├── decisions/                                         ← ADRs (numbered, immutable history)
│   └── milestones/                                        ← Lean, Standard, Full
│
├── scripts/
│   └── seed.ts                                            ← demo data for `pnpm seed`
│
└── tests/
    ├── unit/                                              ← Vitest unit (colocated preferred: src/**/*.test.ts)
    ├── integration/                                       ← Vitest + real Postgres
    └── e2e/                                               ← Playwright (added at Standard)
```

## Module boundary rules (enforced by `dependency-cruiser` in CI)

1. **No circular dependencies.**
2. **Slice isolation.** `features/applications/**` cannot import from `features/classifier/**`. Cross-slice sharing goes in `core/`.
3. **`core/` is a leaf.** Anyone may import from `core/`; `core/**` cannot import from `features/**` or `app/**`.
4. **`app/` is the only thing that imports from `next/*` page-level APIs.** (`notFound()`, `redirect()`, etc.)
5. **No `prisma` imports outside `src/core/db/`.** Forces every query through `tenantDb`. *This rule prevents multi-tenant leaks.*

## Conventions

### Where new things go

| You're adding... | It goes in... |
|---|---|
| A new feature (capability) | New folder `src/features/<feature>/` with `actions.ts`, `service.ts`, `queries.ts`, `schema.ts`, `components/` |
| A Server Action | `src/features/<feature>/actions.ts` |
| Business logic | `src/features/<feature>/service.ts` (returns `Result<T, AppError>`) |
| A Prisma read | `src/features/<feature>/queries.ts`, **always** via `tenantDb(userId)` |
| A Zod schema (slice-specific) | `src/features/<feature>/schema.ts` |
| A Zod schema (cross-cutting) | `src/core/schemas/<topic>.ts` |
| A new entity (e.g., `Note`, `Tag`) | `prisma/schema.prisma` → migrate → use via `tenantDb` |
| A new API route (cross-origin endpoint) | `src/app/api/<resource>/route.ts` (Route Handler) |
| A new page | `src/app/<route>/page.tsx` (delegates to slice) |
| A UI component used only by one slice | `src/features/<feature>/components/<name>.tsx` |
| A shared design-system primitive | `src/ui/<name>.tsx` |
| A util function used by 2+ slices | `src/core/<topic>/index.ts` (genuinely cross-cutting) |
| A util function used in 1 place | Colocate inline; only extract when reused |
| A test for `src/features/foo/service.ts` | `src/features/foo/service.test.ts` (colocated) |
| A test that crosses slices | `tests/integration/<flow>.test.ts` (real Postgres) |
| A factory for testing | `src/test/factories.ts` (fishery) |
| A new env var | Add to `.env.example` with comment + Zod-validate in `src/core/env.ts` |
| A new error variant | Add to `AppError` union in `src/core/errors/index.ts` |
| A new branded ID type | Add to `src/core/types/ids.ts` |
| A new architectural decision | New ADR in `docs/decisions/<NNNN>-<title>.md` |
| A milestone deliverable update | Edit the relevant file in `docs/milestones/` |

### Naming

- **Files**: kebab-case (`gmail-poller.ts`, not `gmailPoller.ts`)
- **React components**: PascalCase, one component per file (`<ApplicationCard />` in `application-card.tsx`)
- **Functions**: camelCase, verb phrases (`classifyEmail`, not `emailClassifier`)
- **Types**: PascalCase, no `I` prefix (`Application`, not `IApplication`)
- **Enums in DB**: lowercase snake (`canonical_status` enum values: `applied`, `screening`, `interviewing`, `offer`, `rejected`, `withdrawn`)
- **API routes**: noun resources (`/api/applications`), verbs only when truly action-shaped (`/api/capture`, `/api/classify`)

### Imports

- Use `@/` alias for `src/` imports — never relative paths beyond one level (`../foo` ok, `../../../foo` not)
- Sort: external → `@/` aliases → relative → types-only (TS will help)

## Prisma 7 reminders

- **Schema URL is in `prisma.config.ts`**, not `schema.prisma` (Prisma 7 breaking change).
- **PrismaClient imports come from `@/generated/prisma/client`**, not `@prisma/client`. The legacy path is broken under pnpm in Prisma 7.
- **Runtime requires an adapter**: instantiate as `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`. The canonical pattern is already in `src/core/db/client.ts`. Import via `import { prisma } from '@/core/db'` (and prefer `tenantDb(userId)` from the same module for tenant-scoped queries — see PRINCIPLES.md §"Database").

## Critical commands

```bash
# Development
pnpm dev                    # native dev server, hot reload (default Path A)
pnpm test                   # vitest watch mode
pnpm test:run               # vitest single run (CI mode)
pnpm build                  # production build (must pass before commit)
pnpm lint                   # ESLint check
pnpm typecheck              # tsc --noEmit

# Database
pnpm prisma migrate dev     # create migration from schema changes (dev only)
pnpm prisma migrate deploy  # apply migrations (prod-shaped, no prompts)
pnpm prisma studio          # open DB GUI at http://localhost:5555
pnpm seed                   # populate demo data (calls scripts/seed.ts)

# Docker (Path B)
docker compose up -d db     # start only Postgres (for Path A native dev)
docker compose up           # start app + db (production-like)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up   # full Docker dev

# Pre-commit (always run)
pnpm lint && pnpm typecheck && pnpm test:run && pnpm build
```

## Default workflow for any change

1. **Read** [CLAUDE.md](./CLAUDE.md) (Karpathy 4 rules) and the relevant ADR.
2. **State assumptions** in your response before writing code. Surface ambiguities. Push back if the request seems wrong.
3. **Write tests first** when adding a feature or fixing a bug (TDD — see CLAUDE.md testing rules).
4. **Make the change** with surgical scope — touch only what was asked. Don't reformat or refactor adjacent code.
5. **Run pre-commit checks**: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build`. All must pass.
6. **Update docs** if the change touches: schema (→ data-model.md), architecture (→ architecture.md), or a decision (→ new ADR).
7. **Commit** with a present-tense verb-led message: `add Gmail polling cron`, `fix matcher false-positive on subject reply prefix`.

## Things to never do

- **Don't add features the user didn't ask for.** No "while I was here, I also..." — flag, don't act.
- **Don't ship commented-out code** or `// TODO: implement later` blocks. Either implement or open an issue/ADR.
- **Don't add error handling for impossible cases.** Validate at boundaries (user input, external APIs); trust internal calls.
- **Don't write multi-paragraph docstrings.** One-line if needed; prefer good naming over comments.
- **Don't break the multi-tenant readiness** — every new model with user-owned data must have a `userId` field, even though we only have one user today.
- **Don't bypass the classifier confidence threshold** — if the rules give 0.6 confidence, route to review queue; don't auto-update.
- **Don't store full email bodies indefinitely** — store metadata + body excerpt (~500 chars); fetch full via Gmail API on demand. (Privacy + storage cost.)

## When you're stuck

1. Re-read this file and CLAUDE.md.
2. Check the most recent ADR for relevant context.
3. Look at how the closest existing pattern handles it (e.g., a similar API route).
4. If still stuck: write a one-paragraph summary of what you tried, what failed, and your best two guesses, and stop. Don't keep flailing.

## When this contract is wrong

If you find AGENTS.md tells you to do something that conflicts with the codebase reality (a path that doesn't exist, a command that fails, a convention that no file actually follows), **fix this file**. The contract should match the code. If you can't fix it because you're not authorized: write a note in your response and surface the contradiction to the user.
