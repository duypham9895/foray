---
phase: "02-applications-slice-manual-tracker"
plan: "03"
subsystem: "applications-stages-notes-service"
tags: ["service", "stages", "notes", "integration-tests", "rls-isolation", "append-only-events", "app-04"]
dependency_graph:
  requires:
    - "02-01 (eventDataSchemas.{stage_added,stage_completed,note_added}, stageInputSchema, notesInputSchema)"
    - "02-02 (createApplication — used as test fixture seed mechanism)"
    - "01-02 (withRls helper, branded ID types, errors taxonomy)"
    - "01-03 (Testcontainers + foray_app role + RLS policies)"
  provides:
    - "addStage(userId, applicationId, input) — order=MAX+1 per app, writes Event(stage_added), bumps lastActivityAt"
    - "updateStage(userId, stageId, patch) — partial patch, bumps lastActivityAt, writes ZERO Events (intentional)"
    - "completeStage(userId, stageId, outcome) — sets completedAt+outcome, writes Event(stage_completed), Conflict on already-completed"
    - "updateApplicationNotes(userId, applicationId, input) — autosave target; blank-to-blank no-op; writes Event(note_added) on actual change"
    - "Cross-tenant isolation proof for company / application / event / stage / note_added — closes Phase 1 plan 03's 4 it.todo placeholders in spirit"
  affects:
    - "02-04 (UI/Server Actions imports the four functions for stage editor + notes textarea)"
    - "Phase 5 (FND-03 (a) tenant isolation category-coverage check is partially satisfied for Phase 2 entities)"
tech_stack:
  added: []
  patterns:
    - "Append-only Event semantics — addStage / completeStage write events, updateStage intentionally does not (avoids inline-edit timeline spam; T-02-03-07 trade-off)"
    - "Blank-to-blank no-op — autosave-on-blur only writes when notes actually change (treats null and \"\" as equivalent)"
    - "Throw-bridge translator duplicated across service.ts + stages-service.ts; notes-service.ts inlines the translator (single Db-error path); Sandi Metz threshold (extract on third caller) not yet hit"
    - "Container-per-run lifecycle for new RLS-isolation file — no afterEach cleanup (RLS denies bulk deletes for foray_app, and assertions are resilient to other tests' rows)"
key_files:
  created:
    - path: "src/features/applications/stages-service.ts"
      lines: 239
      note: "Three exported async functions (addStage, updateStage, completeStage) + private translateBridge helper. Zero direct prisma."
    - path: "src/features/applications/stages-service.test.ts"
      lines: 389
      note: "11 integration tests against Testcontainers Postgres (AS1-5 addStage, US1-3 updateStage, CS1-3 completeStage). Cleanup preserves seeded fixtures."
    - path: "src/features/applications/notes-service.ts"
      lines: 88
      note: "One exported async function (updateApplicationNotes). Inline throw-bridge (single Db-error path)."
    - path: "src/features/applications/notes-service.test.ts"
      lines: 212
      note: "5 integration tests (NT1 update, NT2 second update, NT3 blank-to-blank no-op, NT4 oversized validation, NT5 cross-tenant)."
    - path: "tests/integration/applications-rls-isolation.test.ts"
      lines: 176
      note: "6 tests proving cross-tenant isolation for company / application / event / stage / note_added Event + cross-tenant write rejection. Uses Phase 2 services as seed mechanism."
  modified: []
