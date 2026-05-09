---
phase: "02-applications-slice-manual-tracker"
plan: "02"
subsystem: "applications-service"
tags: ["service", "queries", "with-rls", "status-regression", "undo", "phase-4-contract", "capt-03", "app-03"]
dependency_graph:
  requires:
    - "02-01 (eventDataSchemas with emailId in autoStatusChangedData.strict() shape; createApplicationSchema)"
    - "01-02 (withRls helper, branded ID types, errors taxonomy)"
    - "01-03 (Testcontainers + foray_app role + RLS policies)"
  provides:
    - "createApplication(userId, input) — CAPT-03 contract: 1 Application + 1 Event in one withRls tx"
    - "applyManualStatusChange(userId, appId, newStatus) — APP-03 status dropdown service contract; bypasses regression block"
    - "applyAutoStatusChange(userId, appId, change) — Phase 4 hard contract; STATUS_REGRESSION_REQUIRES_REVIEW guard at the service layer"
    - "undoStatusChange(userId, eventId) — Phase 4 hard contract; restores status, marks original undoneAt, sets Email.reviewedByUser"
    - "isStatusRegression(prev, next) + STATUS_RANK — pure helper; consumed by service.ts AND Phase 4 inbox/act stage"
    - "findApplicationsForList / findApplicationDetail / countApplicationsByStatus — read queries for Plan 04 Server Components"
  affects:
    - "02-03 (stages + notes services build on the same withRls + Event(stage_added/note_added) pattern; integration tests piggyback on the same Testcontainers fixture)"
    - "02-04 (Server Actions wrap createApplication + applyManualStatusChange; pages call findApplications* queries)"
    - "Phase 4 inbox/act stage will import { applyAutoStatusChange, undoStatusChange, isStatusRegression } as a one-line wire-up"
tech_stack:
  added: []
  patterns:
    - "Throw-bridge inside withRls: `throw new Error('NOT_FOUND:...')` aborts the tx (Prisma rolls back); a small translator on the way out maps tagged Db errors to the intended AppError variant. Documented as known small-surface risk T-02-02-09."
    - "eventDataSchemas[type].parse() on every Event.data write — Phase 4 strict() contract (incl. emailId) is the single source of truth; no post-parse spread."
    - "Cleanup helper that preserves seeded fixtures (Alice Test Role + Alice Corp) so other integration test files (rls-escape, tenant-db-cross-tenant-leak) keep their assertions green."
key_files:
  created:
    - path: "src/features/applications/status-transitions.ts"
      lines: 52
      note: "isStatusRegression + STATUS_RANK + TERMINAL_STATUSES set. 8-line core function. Two exports."
    - path: "src/features/applications/status-transitions.test.ts"
      lines: 151
      note: "53 tests: 1 rank-shape + 16 named cases (R1-R16) + 36-cell parameterized matrix (R17 via it.each)."
    - path: "src/features/applications/service.ts"
      lines: 335
      note: "Four async exports + AutoStatusChange type + private translateThrowBridge helper. Zero direct prisma. references."
    - path: "src/features/applications/service.test.ts"
      lines: 600
      note: "20 integration tests against Testcontainers Postgres with FORCE RLS active. Cleanup preserves seeded fixture rows."
    - path: "src/features/applications/queries.ts"
      lines: 167
      note: "Three read queries + 3 exported types (ApplicationListItem, ApplicationDetail, ListSort). Zero direct prisma."
  modified: []
decisions:
  - "Did NOT modify tenant.ts even though it currently lacks groupBy on application. queries.countApplicationsByStatus uses tx.application.groupBy directly inside withRls (which is the documented pattern in CONTEXT.md §code_context — 'tenantDb may need extension OR read via withRls if simpler'). Chose withRls path: zero changes to tenant.ts surface, pre-existing tenantDb tests stay green."
  - "Throw-bridge string protocol uses literal prefix 'NOT_FOUND:' and 'CONFLICT:' rather than typed sentinel error classes. Plan-suggested approach; matches the threat-model T-02-02-09 risk acceptance. If Plan 03 adds another caller of this pattern, revisit (typed sentinel = ~10 LOC; string prefix = inline at call site, no extraction)."
  - "Test-file cleanup preserves rows that match the seed signature (roleTitle='Alice Test Role', companyName='Alice Corp') instead of TRUNCATE-ing alice's whole subtree. Reason: rls-escape.test.ts and tenant-db-cross-tenant-leak.test.ts assert that alice has ≥1 application — if we wipe alice's data after our last test, those files fail when run after this one. Surgical fix: cleanup only affects rows we created."
  - "Conditionally include each optional field in the auto_status_changed eventDataInput object before `.parse()` (instead of unconditional inclusion + `undefined`). Reason: the schema's `.strict()` rejects unknown keys, and `.optional()` accepts `undefined` — but explicit conditional inclusion makes the intent ('these are optional, only include when supplied') visible at the call site and avoids the need to remember which schema variants accept `undefined` vs reject it."
