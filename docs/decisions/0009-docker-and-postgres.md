# ADR-0009: Docker dual-track + Postgres (flipped from SQLite)

**Status**: Accepted
**Date**: 2026-05-09
**Supersedes**: prior tentative SQLite decision

## Context

Original plan during brainstorming was SQLite-backed Next.js running natively. Owner subsequently asked to support Docker as a deployment/run option for "agent-friendly" reproducibility. Docker reshapes the SQLite advantage:

- SQLite's main win was "no service to install on host". In Docker land, every dependency is a service in compose; Postgres is no harder than SQLite.
- Owner has Postgres muscle memory from eVoyage (Supabase + Prisma).
- Future flip to public deployment (per [ADR-0003](./0003-local-first.md) future trigger) is non-disruptive with Postgres; SQLite would require a migration.

## Decision

### Docker: dual-track

Two paths supported, both documented in [SETUP.md](../../SETUP.md):

- **Path A — Native dev**: `pnpm dev` + only Postgres in Docker. Faster file-watching for daily iteration. Recommended for the project owner.
- **Path B — Full Docker**: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`. Reproducible, one-command setup. Recommended for AI agents and fresh-machine setup.

### Database: PostgreSQL 16

Replaces the tentative SQLite choice. Schema, queries, and Prisma config are written for Postgres from day one.

## Consequences

### Positive

- **Agent-friendly default.** AI agents (Claude Code, Cursor) running on a fresh machine can `docker compose up` and have a working environment without installing Node, Postgres, or any system dependency.
- **Reproducible environments.** Same Postgres version + extensions on every machine. No "works on my Mac" debugging.
- **Future-proof.** Going public requires changing hosting (`vercel deploy` + Neon/Supabase/Railway DB) — zero schema migration. SQLite would have required it.
- **Postgres-only features available.** Full-text search (`tsvector`), JSONB on `Event.data`, advisory locks for cron coordination, etc. Worth having even at v1.
- **Mental-model consistency with eVoyage.** Owner already runs Postgres + Prisma there. Same migration tooling, same Prisma Studio interface.

### Negative

- **Daily-dev still requires Docker for Postgres** (Path A starts a Postgres container). Mitigated: it's one command, runs in the background, takes 2 seconds to start.
- **Docker Desktop on Mac is slightly slower** than bare-metal services. Acceptable for development scale.
- **Two compose files to maintain.** `docker-compose.yml` (production-shaped) + `docker-compose.dev.yml` (override for dev). Mitigated by clear comments + symmetry.

## Compose file shape

`docker-compose.yml` defines `app`, `db` (Postgres 16-alpine), and a profiled `adminer` service. `app` depends on `db` healthcheck (`pg_isready`). DB volume named `foray_db`.

`docker-compose.dev.yml` overrides `app` to use `Dockerfile.dev` (with `pnpm dev` and source-mounted volumes for hot reload) and pass-through env vars (`ANTHROPIC_API_KEY`, `GOOGLE_*`).

## Alternatives rejected

- **SQLite + Docker as alt path only**: internally inconsistent — Docker matters enough to ship but the DB is special. A3 (this decision) is consistent: everything runs in compose.
- **Full Docker only (no native path)**: file-watching across volume mounts is flakier on Mac, slows daily iteration. Native dev preserved as default.
- **Stay on SQLite**: harder migration story, miss Postgres features, doesn't match owner's muscle memory.

## References

- [ADR-0003](./0003-local-first.md) — local-first hosting choice
- [ADR-0002](./0002-multi-tenant-ready.md) — multi-tenant readiness (more natural in Postgres)