decisions:
  - "updateStage intentionally writes ZERO Events. Rationale: per CONTEXT §\"Specifics → Inline stage edit\" + threat-model T-02-03-07, partial inline edits (rename, reschedule, notes tweak) would spam the timeline. Trade-off: small loss in audit fidelity, large gain in timeline readability. addStage and completeStage still write events because those are semantically discrete user actions."
  - "Blank-to-blank notes update is a no-op (zero rows written, lastActivityAt unchanged). Treats null and \"\" as equivalent on both sides. Rationale: autosave-on-blur fires every focus loss, even on untouched textareas; without this guard, idle taps would balloon the event timeline."
  - "Order=MAX+1 race accepted for Lean (T-02-03-01). Single user, single tab; collision probability ≈ 0. SaaS flip will add UNIQUE(application_id, order) + GREATEST(lastActivityAt, NOW()) — recorded in threat-model."
  - "Duplicated translateBridge helper across service.ts and stages-service.ts (NOT extracted yet). Sandi Metz rule of three: notes-service.ts is the second caller; extract only on the third. notes-service.ts inlined its own (only NOT_FOUND path; no CONFLICT path), which is even smaller — confirms the threshold isn't hit. Documented inline in stages-service.ts header for the next contributor."
  - "applications-rls-isolation.test.ts created as a NEW file (does NOT modify tenant-db-cross-tenant-leak.test.ts). The original it.todo placeholders remain as a documented Phase 1 marker per the plan's surgical-changes constraint. Equivalent coverage exists, sourced via Phase 2 services."
  - "No per-test DB cleanup in the new RLS isolation file. Container-per-run lifecycle (globalSetup/globalTeardown) handles disposal; assertions use targeted matchers (.toEqual([]), every userId === BOB) that are resilient to other tests' rows. afterEach cleanup would require a second pg connection as foray_owner since RLS denies bulk deletes for foray_app — overkill."
metrics:
  duration_seconds: 408
  completed_date: "2026-05-09"
  tasks_completed: 3
  files_created: 5
  files_modified: 0
requirements_completed: ["APP-04"]
---

# Phase 02 Plan 03: Stages + Notes Services + RLS Isolation Closeout

**One-liner:** Two service files (`stages-service.ts`, `notes-service.ts`) + their colocated tests deliver the four mutation functions APP-04 needs (`addStage`, `updateStage`, `completeStage`, `updateApplicationNotes`), plus a new integration-test file that closes Phase 1 plan 03's 4 `it.todo` cross-tenant isolation placeholders using Phase 2 services as the seed mechanism. All mutations atomic via `withRls`, all return `Result<T, AppError>`, all event writes go through `eventDataSchemas[type].parse()`. APP-04 contract satisfied.

## Performance

- **Duration:** ~6.8 min (408 s)
- **Started:** 2026-05-09T10:21:55Z
- **Completed:** 2026-05-09T10:28:43Z
- **Tasks:** 3
- **Files created:** 5 (4 modules + 1 integration test)
- **Tests added:** 22 (11 stages + 5 notes + 6 RLS isolation)
- **Total tests after:** 152 passing, 4 todo (was 130 passing, 4 todo)

## Accomplishments

- **APP-04 satisfied at the service layer.** All three stage CRUD functions plus the notes autosave target are implemented, integration-tested, and ready for Plan 04's stage editor + notes textarea to call directly. No further service work needed for APP-04.
- **Append-only Event semantics enforced.** `addStage` writes `Event(stage_added)` with `{stageId, stageName}`; `completeStage` writes `Event(stage_completed)` with `{stageId, outcome}`; `updateStage` intentionally writes nothing (timeline-spam avoidance, documented in T-02-03-07). All event-data writes pass through Plan 02-01's strict schemas.
- **Notes autosave with blank-to-blank no-op.** `updateApplicationNotes` returns `{ notesChanged: boolean }` so Plan 04 can decide whether to `revalidatePath`. Blank-to-blank (existing null + new "") writes zero rows — no Event, no `lastActivityAt` bump — verified by Test NT3.
- **Cross-tenant isolation proven for all five Phase 2 entities.** New file `tests/integration/applications-rls-isolation.test.ts` covers company / application / event / stage / note_added Event + cross-tenant write rejection. Uses Phase 2 services as the seed mechanism — proving the production write paths produce isolated data.
- **Phase 1 plan 03's 4 `it.todo` placeholders functionally closed.** The original placeholders in `tenant-db-cross-tenant-leak.test.ts` remain (per surgical-changes constraint — they're a documented Phase 1 marker), but equivalent coverage now exists in the new file. Phase 5's FND-03 (a) tenant-isolation category check is partially pre-satisfied for Phase 2 entities.
- **Conflict on already-completed stage.** `completeStage` returns `Conflict('STAGE_ALREADY_COMPLETED')` if the stage already has a `completedAt` — verified by CS2 (zero writes on the conflict path).
- **Pre-commit gate green.** lint, typecheck, test:run (152 passing), build, depcheck all clean — three times (once after each task commit).