metrics:
  duration_seconds: 554
  completed_date: "2026-05-09"
  tasks_completed: 3
  files_created: 5
  files_modified: 0
requirements_completed: ["CAPT-03"]
---

# Phase 02 Plan 02: Applications Service Summary

**One-liner:** Three files (`status-transitions.ts`, `service.ts`, `queries.ts`) plus their colocated tests deliver the four mutation functions Phase 4 will call into (`createApplication`, `applyManualStatusChange`, `applyAutoStatusChange`, `undoStatusChange`), the three read queries Plan 04 Server Components will call into, and the single-source-of-truth status-regression helper. All mutations are atomic via `withRls`, all return `Result<T, AppError>`, all Event.data goes through `eventDataSchemas[type].parse()`. CAPT-03 contract satisfied.

## Performance

- **Duration:** ~9 min (554 s)
- **Started:** 2026-05-09T10:08:43Z
- **Completed:** 2026-05-09T10:17:57Z
- **Tasks:** 3
- **Files created:** 5 (3 modules + 2 colocated test files)
- **Tests added:** 73 (53 status-transitions + 20 service)
- **Total tests after:** 130 passing, 4 todo (was 57 passing, 4 todo)

## Accomplishments

- **CAPT-03 satisfied.** `createApplication(userId, input)` writes 1 Application + 1 Event in a single `withRls` transaction; if Company exists by name (case-insensitive trim) it's reused; otherwise created in the same tx. Defense-in-depth `safeParse` re-validates the input — caller cannot bypass schema validation.
- **APP-03 service contract ready.** `applyManualStatusChange(userId, appId, newStatus)` is the function Plan 04's status dropdown will call. Same-status no-op writes zero events and does NOT bump `lastActivityAt` (tested explicitly via M2: capture before-snapshot, call, capture after-snapshot, assert equality).
- **Phase 4 hard contract delivered.** Three functions Phase 4 will import as a one-line wire-up:
  - `applyAutoStatusChange` — applies `isStatusRegression` guard before mutating; rejects backward classifier moves with `Conflict('STATUS_REGRESSION_REQUIRES_REVIEW')`. Includes optional `emailId` in the event-data input BEFORE `.parse()` (per the Plan 02-01 strict() shape — never spread post-parse).
  - `undoStatusChange` — restores `Application.canonicalStatus` from `Event.data.previousStatus`, marks original event `undoneAt`, writes `Event(type='status_undone', source='manual')`, AND (if original event had a linked emailId) sets `Email.reviewedByUser=true` for Phase 4 idempotency. Audit trail preserved per ADR-0006 (original event not deleted).
  - `isStatusRegression(prev, next)` — single source of truth, fully tested across all 36 prev→next combinations.
- **Cross-tenant isolation verified.** Test CR6 creates an Application as alice and verifies that even an explicit raw `$queryRaw` for the row id returns zero rows under `withRls(BOB)` — RLS is the safety net.
- **Zero changes outside `src/features/applications/`.** No edits to `tenant.ts`, `with-rls.ts`, `errors/index.ts`, `schema.prisma`, `tests/integration/setup.ts`. Surgical scope (CLAUDE.md §1.3).
- **Pre-commit gate green.** lint, typecheck, test:run (130 passing), build, depcheck all clean.

## Task Commits

| Task | Name                                                                       | Type | Commit    | Files                                                                                       |
| ---- | -------------------------------------------------------------------------- | ---- | --------- | ------------------------------------------------------------------------------------------- |
| 1    | status-transitions.ts (isStatusRegression + STATUS_RANK) + 36-cell tests   | feat | `c4ef26a` | `src/features/applications/status-transitions.ts`, `status-transitions.test.ts`             |
| 2    | service.ts (4 mutations) + 20 integration tests                            | feat | `7be76ff` | `src/features/applications/service.ts`, `service.test.ts`                                   |
| 3    | queries.ts (3 read functions, no new tests per plan)                       | feat | `298601c` | `src/features/applications/queries.ts`                                                      |

_TDD note (matches Plan 01 convention): RED+GREEN per task were committed as one atomic unit because there's no in-tree consumer to break against during the RED step. The RED step was still run locally (test executes, fails because the module doesn't exist yet); see plan-execution log._

