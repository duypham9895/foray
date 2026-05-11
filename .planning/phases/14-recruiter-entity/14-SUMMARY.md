---
phase: 14-recruiter-entity
status: complete
completed: 2026-05-10
tags: [recruiters, contacts, application-linking, rls]
---

# Phase 14: Recruiter Entity Summary

Implemented recruiter contact management and application linking.

## Accomplishments

- Added `/recruiters` for creating, viewing, and editing recruiter records.
- Added `/recruiters/[id]` with contact details and linked forays.
- Added recruiter navigation.
- Added `src/features/recruiters` slice with schemas, RLS-backed queries, services, actions, and UI components.
- Added recruiter linking on application detail pages, including existing recruiter selection and email-based matching to prevent duplicates.
- Added unlink support from application detail pages.
- Added `recruiter_linked` timeline rendering.
- Added integration tests for create/reuse-by-email, update, link, wrong-tenant rejection, and unlink.

## Verification

- `pnpm typecheck` passed.
- `pnpm lint` passed with existing dependency-boundary deprecation warnings.
- `pnpm test:run -- tests/integration/recruiters.test.ts` ran the full suite: 40 files, 490 tests passed, 4 todos.
- `pnpm build` passed with the known Turbopack NFT tracing warning from the classifier budget import path.

## Notes

- No schema migration was needed; recruiter and application-recruiter tables already existed.
- Stabilized an existing Today test fixture that scheduled “today” as two hours from the current time, which failed after 22:00 when that rolled into tomorrow.
