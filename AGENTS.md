# AGENTS.md

Instructions for Codex and other coding agents working in this repository.

<!-- BEGIN:nextjs-agent-rules -->
## This Is Not The Next.js You Know

This project uses Next.js 16. APIs and conventions may differ from older Next.js versions. Before changing App Router code, read the relevant guide in `node_modules/next/dist/docs/`, especially for `page.tsx`, `route.ts`, Server Actions, middleware/proxy behavior, and client/server component boundaries.
<!-- END:nextjs-agent-rules -->

## 1. Project Overview

`foray` is a local-first job-application campaign room for one owner, designed so it can become multi-tenant later. It captures job applications from the web, ingests Gmail updates, classifies recruiting email, and presents a daily dashboard of applications, follow-ups, reminders, documents, and review items.

Main domain concepts:

- **Foray / Application**: one job opportunity being pursued.
- **Campaign**: the user's overall job search effort.
- **Company**: employer attached to one or more applications.
- **Stage**: user-visible workflow label such as "Applied", "Recruiter Screen", or custom stages.
- **Canonical status**: normalized lifecycle status used for analytics and automation (`applied`, `screening`, `interviewing`, `offer`, `rejected`, `withdrawn`).
- **Event**: timeline entry for email updates, stage changes, reminders, notes, document attachments, and system actions.
- **Email ingestion**: Gmail sync stores metadata and excerpts, then matcher/classifier logic decides whether to update an application or send the email to review.
- **Review queue**: low-confidence or ambiguous classifier results that need user approval.
- **Today view**: operational dashboard for stale applications, reminders, interviews, review queue, and daily priorities.
- **Documents**: local file storage for resume, cover letter, and related application artifacts.

Important architecture:

- The app follows **Vertical Slice Architecture**. Business capabilities live under `src/features/<feature>/`; cross-cutting code lives under `src/core/`; shared UI primitives live under `src/ui/`.
- `src/app/**` should stay thin. Pages and route handlers validate/route/delegate to feature code.
- Database access must preserve tenant readiness. Use `tenantDb(userId)` for tenant-scoped queries and `withRls(...)` for multi-statement or raw SQL flows. Direct Prisma usage outside `src/core/db/**` is forbidden by dependency rules.
- Services return `Result<T, AppError>` from `neverthrow` for expected failures. Do not throw for validation, authorization, missing records, or external-service failures.
- Zod validation belongs at system boundaries: forms, Server Actions, API routes, external payloads, env parsing, and LLM responses.
- Gmail/email privacy matters. Do not store full email bodies indefinitely; store metadata plus short excerpts and fetch full content on demand.

Read these before significant edits:

- `PRINCIPLES.md` - strategic architecture and TypeScript/error-handling rules.
- `CLAUDE.md` - tactical conventions that still contain useful project history.
- `DESIGN.md` - product tone, UI rules, and visual constraints.
- `docs/codex-workflow.md` - practical Codex workflow and git/verification hygiene.
- `docs/architecture.md` - system/data-flow overview.
- `docs/data-model.md` - entity semantics, especially `canonicalStatus` vs `currentStage`.
- `docs/decisions/*.md` - ADRs for architectural decisions.
- `.planning/ROADMAP.md` and `.planning/STATE.md` - current phase context. Treat `.planning/ROADMAP.md` as more reliable when planning docs disagree.

## 2. Tech Stack

- **Language**: TypeScript 5 with strict compiler settings.
- **Framework**: Next.js 16 App Router, React 19.
- **Package manager**: pnpm.
- **Styling/UI**: Tailwind CSS v4, local primitives in `src/ui`, Radix UI where needed, lucide-react for functional icons, next-intl for localization.
- **Database**: PostgreSQL, Prisma 7, generated client under `src/generated/prisma`, runtime adapter `@prisma/adapter-pg` with `pg`.
- **Auth**: local single-user password/session helpers, intentionally replaceable later.
- **External services**: Gmail API / Google OAuth, Anthropic SDK plus optional OpenAI Responses API for classifier fallback work.
- **Background work**: node-cron and route-triggered cron/polling code.
- **Testing**: Vitest, React Testing Library, Testcontainers PostgreSQL for integration tests, Playwright for E2E.
- **Static/content docs**: Markdown content under `content/`, `docs/`, and landing documentation.
- **Deployment/local ops**: Dockerfile, Docker Compose, GitHub Actions.

## 3. Repository Structure

Key folders and files:

- `src/app/` - Next.js App Router pages, layouts, API route handlers, and thin route composition.
- `src/features/` - vertical slices such as `analytics`, `applications`, `auth`, `calendar`, `classifier`, `documents`, `inbox`, `matcher`, `recruiters`, `search`, `settings`, `shortcuts`, and `today`.
- `src/core/` - cross-cutting infrastructure: auth, cron, crypto, database access, env validation, errors, logging, types, and shared query helpers.
- `src/ui/` - shared design-system primitives.
- `src/components/` - app shell and shared app-level components.
- `src/i18n/` and `messages/` - localization setup and message catalogs.
- `src/generated/prisma/` - generated Prisma client. Regenerate; do not hand-edit.
- `prisma/` - Prisma schema and migrations.
- `scripts/` - seed, bookmarklet build, E2E reset, and utility scripts.
- `tests/integration/` - Vitest integration tests, mostly with real PostgreSQL through Testcontainers.
- `tests/e2e/` - Playwright tests.
- `bookmarklet/` and `public/foray-bookmarklet-url.json` - bookmarklet source/build artifact.
- `content/`, `docs/`, `landing/` - public docs, guide content, ADRs, milestone docs, and landing material.
- `.planning/` - historical/current planning state from prior Claude/GSD workflow.
- `.github/workflows/` - CI and Pages deployment workflows.
- `.claude/` - Claude-specific hooks/settings. Useful context, but Codex should not depend on those hooks running.

Avoid changing unless explicitly asked:

- `.env`, `.env.local`, and any secret-bearing local files.
- `node_modules/`, `.next/`, coverage/output directories, and generated build artifacts.
- `src/generated/prisma/**`; run Prisma generation instead.
- Existing committed migrations. Create a new migration for schema changes rather than editing migration history.
- Public API contracts, auth/session behavior, Gmail OAuth behavior, deployment/CI infrastructure, or database schema unless the task clearly requires it.
- Large planning/history files in `.planning/` unless the task is about roadmap or phase tracking.

## 4. Setup & Development

Install:

```bash
pnpm install
```

Environment:

- Start from `.env.example`.
- Use `.env.local` for native development or `.env` for Docker Compose workflows.
- Required variables include `DATABASE_URL`, `APP_PASSWORD`, `APP_SESSION_SECRET`, `ENCRYPTION_KEY`, and `ANTHROPIC_API_KEY`.
- Gmail integration uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- Never print or copy real secret values into commits, logs, or chat responses.

Native local development:

```bash
docker compose up -d db
pnpm db:migrate
pnpm seed
pnpm dev
```

Full Docker development:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Common checks:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Formatting:

- There is no standalone format script in `package.json`.
- Follow the existing code style and rely on TypeScript/ESLint feedback.

## 5. Coding Conventions

File and naming conventions:

- Files use kebab-case, for example `gmail-poller.ts`.
- React components use PascalCase and usually one component per file.
- Functions use camelCase verb phrases, for example `classifyEmail`.
- Types use PascalCase with no `I` prefix.
- Database enum values use lowercase snake case.
- API routes should be noun resources unless the route is genuinely action-shaped.

Imports:

- Use the `@/` alias for `src/` imports.
- Avoid deep relative imports beyond one level.
- Keep import order as external packages, `@/` aliases, relative imports, then type-only imports.
- Do not import Prisma client directly outside `src/core/db/**`.
- Prisma 7 client imports come from `@/generated/prisma/client`, not `@prisma/client`.

Feature organization:

- New capabilities belong in `src/features/<feature>/`.
- Server Actions belong in feature-level `actions.ts`.
- Business logic belongs in feature-level `service.ts`.
- Tenant-scoped reads belong in feature-level `queries.ts`, using `tenantDb(userId)`.
- Slice-specific schemas belong in feature-level `schema.ts`.
- Cross-cutting schemas belong in `src/core/schemas/` only when truly shared.
- UI used by one feature should stay in that feature's `components/` folder.
- Shared primitives belong in `src/ui/`.

API and service patterns:

- Route Handlers in `src/app/api/**/route.ts` are for cross-origin endpoints, webhooks, extension/bookmarklet endpoints, and non-form clients.
- Server Actions are for same-origin UI mutations.
- Validate input with Zod before calling services.
- Check authorization/session at the boundary.
- Services return `Result<T, AppError>`.
- Convert service results to UI/action/API responses at the boundary.

Error handling and logging:

- Expected failures are `AppError` values, not thrown exceptions.
- Add new error variants in `src/core/errors/index.ts` when needed.
- Use structured logging through the existing logger.
- `console.*` is disallowed in `src` by lint.
- Do not log credentials, session secrets, tokens, raw OAuth payloads, or full email bodies.

UI conventions:

- Server Components by default; add `'use client'` only at interactive leaves.
- Client component props must be serializable.
- Follow `DESIGN.md`: quiet campaign-room UI, no decorative emoji/icons in app chrome, restrained color, rejection states as neutral gray rather than alarming red.
- Prefer existing `src/ui` primitives and established layout patterns before adding new abstractions.
- Localized visible copy should go through the message catalogs when the surrounding feature uses next-intl.

## 6. Testing Guidance

Frameworks:

- Unit and integration tests use Vitest.
- React tests use Testing Library.
- Integration tests use Testcontainers PostgreSQL.
- E2E tests use Playwright.

Where tests live:

- Colocate unit tests beside source files as `*.test.ts` or `*.test.tsx`.
- Cross-slice/database tests live in `tests/integration/`.
- Browser workflow tests live in `tests/e2e/`.
- Shared test setup and factories live under `src/test/` and `tests/`.