## Locked Invariants (Phase 4 + Plan 04 contract)

| Invariant                                                | Value                                                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STATUS_RANK`                                            | `applied:1, screening:2, interviewing:3, offer:4, rejected:5, withdrawn:5` (rejected + withdrawn share rank 5; both are TERMINAL)                  |
| Regression rule (non-terminal pair)                      | `STATUS_RANK[next] < STATUS_RANK[prev]` → regression                                                                                               |
| Regression rule (involving terminal)                     | non-terminal → terminal = forward (not regression); terminal → non-terminal = regression; terminal ↔ terminal = no-movement (not regression)        |
| Same-status                                              | NEVER a regression. Service same-status no-op writes zero rows + does not bump `lastActivityAt`.                                                   |
| `withRls` invariant                                      | All four mutation functions + all three queries run inside `withRls(userId, async tx => …)`. No direct `prisma.` access in either file.            |
| `Event.data` write contract                              | Every write goes through `eventDataSchemas[type].parse()`. For `auto_status_changed`, the full input object (incl. emailId) is built BEFORE `.parse()`. |
| Conflict reasons (`AppError.reason` strings)             | `STATUS_REGRESSION_REQUIRES_REVIEW`, `EVENT_NOT_UNDOABLE`, `EVENT_ALREADY_UNDONE`, `EVENT_DATA_MALFORMED`, `EVENT_HAS_NO_APPLICATION`              |
| `applyManualStatusChange` regression policy              | DOES NOT apply `isStatusRegression`. Manual changes intentionally bypass the guard (CONTEXT.md §Area 4). Tested via M4 (offer → applied succeeds). |
| `undoStatusChange` Email side-effect                     | If original event's `data.emailId` is set (positive int), `Email.reviewedByUser=true` is set in the SAME tx. Tested via U2.                        |
| Tenant isolation                                         | RLS verified by CR6: alice's createApplication is invisible to bob's `withRls(BOB)` even via raw `$queryRaw` for the row id.                       |

## Function Signatures (Phase 4 + Plan 04 read this section)

```typescript
// src/features/applications/service.ts

export type AutoStatusChange = {
  newStatus: CanonicalStatus
  source: EventSource
  emailId?: number
  classifierConfidence?: number
  classifiedBy?: ClassifiedBy
}

export async function createApplication(
  userId: UserId,
  rawInput: unknown,
): Promise<Result<{ applicationId: ApplicationId; eventId: EventId }, AppError>>

export async function applyManualStatusChange(
  userId: UserId,
  applicationId: ApplicationId,
  newStatus: CanonicalStatus,
): Promise<Result<{ event: Event | null }, AppError>>
// event === null when newStatus === current canonicalStatus (no-op)

export async function applyAutoStatusChange(
  userId: UserId,
  applicationId: ApplicationId,
  change: AutoStatusChange,
): Promise<Result<{ event: Event | null }, AppError>>
// event === null on same-status no-op
// err({_tag:'Conflict', reason:'STATUS_REGRESSION_REQUIRES_REVIEW'}) on regression
// err({_tag:'NotFound', resource:'Application'}) when not in tenant

export async function undoStatusChange(
  userId: UserId,
  eventId: EventId,
): Promise<Result<{ event: Event }, AppError>>
// err({_tag:'Conflict', reason:'EVENT_NOT_UNDOABLE'}) when type !== 'auto_status_changed'
// err({_tag:'Conflict', reason:'EVENT_ALREADY_UNDONE'}) when undoneAt is set
// err({_tag:'NotFound', resource:'Event'}) when not in tenant
```

```typescript
// src/features/applications/queries.ts

export type ApplicationListItem = { /* flat shape with companyName joined */ }
export type ApplicationDetail = {
  application: Application & { company: { id; name; domain } }
  stages: Stage[]
  events: Event[]
  emails: Email[]
}
export type ListSort = 'lastActivityAt:desc' | 'lastActivityAt:asc' | 'appliedAt:desc' | 'appliedAt:asc'

export async function findApplicationsForList(
  userId: UserId,
  opts?: { statuses?: ReadonlyArray<CanonicalStatus>; sort?: ListSort },
): Promise<Result<ApplicationListItem[], AppError>>
// default statuses = ['applied','screening','interviewing','offer'] (excludes rejected+withdrawn)
// default sort = 'lastActivityAt:desc'
// always excludes archivedAt IS NOT NULL

export async function findApplicationDetail(
  userId: UserId,
  applicationId: ApplicationId,
): Promise<Result<ApplicationDetail | null, AppError>>
// value === null when not in tenant — page maps to notFound()

