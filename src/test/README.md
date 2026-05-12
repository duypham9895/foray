# Test Infrastructure

Shared test utilities for `foray`. Keep small.

## What lives here

This folder currently holds shared unit-test support only. Keep it small and add helpers here only after at least two test files need the same setup.

- `README.md` — this guidance.
- `src/__mocks__/server-only.ts` — Vitest mock for Next.js server-only imports.

Database integration setup lives in `tests/integration/setup.ts`. Recorded classifier fixtures live in `tests/integration/classifier-fixtures/`.

## Where tests actually live

| Test type | Location |
|---|---|
| Unit (colocated with code) | `src/**/*.test.ts` (preferred) |
| Integration (DB-touching) | `tests/integration/<flow>.test.ts` |
| E2E | `tests/e2e/<flow>.spec.ts` (Playwright, added in Standard milestone) |

See [PRINCIPLES.md §"Testing strategy"](../../PRINCIPLES.md) for the 70/25/5 pyramid, mocking philosophy ("mock at the network seam"), and what to test obsessively (anything touching `userId`, classifier rules, matcher tiebreaks).