Targeted test examples:

```bash
pnpm test:run -- src/features/classifier/service.test.ts
pnpm test:run -- tests/integration/capture.test.ts
pnpm e2e -- tests/e2e/smoke.spec.ts
```

Before PR or commit-worthy completion, run when possible:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Testing expectations:

- Pure business logic gets unit tests.
- Database behavior, RLS/tenant safety, migrations, and cross-slice flows get integration tests.
- Critical user journeys get Playwright coverage.
- Route Handlers should cover method validation, auth, content type/body validation, success cases, and expected error cases.
- Server Actions should cover schema validation, auth behavior, service delegation, and returned action state.

Integration test gotchas:

- Docker must be running for Testcontainers.
- On Docker Desktop, `DOCKER_HOST=unix://$HOME/.docker/run/docker.sock pnpm test:run` may be needed if the default socket is unavailable.
- Integration setup applies all migrations to a disposable PostgreSQL 16 container and switches tests to a non-superuser database role.

## 7. Working Rules For Codex

- Start every task by checking `git status --short --branch --untracked-files=all`. The worktree may contain user or prior-agent WIP.
- Inspect relevant files before editing. For unfamiliar Next.js APIs, inspect `node_modules/next/dist/docs/` first.
- Preserve user changes. Do not revert, restage, or overwrite unrelated modifications.
- Keep changes minimal and focused on the requested task.
- Do not modify application code for documentation-only tasks.
- Do not introduce new dependencies without explaining why they are necessary and why existing tools are insufficient.
- Do not change public APIs, migrations, auth/session behavior, Gmail OAuth, payment-like flows, deployment files, or infrastructure without an explicit request.
- Do not bypass classifier confidence thresholds. Low-confidence classification should go to the review queue.
- Do not store full email bodies indefinitely.
- Prefer existing project patterns over new abstractions.
- Add tests for new behavior or bug fixes when feasible.
- Run lint, typecheck, tests, and build after code changes when possible. If not possible, state why.
- Summarize changed files and verification steps after every task.
- If committing is requested, use present-tense, verb-led commit messages such as `add extension token rotation` or `fix matcher reply-prefix handling`.

## 8. Known Risks / Gotchas

- Some documentation is historical. `.planning/ROADMAP.md` is the current roadmap source, while README and milestone docs may lag.
- The active roadmap context on 2026-05-11 is v0.4 Future: Phase 17 is complete and the next scope is TBD.
- `extension/` exists and contains the WXT Chrome MV3 extension. Older docs may still describe it as planned or in progress.
- `docs/architecture.md` and `docs/data-model.md` can lag the schema. Confirm against `prisma/schema.prisma` before making model assumptions.
- Prisma 7 uses `prisma.config.ts` for the datasource URL and requires the runtime adapter pattern already established in `src/core/db/client.ts`.
- Generated Prisma files under `src/generated/prisma/` should not be hand-edited.
- The app uses local system font stacks instead of `next/font/google`, so production builds should not need network access for font fetching.
- The build currently emits a Turbopack NFT tracing warning through the classifier budget import path; the build still passes. Treat new warning classes as suspicious, but do not assume this known warning is caused by your change.
- ESLint/dependency-cruiser boundary rules are intentional. If they block a change, rethink the slice boundary before weakening rules.
- Testcontainers requires local Docker access. CI and local sandbox behavior may differ.
- Real secrets may exist in local env files. Do not print them.
- Claude/GSD planning artifacts are useful context, but they are not executable Codex workflow. Convert their useful content into normal repo docs when needed.

## 9. Useful Commands

Development:

```bash
pnpm dev                  # start Next.js dev server
pnpm build                # production build
pnpm start                # start production server after build
pnpm install              # install dependencies
```

Quality:

```bash
pnpm lint                 # ESLint over src, tests, and config files
pnpm typecheck            # TypeScript no-emit check
pnpm test                 # Vitest watch mode
pnpm test:run             # Vitest single run
pnpm e2e                  # Playwright tests
pnpm e2e:ui               # Playwright UI mode
pnpm depcheck             # dependency-cruiser architecture checks
pnpm depcheck:graph       # write dependency graph to dependency-graph.dot
```

Database:

```bash
pnpm db:migrate           # prisma migrate dev
pnpm db:reset             # prisma migrate reset
pnpm db:studio            # Prisma Studio
pnpm db:generate          # Prisma generate
pnpm seed                 # seed demo data
pnpm prisma migrate deploy # apply migrations in prod-shaped environments
```

Docker:

```bash
docker compose up -d db
docker compose up
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit
docker compose logs api --tail=200
docker compose ps
```

Project utilities:

```bash
pnpm build:bookmarklet    # build bookmarklet URL artifact
pnpm e2e:reset-db         # reset E2E database state
tsx scripts/seed.ts       # run seed script directly
tsx scripts/e2e-reset-db.ts # run E2E reset directly
```