export async function countApplicationsByStatus(
  userId: UserId,
): Promise<Result<Record<CanonicalStatus, number> & { archived: number }, AppError>>
// returns all 6 canonical-status keys (initialized to 0) + archived count
```

```typescript
// src/features/applications/status-transitions.ts

export const STATUS_RANK: Record<CanonicalStatus, number>
export function isStatusRegression(prev: CanonicalStatus, next: CanonicalStatus): boolean
```

## Decisions Made

1. **Used `tx.application.groupBy` inside `withRls` for `countApplicationsByStatus`** instead of extending `tenantDb` with a `groupBy` method. Rationale: CONTEXT.md §code_context explicitly allows either path; tenantDb.groupBy would be a single-caller API surface (Sandi Metz rule of three not yet met); keeping `tenant.ts` untouched avoids touching files outside the slice (CLAUDE.md §1.3 surgical changes).

2. **Throw-bridge with literal `NOT_FOUND:` / `CONFLICT:` prefixes** rather than typed sentinel error classes. Rationale: matches the plan's pseudo-implementation; one helper (`translateThrowBridge`) DRYs the translation across the three mutation functions that need it; threat-model T-02-02-09 documents the small known prefix-collision risk. If Plan 03 adds another caller of this pattern, revisit — typed sentinel classes are ~10 LOC and erase the risk.

3. **Cleanup preserves seeded `Alice Test Role` + `Alice Corp` rows.** First implementation deleted alice's whole subtree, which broke `rls-escape.test.ts` and `tenant-db-cross-tenant-leak.test.ts` (both assert `apps.length >= 1` for alice). Surgical fix: `deleteMany({ where: { userId: ALICE, roleTitle: { not: SEED_ROLE_TITLE } } })` — leaves the seed intact. Auto-fix per Rule 3 (blocking issue caused by my own changes); see Deviations below.

4. **Conditional inclusion of optional fields in the `auto_status_changed` event-data input** (rather than unconditional `undefined` assignment). Reason: makes the intent visible at the call site and avoids depending on Zod schema's behavior around `undefined` vs missing keys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue caused by my own change] Test fixture cleanup broke pre-existing integration tests**

- **Found during:** Task 2, after first GREEN run of service.test.ts.
- **Issue:** My initial `beforeEach` cleanup did `deleteMany({ where: { userId: Number(ALICE) } })` on `application` — this wiped the seeded "Alice Test Role" row. After my file's last test ran, alice had 0 applications, breaking `tests/integration/rls-escape.test.ts` and `tests/integration/tenant-db-cross-tenant-leak.test.ts` (both expect `apps.length >= 1` for alice as their seeded baseline).
- **Fix:** Changed cleanup to preserve the seeded fixtures: `deleteMany({ where: { userId: Number(ALICE), roleTitle: { not: SEED_ROLE_TITLE } } })` for applications, `deleteMany({ where: { userId: Number(ALICE), name: { not: SEED_COMPANY_NAME } } })` for companies. Events + emails stay full-wipe (no seeded rows for those).
- **Files modified:** `src/features/applications/service.test.ts` only (during Task 2).
- **Commit:** Folded into `7be76ff` (Task 2 atomic commit — the broken cleanup was never committed).

**Total deviations:** 1 auto-fixed (Rule 3). Zero Rule 4 (architectural) triggers; the plan's interfaces section + Plan 01's frozen contracts were sufficient.
**Impact on plan:** None on contract surface. Plan acceptance criteria all met.

## Issues Encountered

- **Plan-suggested cleanup approach broke other test files** (see Deviation 1). Easily fixed by scoping the delete to non-seed rows.

## Verification Against Plan-Level Checks

| Check                                                                                                   | Result                                                                                  |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm test:run -- src/features/applications/` passes ≥36 tests                                          | PASS — 73 new tests (53 status-transitions + 20 service); 130 total green               |
| `pnpm lint && pnpm typecheck && pnpm build && pnpm depcheck` clean                                      | PASS — only pre-existing `src/middleware.ts` orphan warning                             |
| `grep -r "applyAutoStatusChange\|undoStatusChange\|applyManualStatusChange\|createApplication"`         | All four exported from `service.ts`; zero unexpected callers                            |
| No file outside `src/features/applications/` modified                                                   | PASS (verified via `git diff --stat HEAD~3 HEAD`)                                       |
| All four mutation functions write at least one Event row of the correct type                            | PASS — service tests CR1, M1, A1, U1 explicitly verify event creation per type          |
| Status regression block returns ONLY `STATUS_REGRESSION_REQUIRES_REVIEW` from `applyAutoStatusChange`   | PASS — verified by Test A2; the conflict reason is the only place this string appears   |

