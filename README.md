# foray

> A campaign room for your job hunt. Not a tracker — a place you walk into every morning to see what's moving and decide your next move.

---

## The name

**foray** — *noun. a sudden raid or military advance; an attempt or initial venture into a particular activity or area.*

Every job application is a foray. A deliberate, time-bounded venture into a new
company. Some are quick scouts — apply, get auto-rejected, move on. Some
become campaigns that run for weeks across five interview rounds. Some get
ghosted in silence.

This tool exists to give you a single command center for all of them at once:
where you've gone, what came back, what's still open, and what to do today.

It's not a tracker. A tracker is passive — you log things into it. **foray** is
a campaign room. You walk in every morning, see what's moving, decide your next
move, walk out.

---

## What it does

- **Captures** new applications via bookmarklet (or Chrome extension at v1-Full) — one click on any job page → application logged with company, role, URL, JD, salary range
- **Ingests** Gmail automatically — polls every 15 minutes, classifies emails (rejection, interview invite, recruiter outreach, noise), updates application status when confidence is high, surfaces ambiguous cases in a small daily review queue
- **Models reality** — every company runs interviews differently, so each application has a flexible per-application stage timeline alongside a canonical status enum for global views
- **Surfaces today** — dashboard shows what needs your attention: today's interviews, stale applications (no movement >7 days), unreviewed emails, this-week summary
- **Stays out of your way** — runs locally, no auth UI, no SaaS subscription, your data stays on your laptop

---

## Quick start

**Path A — Native (fast, recommended for daily dev):**

```bash
pnpm install
cp .env.example .env.local
docker compose up -d db          # only Postgres in Docker
pnpm prisma migrate dev
pnpm dev                          # → http://localhost:3000
```

**Path B — Full Docker (reproducible, recommended for fresh setup or AI agents):**

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
# → http://localhost:3000
```

Full setup (including Gmail OAuth and Anthropic API key) is in **[SETUP.md](./SETUP.md)**.

---

## Architecture in one paragraph

Next.js 16 (App Router) on the front, serving a Postgres-backed Prisma schema. A cron-driven Gmail watcher polls your inbox every 15 minutes, runs each new email through a rules-first classifier (regex patterns for templated rejection / interview / recruiter language) and falls back to Claude Haiku for ambiguous cases. High-confidence classifications auto-update application status; ambiguous ones land in a review queue that's typically 0–3 items per day. A bookmarklet (and later a native Chrome MV3 extension) captures new applications by POSTing to `/api/capture`. Browser-side runs Tailwind v4 + shadcn primitives — responsive enough to use on phone over a tunnel, optimized for laptop daily use. Single-user mode for now; multi-tenant-ready schema (every record has `userId`) so a future flip to public requires a database migration but no schema rewrite.

---

## Roadmap (milestones)

| Milestone | Status | Scope |
|-----------|--------|-------|
| **Lean** | ⏳ Not started | Manual entry + Gmail polling + classifier + review queue + applications list/detail |
| **Standard** | ⏳ Pending Lean | + Bookmarklet capture + "Today" dashboard + tags + search |
| **Full** | ⏳ Pending Standard | + Native Chrome MV3 extension + document storage + recruiter entity + Google Calendar sync + analytics + follow-up reminders |

See **[docs/milestones/](./docs/milestones/)** for each milestone's checklist and acceptance criteria.

---

## Tech stack

- **Runtime**: Next.js 16 (App Router) + TypeScript 5
- **UI**: Tailwind CSS v4 + shadcn/ui primitives + lucide-react
- **DB**: PostgreSQL 16 via Prisma 7
- **LLM**: Claude Haiku via Anthropic SDK (classifier fallback only)
- **Email**: Gmail API via googleapis SDK
- **Tests**: Vitest (unit + integration) + Playwright (E2E, added at Standard milestone)
- **Container**: Docker + Docker Compose (dual-track: native dev + full-Docker dev)

---

## Documentation map

For humans:
- **[README.md](./README.md)** — this file
- **[SETUP.md](./SETUP.md)** — step-by-step install + Gmail OAuth + Anthropic key
- **[DESIGN.md](./DESIGN.md)** — UI/UX principles ("campaign room, not robotic dashboard")

For agents:
- **[AGENTS.md](./AGENTS.md)** — file layout, conventions, extension points, critical commands
- **[CLAUDE.md](./CLAUDE.md)** — project rules (Karpathy guidelines, testing, naming)

For both:
- **[docs/architecture.md](./docs/architecture.md)** — system diagram + data flow
- **[docs/data-model.md](./docs/data-model.md)** — entity relationships + canonical_status semantics
- **[docs/decisions/](./docs/decisions/)** — ADRs (one per design decision)
- **[docs/milestones/](./docs/milestones/)** — Lean / Standard / Full deliverables

---

## License

Personal use. Not licensed for redistribution. Source available for reference; please don't fork-and-publish without asking.

Built by [Duy Phạm](mailto:duypham9895@gmail.com) with Claude Code.