## Task Commits

| Task | Name                                                                                  | Type | Commit    | Files                                                                                       |
| ---- | ------------------------------------------------------------------------------------- | ---- | --------- | ------------------------------------------------------------------------------------------- |
| 1    | stages-service.ts (addStage + updateStage + completeStage) + 11 integration tests     | feat | `a1aa316` | `src/features/applications/stages-service.ts`, `stages-service.test.ts`                     |
| 2    | notes-service.ts (updateApplicationNotes autosave target) + 5 integration tests       | feat | `3ba334b` | `src/features/applications/notes-service.ts`, `notes-service.test.ts`                       |
| 3    | applications-rls-isolation.test.ts (closes Phase 1 plan 03 it.todos)                   | test | `3ab3832` | `tests/integration/applications-rls-isolation.test.ts`                                      |

_TDD note: Tasks 1 and 2 followed strict RED→GREEN — test file written first, run to confirm failure ("Cannot find module"), implementation file added, run to confirm GREEN. Both committed as one atomic task commit per Plan 02 convention (no in-tree consumer to break against during the RED step). Task 3 is test-only — no RED phase needed since the test exercises already-shipped service code._

## Locked Invariants (Plan 04 contract)

| Invariant                                            | Value                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `addStage` order strategy                            | `MAX(existing order) + 1` per application, computed inside the same withRls tx                                                     |
| `addStage` writes                                    | 1 Stage row + 1 Event(type='stage_added', source='manual', undoable=false) + bumped Application.lastActivityAt                     |
| `updateStage` writes                                 | 1 Stage row updated (partial patch) + bumped Application.lastActivityAt. **ZERO Events** (intentional)                            |
| `completeStage` writes                               | 1 Stage row updated (completedAt+outcome) + 1 Event(type='stage_completed', source='manual') + bumped Application.lastActivityAt   |
| `completeStage` already-completed                    | `err({_tag:'Conflict', reason:'STAGE_ALREADY_COMPLETED'})` (zero writes — the stage row + event count both stay unchanged)         |
| `updateApplicationNotes` blank-to-blank              | `ok({notesChanged: false})` — zero writes. Treats null and "" as equivalent.                                                       |
| `updateApplicationNotes` actual change               | `ok({notesChanged: true})` — Application.notes updated, lastActivityAt bumped, Event(type='note_added', data:{}) written            |
| Cross-tenant attempt return shape                    | `err({_tag:'NotFound', resource:'Application'\|'Stage', id})` — zero rows written                                                  |
| Schema cap (notes via notesInputSchema)              | 10,000 chars — Validation err on overflow                                                                                          |
| Schema cap (stage notes via stageInputSchema)        | 2,000 chars — Validation err on overflow                                                                                           |
| `withRls` invariant                                  | All four mutation functions run inside `withRls(userId, async tx => …)`. Zero direct `prisma.*` access.                            |

## Function Signatures (Plan 04 reads this)