## Verification Against Plan Acceptance Criteria

**Task 1 (status-transitions):**
- [x] File `src/features/applications/status-transitions.ts` exists with exactly 2 exports (`STATUS_RANK`, `isStatusRegression`).
- [x] File `src/features/applications/status-transitions.test.ts` covers all 36 prev/next combinations via `it.each`.
- [x] `pnpm test:run` for status-transitions passes 53 tests (target was ≥17).
- [x] `pnpm typecheck` clean (CanonicalStatus type imported from `@/generated/prisma/client`).
- [x] `pnpm lint` clean.

**Task 2 (service):**
- [x] `src/features/applications/service.ts` exists with exactly 4 exported async functions (verified via grep).
- [x] Zero direct `prisma.` references (`grep` returns 0 matches).
- [x] `withRls` used inside every mutation (4 + helper invocations).
- [x] No `'use client'` directive; `import 'server-only'` at top.
- [x] `import { isStatusRegression } from './status-transitions'` present.
- [x] `import { eventDataSchemas, createApplicationSchema } from './schema'` present.
- [x] `applyAutoStatusChange` calls `isStatusRegression` (1 call site).
- [x] `eventDataSchemas.auto_status_changed.parse(eventDataInput)` with full object including emailId; zero post-parse spread of `eventData`.
- [x] All 4 mutation functions return `Promise<Result<..., AppError>>`.
- [x] `pnpm test:run` for service passes 20 tests (target was ≥19).
- [x] `pnpm lint` / `pnpm typecheck` / `pnpm depcheck` clean.
- [x] Test file imports `withRls` from `@/core/db/with-rls` for assertion reads.

**Task 3 (queries):**
- [x] `src/features/applications/queries.ts` exists with exactly 3 exported async functions.
- [x] All three return `Promise<Result<..., AppError>>`.
- [x] `import 'server-only'` at top.
- [x] `withRls` used inside every function (3+ matches).
- [x] Zero direct `prisma.` references.
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm depcheck` clean.
- [x] Default `statuses` excludes 'rejected' and 'withdrawn' (via `DEFAULT_HIDDEN_STATUSES` filter).
- [x] `findApplicationDetail` returns `null` value (inside `Result.value`) when application not in tenant — does NOT throw, does NOT return `err`.

## Known Stubs

None. All five files are fully implemented. Queries.ts has no in-tree consumer yet (Plan 04 will wire pages); service.ts has no in-tree consumer yet (Plan 04 wraps in Server Actions). Both are intentionally library-only deliverables per `<output>` and `<dependency_graph>`.

## Threat Flags

None new. The plan's `<threat_model>` enumerates all relevant threats (T-02-02-01 through T-02-02-09) and each is `mitigate`d (or `accept`ed with documented rationale: T-02-02-07 for the manual-change regression bypass; T-02-02-09 for the small throw-bridge prefix-collision surface). No new trust boundaries introduced — service composes existing `withRls` + `eventDataSchemas` + `errors` factories.

## Next Phase Readiness

- **Plan 02-03 (stages + notes services)** can now mirror this plan's pattern: withRls + Event-on-write + Result return + colocated integration tests with the `resetAliceState` cleanup helper as a template.
- **Plan 02-04 (Server Actions + UI)** can now `import { createApplication, applyManualStatusChange } from '@/features/applications/service'` and `import { findApplicationsForList, findApplicationDetail, countApplicationsByStatus } from '@/features/applications/queries'`. No further service-layer work needed for capture/list/detail/dropdown.
- **Phase 4 (inbox/act stage)** will be a one-line wire-up: `import { applyAutoStatusChange, undoStatusChange, isStatusRegression } from '@/features/applications/...'`. The status-regression block is the service's job, not the caller's — Phase 4 only translates the Conflict err into the review-queue path.

## Self-Check: PASSED

Files exist:
- `src/features/applications/status-transitions.ts`: FOUND
- `src/features/applications/status-transitions.test.ts`: FOUND
- `src/features/applications/service.ts`: FOUND
- `src/features/applications/service.test.ts`: FOUND
- `src/features/applications/queries.ts`: FOUND

Commits exist:
- `c4ef26a` (Task 1, status-transitions): FOUND
- `7be76ff` (Task 2, service + integration tests): FOUND
- `298601c` (Task 3, queries): FOUND

Pre-commit gate (lint + typecheck + test:run + build + depcheck): all PASS, executed end-to-end after Task 3 commit.

---
*Phase: 02-applications-slice-manual-tracker*
*Plan: 02*
*Completed: 2026-05-09*
