# Test Infrastructure

Shared test utilities for `foray`. Keep small.

## What lives here

- `factories.ts` — `fishery` factories for entities (Lean milestone)
- `db.ts` — Postgres test helpers (transaction-rollback wrapper, seeding helpers)
- `fixtures/` — recorded fixtures for classifier inputs (real email subjects/bodies, anonymized)
- `msw-handlers.ts` — `msw` handlers for Gmail + Anthropic (mock at network seam, not function seam)

## Where tests actually live

| Test type | Location |
|---|---|
| Unit (colocated with code) | `src/**/*.test.ts` (preferred) |
| Integration (DB-touching) | `tests/integration/<flow>.test.ts` |
| E2E | `tests/e2e/<flow>.spec.ts` (Playwright, added in Standard milestone) |

See [PRINCIPLES.md §"Testing strategy"](../../PRINCIPLES.md) for the 70/25/5 pyramid, mocking philosophy ("mock at the network seam"), and what to test obsessively (anything touching `userId`, classifier rules, matcher tiebreaks).
