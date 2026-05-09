# ADR-0003: Local-first, no public deployment in v1

**Status**: Accepted
**Date**: 2026-05-09

## Context

Tradeoff between deploying to Vercel from day one vs. running locally only.

The owner is actively job hunting, which is the binding time constraint. Public deployment would require: domain (or just Vercel URL), real auth, privacy policy, Gmail OAuth verification (CASA security assessment for `gmail.readonly` scope), terms of service, support burden once others discover it. All of that competes with job-hunt hours.

## Decision

`foray` runs locally on the owner's laptop only (`localhost:3000`). No public deployment in v1. Multi-tenant-ready schema (per [ADR-0002](./0002-multi-tenant-ready.md)) preserves the option to flip to public later.

## Consequences

### Positive

- **No infra burden.** No Vercel project, no Postgres host bill, no domain, no SSL, no auth provider account, no Gmail OAuth verification paperwork.
- **No legal exposure.** Owner's own data only — no GDPR, no privacy policy, no breach plan.
- **Job-hunt focus preserved.** Hours go into using the tool, not maintaining the tool.

### Negative

- **No mobile access by default.** Mitigated: responsive UI works in laptop browser at any width; if mobile-on-the-go matters later, owner can run a Tailscale tunnel without code changes.
- **Laptop must be running for cron polling.** When laptop is closed, Gmail isn't being polled. Acceptable for v1 — emails arrive on next start. (When this becomes a real friction, it's the trigger to revisit deployment.)
- **No data redundancy.** If Mac dies, foray data is gone. Mitigation: `pg_dump` to a Backblaze/Time Machine target on a schedule (manual for now; automate at Standard milestone).

## Alternatives rejected

- **Deploy to Vercel from day one with password gate.** Was the original plan; flipped after pushback that v1 doesn't need it. Reversible — when the time comes, infra setup is ~1 day.
- **Local-only with SQLite (no Docker).** Originally suggested but flipped to Postgres-in-Docker at [ADR-0009](./0009-docker-and-postgres.md). SQLite saved nothing once Docker was introduced.

## Triggers to revisit

- Owner travels for interviews and wants to check from hotel
- Multiple sustained "I wish I had this on my phone" moments
- Job hunt extends >2 months → side-project becomes worth deploying

## References

- [ADR-0002](./0002-multi-tenant-ready.md) — multi-tenant readiness preserves the future flip
- [ADR-0009](./0009-docker-and-postgres.md) — Docker + Postgres choice