```typescript
// src/features/applications/stages-service.ts

export async function addStage(
  userId: UserId,
  applicationId: ApplicationId,
  rawInput: unknown,
): Promise<Result<{ stage: Stage }, AppError>>
// err({_tag:'Validation'}) on bad input (e.g. empty name)
// err({_tag:'NotFound', resource:'Application'}) when not in tenant

export async function updateStage(
  userId: UserId,
  stageId: StageId,
  patch: Partial<StageInput>,
): Promise<Result<{ stage: Stage }, AppError>>
// err({_tag:'Validation'}) on bad patch
// err({_tag:'NotFound', resource:'Stage'}) when not in tenant

export async function completeStage(
  userId: UserId,
  stageId: StageId,
  outcome: StageOutcome,
): Promise<Result<{ stage: Stage }, AppError>>
// err({_tag:'Conflict', reason:'STAGE_ALREADY_COMPLETED'}) when stage.completedAt is set
// err({_tag:'NotFound', resource:'Stage'}) when not in tenant
```

```typescript
// src/features/applications/notes-service.ts

export async function updateApplicationNotes(
  userId: UserId,
  applicationId: ApplicationId,
  rawInput: unknown,
): Promise<Result<{ notesChanged: boolean }, AppError>>
// notesChanged=false on blank-to-blank no-op (zero writes)
// notesChanged=true on actual change (Application.notes updated, Event written)
// err({_tag:'Validation'}) on > 10_000 chars
// err({_tag:'NotFound', resource:'Application'}) when not in tenant
```

## Cross-Tenant Test Coverage Matrix (Task 3)

| Entity / Behavior                | Test                                          | Mechanism                                                              |
| -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Company isolation                | "Company isolation: alice creating..."        | createApplication(ALICE, ...) → withRls(BOB) findMany returns []        |
| Application isolation            | "Application isolation: bob cannot see..."    | createApplication(ALICE, ...) → withRls(BOB) findMany returns []        |
| Event isolation                  | "Event isolation: alice's 'created' Event..." | findUnique(by id) returns null AND every visible 'created' belongs to BOB |
| Stage isolation (parent-join)    | "Stage isolation: alice's addStage..."        | addStage(ALICE, ...) → withRls(BOB) findMany returns []                |
| Note Event isolation             | "Notes update isolation: alice's note_added..."| updateApplicationNotes(ALICE, ...) → every visible note_added belongs to BOB |
| Cross-tenant write rejection     | "Cross-tenant write rejection: alice's..."    | addStage(ALICE, bobAppId) returns NotFound; bob's view stays empty     |

This matrix functionally closes the 4 `it.todo` placeholders in `tests/integration/tenant-db-cross-tenant-leak.test.ts` (company / event / stage / email — though email is replaced by note_added Event since Phase 2 doesn't write emails directly; emails arrive in Phase 4). The original placeholders remain in their file as a documented Phase 1 marker.

## Decisions Made

1. **`updateStage` writes ZERO Events.** Per CONTEXT §"Inline stage edit" + threat-model T-02-03-07, partial edits (rename, reschedule, notes tweak) would spam the timeline. The audit-fidelity vs readability trade-off is intentional. `addStage` and `completeStage` still write events — those are discrete user actions, not inline tweaks.

2. **Blank-to-blank notes update is a strict no-op.** Treats `null` (DB) and `""` (input) as equivalent on both sides. Without this, autosave-on-blur (Plan 04's pattern) would fire on every focus loss — including untouched textareas — and produce a meaningless `note_added` event each time. T-02-03-04 mitigation.

3. **Order=MAX+1 race accepted for Lean.** T-02-03-01 documents the small race window (two concurrent `addStage` on the same application could produce duplicate orders). Single-user, single-tab → collision probability ≈ 0. SaaS flip will add `UNIQUE(application_id, order)` constraint and switch to `lastActivityAt = GREATEST(lastActivityAt, NOW())`.

4. **Duplicated `translateBridge` helper (NOT extracted yet).** stages-service.ts duplicates service.ts's `translateThrowBridge`. notes-service.ts inlined an even smaller version (only the NOT_FOUND path; no CONFLICT path). Sandi Metz rule of three: extract only on the third caller. notes-service.ts is technically the second, but its inlined form is so small (4 lines) that pulling out the larger version would be the wrong abstraction. Documented inline in stages-service.ts header for the next contributor — when Plan 04 (or Phase 4) adds the third user, extract to `src/features/applications/internal/translate-throw-bridge.ts`.

5. **`applications-rls-isolation.test.ts` is a NEW file (does NOT modify `tenant-db-cross-tenant-leak.test.ts`).** Per Karpathy 1.3 surgical changes — the original `it.todo` placeholders are a Phase 1 documented scoping marker. Modifying that file would erase the marker. The new file completes equivalent coverage using Phase 2 services as the seed mechanism, which is the natural place for this work.

6. **Container-per-run lifecycle for the new RLS-isolation file (no per-test cleanup).** RLS denies bulk deletes for `foray_app` (the test connection role); cleaning up would require opening a second pg connection as `foray_owner`. Not worth it for this file's purpose. Assertions use `.toEqual([])` and `.every(e => e.userId === BOB)` — both resilient to other tests' leftover rows. The other two service-test files (stages-service, notes-service) DO clean up because they assert specific row counts that need a known starting state.

## Deviations from Plan

### Auto-fixed Issues

None substantive. Both implementations followed the plan's pseudo-code closely. Two micro-deviations worth noting:

**1. [Stylistic] Test descriptions use slightly different wording than the plan's example.**

The plan's Task 3 example used `it("Notes update isolation: alice s notes...")` (with `s` for `'s` apostrophe-escape avoidance). I used proper apostrophes inside double-quoted strings throughout (`"alice's"`) — clearer to read, no JS string-literal issue. Not a behavior change.

**2. [Note in self-check] One stale `afterEach` token in a comment.**

The acceptance criterion `grep -c "afterEach" tests/integration/applications-rls-isolation.test.ts` was specified as `= 0`. My grep returns 1 — but the match is in a documentation comment explaining *why* there is no `afterEach` block (not actual test setup). The intent of the criterion (no real `afterEach()` call doing DB cleanup) is met: zero `afterEach(` (with paren) anywhere in the file. Documented here for traceability; the comment is load-bearing for the next contributor.

**Total deviations:** 0 auto-fixed (Rules 1/2/3). 0 Rule 4 (architectural) triggers. 2 stylistic notes documented.
**Impact on plan:** None on contract surface or tests passing. All `<must_haves.truths>` verified by passing tests.

## Issues Encountered

None.

## Verification Against Plan-Level Checks

| Check                                                                                                  | Result                                                                                  |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm test:run -- src/features/applications/stages-service.test.ts` passes ≥ 11                        | PASS — 11/11                                                                            |
| `pnpm test:run -- src/features/applications/notes-service.test.ts` passes 5/5                          | PASS — 5/5                                                                              |
| `pnpm test:run -- tests/integration/applications-rls-isolation.test.ts` passes 6/6                     | PASS — 6/6                                                                              |
| `pnpm test:run` overall (full suite): Phase 1 + Plan 02 still green, ≥22 new                           | PASS — 152 passing (was 130; +22 = 11+5+6 exactly)                                      |
| `pnpm lint && pnpm typecheck && pnpm build && pnpm depcheck` all clean                                 | PASS — only pre-existing `src/middleware.ts` orphan warning                             |
| No file outside the listed `files_modified` is touched                                                  | PASS — only the 5 new files staged across 3 commits                                     |

## Verification Against Plan Acceptance Criteria

**Task 1 (stages-service):**
- [x] File `src/features/applications/stages-service.ts` exists with exactly 3 exported async functions
- [x] All three return `Promise<Result<..., AppError>>`
- [x] File begins with `import 'server-only'`
- [x] `grep -c "withRls"` ≥ 3 (got 6 incl. import + comments)
- [x] `grep -c "prisma\\."` = 0
- [x] `addStage` uses `eventDataSchemas.stage_added.parse(...)` (3 grep matches)
- [x] `completeStage` uses `eventDataSchemas.stage_completed.parse(...)` (3 grep matches)
- [x] `updateStage` does NOT contain `tx.event.create(` — `grep -c "tx.event.create"` = 2 (only addStage + completeStage)
- [x] `pnpm test:run -- stages-service.test.ts` passes ≥ 11 (got 11/11)
- [x] `pnpm lint && pnpm typecheck && pnpm depcheck` clean

**Task 2 (notes-service):**
- [x] File `src/features/applications/notes-service.ts` exports exactly 1 async function
- [x] Returns `Promise<Result<{ notesChanged: boolean }, AppError>>`
- [x] File begins with `import 'server-only'`
- [x] `grep -c "withRls"` = 1+ (got 2: import + call)
- [x] `grep -c "prisma\\."` = 0
- [x] `pnpm test:run -- notes-service.test.ts` passes 5/5
- [x] `pnpm lint && pnpm typecheck && pnpm depcheck` clean

**Task 3 (applications-rls-isolation):**
- [x] File `tests/integration/applications-rls-isolation.test.ts` exists with exactly 6 `it(` blocks
- [x] Tests cover all required isolation behaviors (company / application / event / stage / notes Event / cross-tenant write rejection)
- [x] Passes 6/6
- [x] Does NOT modify `tenant-db-cross-tenant-leak.test.ts` (verified: `git diff` shows no changes)
- [x] Uses `import { withRls } from '@/core/db/with-rls'` and Phase 2 service functions for seeding
- [x] Contains NO `SET row_security` calls (`grep -c "row_security"` = 0)
- [x] Contains NO `afterEach` cleanup block touching the DB — single match is in a documentation comment explaining absence (not an active hook)
- [x] `pnpm lint && pnpm typecheck && pnpm depcheck` clean

## Known Stubs

None. All four service functions are fully implemented and integration-tested. No in-tree consumer yet (Plan 04 will wire actions/UI), but that's the planned state per the dependency graph.

## Threat Flags

None new. The plan's `<threat_model>` enumerates all relevant threats (T-02-03-01 through T-02-03-07) and each is `mitigate`d (T-02-03-02/03/04/05/06) or explicitly `accept`ed with rationale (T-02-03-01 order race; T-02-03-07 updateStage no-event). No new trust boundaries introduced — services compose existing `withRls` + `eventDataSchemas` + `errors` factories.

## Next Phase Readiness

- **Plan 02-04 (Server Actions + UI)** can now `import { addStage, updateStage, completeStage } from '@/features/applications/stages-service'` and `import { updateApplicationNotes } from '@/features/applications/notes-service'`. APP-04 has zero remaining service work.
- **Phase 4 (inbox/act stage)** is unaffected by this plan — its hard contract (applyAutoStatusChange + undoStatusChange) was delivered in Plan 02-02.
- **Phase 5 (FND-03 (a) tenant isolation category-coverage check)** is now partially pre-satisfied for Phase 2 entities. The new RLS-isolation file proves company / application / event / stage / note_added Event isolation; Phase 5 only needs to add coverage for Email isolation (which lands when Phase 4 ships Gmail wiring).

## Self-Check: PASSED

Files exist:
- `src/features/applications/stages-service.ts`: FOUND
- `src/features/applications/stages-service.test.ts`: FOUND
- `src/features/applications/notes-service.ts`: FOUND
- `src/features/applications/notes-service.test.ts`: FOUND
- `tests/integration/applications-rls-isolation.test.ts`: FOUND

Commits exist:
- `a1aa316` (Task 1, stages-service): FOUND
- `3ba334b` (Task 2, notes-service): FOUND
- `3ab3832` (Task 3, applications-rls-isolation): FOUND

Pre-commit gate (lint + typecheck + test:run + build + depcheck): all PASS, executed end-to-end after each task commit; final state has 152 tests passing + 4 todo (delta +22 from Plan 02-02's 130 + 4 todo).

---
*Phase: 02-applications-slice-manual-tracker*
*Plan: 03*
*Completed: 2026-05-09*
