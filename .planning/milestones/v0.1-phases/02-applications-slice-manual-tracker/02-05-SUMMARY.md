---
phase: "02-applications-slice-manual-tracker"
plan: "05"
subsystem: "phase-close-out-adr-uat"
tags: ["adr", "close-out", "uat", "deferred-uat", "pre-commit-gate", "phase-2-complete"]
dependency_graph:
  requires:
    - "02-01 (Zod schemas, ats-domains, eventDataSchemaFor)"
    - "02-02 (createApplication, applyAutoStatusChange, undoStatusChange, status-transitions, queries)"
    - "02-03 (addStage, updateStage, completeStage, updateApplicationNotes)"
    - "02-04 (UI surface — capture form, list, detail, timeline, 6 Server Actions, 3 pages, 8 shadcn primitives — code-layer complete)"
  provides:
    - "ADR-0012 — status-regression block at service layer + cyan-tinted auto-update event visual treatment + terminal-status semantics. Phase 4 cannot accidentally re-implement regression logic or change the visual without superseding."
    - "02-UAT.md — structured pre-merge UAT artifact recording the 12 Plan 02-04 browser-verify items + 5 ROADMAP phase-2 success criteria + 4 Lean acceptance items. 20 DEFERRED + 1 PASS."
    - "Final Phase-2 pre-commit gate confirmation (lint + typecheck + test:run + build + depcheck — all green)."
  affects:
    - "Phase 4 inbox/act stage will read ADR-0012 to honor the status-regression block (call applyAutoStatusChange; on Conflict route to review queue) and the conditional 'View source email' branch in timeline.tsx."
    - "Pre-merge browser walkthrough (owner-driven) will close the 20 DEFERRED rows in 02-UAT.md before Phase 2 merges to main."
tech_stack:
  added: []
  patterns:
    - "Deferred-UAT artifact for visual / interactive verification — mirrors Phase 1's 01-HUMAN-UAT.md pattern (rows persist as DEFERRED until pre-merge browser session)."
    - "ADR locks two cross-cutting decisions (regression placement + visual treatment) in one record — Phase 4 reads ADR-0012 instead of re-deriving from CONTEXT.md + DESIGN.md + status-transitions.ts source code."
key_files:
  created:
    - path: "docs/decisions/0012-status-regression-block-and-auto-update-styling.md"
      lines: 247
      note: "Nygard-format ADR. 6 ## headings: Context, Decision, Consequences, When we'd reconsider, References, Supersedes. Status: Accepted. Cites status-transitions.ts ×7, timeline.tsx ×7, ADR-0005 + ADR-0006, includes literal Tailwind classes (bg-cyan-50, border-cyan-600) and label (Auto-updated from email)."
    - path: ".planning/phases/02-applications-slice-manual-tracker/02-UAT.md"
      lines: 113
      note: "Pre-merge UAT artifact. 21 status rows (20 DEFERRED + 1 PASS = 29 status tokens — well above the verify gate's floor of 7). Owner will walk through the 12 browser checks before merging Phase 2 to main."
  modified: []
decisions:
  - "ADR-0012 placement at the service layer (not the controller) — single enforcement site for the regression rule. Phase 4 becomes a thin orchestrator: try applyAutoStatusChange, on Conflict route to review queue."
  - "Terminal-status semantics in status-transitions.ts STATUS_RANK: rejected and withdrawn both at rank 5; non-terminal → terminal is forward (closing out is normal); terminal → non-terminal is regression (un-rejecting is human-only); terminal ↔ terminal is no-movement."
  - "Auto-update event visual treatment locked: bg-cyan-50 + dark:bg-cyan-950/30 + border-l-2 border-cyan-600 + 'Auto-updated from email' text label, NO icon. Cyan-600 anchors auto events in the screening hue family (per DESIGN.md status palette)."
  - "Conditional 'View source email' link branch (data.emailId != null → render <a href={`/inbox/${data.emailId}`}>) exists in timeline.tsx so Phase 4 can wire /inbox/[emailId] without re-editing this file. Phase 2 doesn't exercise the branch (emailId always null on real data until Gmail wires up)."
  - "All 12 browser-verify items from Plan 02-04 Task 4 marked DEFERRED in 02-UAT.md. Pre-merge browser walkthrough by the owner will close them — same pattern as Phase 1's 01-HUMAN-UAT.md (12/14 verified automatically, 2 deferred to pre-merge)."
  - "Final pre-commit gate (lint + typecheck + test:run + build + depcheck) re-run as the LAST action before plan completion. 158 passing tests, 6 routes built, 0 dependency violations (1 pre-existing middleware orphan warning carried forward — not introduced by this plan)."
metrics:
  duration_seconds: 269
  completed_date: "2026-05-09"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements_completed: []
---

# Phase 02 Plan 05: ADR-0012 + UAT artifact + final pre-commit gate (Phase 2 close-out)

**One-liner:** Phase 2's close-out — wrote ADR-0012 locking the status-regression block at the service layer + the cyan-tinted auto-update event visual treatment for Phase 4 to honor; persisted the 12 Plan 02-04 browser-verify items as DEFERRED in 02-UAT.md (mirrors Phase 1's pre-merge UAT pattern); re-ran the full pre-commit gate one final time across the entire Phase 2 surface (158 tests, 6 routes, 0 dependency violations).

## Status: COMPLETE (code layer)

Both tasks shipped and committed. The 20 DEFERRED rows in 02-UAT.md are the pre-merge gate — owner walks through them in a browser before merging Phase 2 to `main`. This matches Phase 1's pattern (12 verified automatically, 2 deferred to pre-merge) and is the agreed close-out for Phase 2.

## Performance

- **Duration:** ~4.5 min (269 s)
- **Started:** 2026-05-09T10:54:50Z
- **Tasks committed:** 2 (Task 1: ADR-0012, Task 2: 02-UAT.md)
- **Files created:** 2 (`docs/decisions/0012-status-regression-block-and-auto-update-styling.md` + `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md`)
- **Files modified:** 0
- **Tests added:** 0 (plan is documentation + UAT — no code surface)
- **Total tests after:** 158 passing + 4 todo (unchanged from Plan 02-04)

## Accomplishments

- **ADR-0012 written and committed** (`21a9730`). The Nygard-format ADR locks two cross-cutting decisions Phase 2 made that Phase 4 will honor: (a) status-regression block enforced at the service layer in `applyAutoStatusChange`, with terminal-status semantics for `rejected` ↔ `withdrawn`, (b) auto-update event visual treatment in `timeline.tsx` (cyan-tinted row + 2px cyan-600 left rail + "Auto-updated from email" text label, no icon). The ADR cites the implementation files (`status-transitions.ts` ×7, `timeline.tsx` ×7) as the authoritative spec. References ADR-0005 (canonical_status enum) and ADR-0006 (hybrid trust classifier).
- **02-UAT.md written and committed** (`5e2f004`). Records the 12 browser-verify items from Plan 02-04 Task 4 plus the 5 ROADMAP phase-2 success criteria plus the 4 Lean acceptance items in a structured table. 20 rows DEFERRED to pre-merge browser walkthrough; criterion 5 (Phase 4 service contracts ready) marked PASS via code-grep verification. 29 PASS|FAIL|DEFERRED tokens — well above the verify gate's floor of 7.
- **Final pre-commit gate green.** Re-ran `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` end-to-end before the Task 2 commit: lint clean, typecheck clean, 158 tests passing + 4 todo, 6 routes built (`/`, `/_not-found`, `/applications`, `/applications/[id]`, `/applications/new`, `/login`), 0 dependency violations (1 pre-existing middleware orphan warning carried forward — not introduced by this plan).
- **Phase 2 success criteria status (5 of 5):** criteria 1-4 are DEFERRED to the pre-merge UAT walkthrough (each maps to specific UAT-02-XX rows in 02-UAT.md); criterion 5 is PASS now (code-grep verified). All 5 criteria are recorded structured in 02-UAT.md.
- **Cross-cutting trust trio status (per ROADMAP.md):** status-regression block + auto-update visual treatment **landed and locked by ADR-0012**; per-label thresholds remain a Phase 3 responsibility; undo idempotency partially landed (Plan 02-02's `undoStatusChange` marks the linked email `reviewedByUser=true`) and will be exercised end-to-end in Phase 4.

## Task Commits

| Task | Name                                                                                              | Type | Commit    | Files                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------- | ---- | --------- | ---------------------------------------------------------------------------------------------- |
| 1    | Write ADR-0012 (status-regression block + terminal semantics + auto-update visual treatment)      | docs | `21a9730` | `docs/decisions/0012-status-regression-block-and-auto-update-styling.md`                       |
| 2    | Persist Phase 2 browser-verify items as UAT (deferred to pre-merge) + final pre-commit gate       | test | `5e2f004` | `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md`                              |

## ADR-0012 sections + cross-references

```
## Context
   Sub-context A — status regression (PITFALLS.md §4 failure mode)
   Sub-context B — auto-update Event visual treatment (DESIGN.md constraints)
## Decision
   A. Status regression enforced at service layer
      - status-transitions.ts as single source of truth
      - applyAutoStatusChange enforcement site
      - applyManualStatusChange exempt (user has context)
      - Terminal-status semantics table (4 cases, exhaustive)
   B. Auto-update Event renders with cyan-tinted row + 2px cyan-600 left rail + text label
      - Tailwind class spec (bg-cyan-50, dark:bg-cyan-950/30, border-l-2, border-cyan-600, text-stone-500)
      - Label text: "Auto-updated from email" (no icon, per DESIGN.md)
      - Undone events: text-stone-400 line-through (preserves audit trail)
      - Conditional "View source email" link branch (Phase 4 wire-up)
## Consequences
   Positive (5 items)
   Negative (3 items)
## When we'd reconsider (4 trigger conditions)
## References (7 anchored sources — ADRs, ROADMAP, CONTEXT, DESIGN, implementation files, tests)
## Supersedes (None — establishes the lock)
```

Cross-references in the body and References section:

- `src/features/applications/status-transitions.ts` — 7 mentions (the rank table + `isStatusRegression`)
- `src/features/applications/components/timeline.tsx` — 7 mentions (the rendering site)
- `src/features/applications/service.ts:applyAutoStatusChange` — the enforcement site
- ADR-0005 — canonical_status enum source
- ADR-0006 — hybrid trust classifier rationale
- ADR-0011 — Supersedes convention (do NOT silently edit)
- ROADMAP.md §"Cross-Cutting Concerns" — trust trio context
- DESIGN.md §"Color palette" + §"Less icons, more humanity" + §"Tone of voice"
- `.planning/phases/02-applications-slice-manual-tracker/02-CONTEXT.md` §"Area 3" + §"Area 4"
- `src/features/applications/status-transitions.test.ts` — 36-cell truth table

## UAT outcome table (summary of `02-UAT.md`)

### Phase 2 browser-verify items (Plan 02-04 Task 4, 12 rows)

| ID         | Description (1-line)                                                                                            | Status   |
| ---------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| UAT-02-01  | `pnpm dev` boots without errors                                                                                 | DEFERRED |
| UAT-02-02  | Sign-in via `/login` lands on `/applications`                                                                   | DEFERRED |
| UAT-02-03  | Empty state CTA reachable                                                                                       | DEFERRED |
| UAT-02-04  | Capture form fillable                                                                                           | DEFERRED |
| UAT-02-05  | < 30 s + redirect + detail page renders (CAPT-01)                                                               | DEFERRED |
| UAT-02-06  | ATS-domain rejection (greenhouse.io blocked, greenhouse-inc.com allowed) (CAPT-02)                              | DEFERRED |
| UAT-02-07  | Status dropdown writes Event + bumps lastActivityAt (APP-03)                                                    | DEFERRED |
| UAT-02-08  | Stage editor Add + Mark passed (APP-04)                                                                         | DEFERRED |
| UAT-02-09  | Notes autosave on blur + persistence (APP-04)                                                                   | DEFERRED |
| UAT-02-10  | Auto-update visual: cyan rail + label, no icon, no source-email link (APP-02 + ADR-0012)                        | DEFERRED |
| UAT-02-11  | Chip filter toggle + Reset (APP-01)                                                                             | DEFERRED |
| UAT-02-12  | Sort URL toggle (APP-01)                                                                                        | DEFERRED |

### ROADMAP.md Phase 2 success criteria (5 rows)

| # | Criterion                                                                | Status   |
| - | ------------------------------------------------------------------------ | -------- |
| 1 | Capture <30 s + ATS rejection                                            | DEFERRED |
| 2 | One-tx create + Event(created)                                           | DEFERRED |
| 3 | List filter + sort + counts (chip toggle + Reset)                        | DEFERRED |
| 4 | Detail timeline + auto-update visual + inline edits                      | DEFERRED |
| 5 | Phase 4 service contracts ready (applyAuto + undo + Event.data schemas)  | PASS     |

### Lean milestone acceptance items in Phase-2 scope (4 rows)

| ID | Criterion                                                              | Status   |
| -- | ---------------------------------------------------------------------- | -------- |
| A  | Capture <30 s                                                          | DEFERRED |
| B  | Detail timeline chronological (Stages + Events; Emails empty Phase 4)  | DEFERRED |
| C  | List counts per status correct                                         | DEFERRED |
| D  | ≥3 real applications captured manually                                 | DEFERRED |

**Totals:** 21 rows recorded (29 PASS|FAIL|DEFERRED tokens including the in-row DEFERRED notes). 1 PASS (criterion 5). 0 FAIL. 20 DEFERRED.

## Phase 2 success criteria status

All 5 ROADMAP phase-2 criteria are recorded in `02-UAT.md`. Code-layer evidence:

- **Criterion 1 (capture <30 s + ATS rejection):** code paths verified — Plan 02-01 ATS-domain unit tests + Plan 02-04 capture form with collapsed-by-default salary section (~5 fields visible by default). Pre-merge UAT-02-05 + UAT-02-06 will close the visual loop.
- **Criterion 2 (one-tx create + Event):** verified by `applications/service.test.ts:createApplication` and the `withRls` integration tests (Plan 02-02). Pre-merge UAT-02-05 will visually confirm via the "Foray created" timeline entry.
- **Criterion 3 (list filter + sort + counts):** `application-list.test.ts:toggleStatusInUrl` 6 unit tests green (Plan 02-04). Pre-merge UAT-02-11 + UAT-02-12 will close the visual loop.
- **Criterion 4 (detail timeline + auto-update visual + inline edits):** `timeline.tsx` rendering branches grep-verified (Plan 02-04). Pre-merge UAT-02-07 + UAT-02-08 + UAT-02-09 + UAT-02-10 will close the visual loop.
- **Criterion 5 (Phase 4 service contracts ready):** PASS now. `grep -c "export async function applyAutoStatusChange\|export async function undoStatusChange" src/features/applications/service.ts` returns 2; `eventDataSchemaFor` exported from `applications/schema.ts`; ADR-0012 locks the contract in `docs/decisions/`. No browser interaction required.

## Cross-cutting trust-trio status (per ROADMAP.md §"Cross-Cutting Concerns")

| Concern                              | Status    | Where it lives                                                                                                 |
| ------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| Per-label classifier thresholds      | Deferred  | Phase 3 responsibility (CLASS-03 — `env.CLASSIFIER_AUTO_THRESHOLD`); not Phase 2's surface.                    |
| Status-regression block              | **Locked** | `src/features/applications/status-transitions.ts` + `applyAutoStatusChange` enforcement; ADR-0012 records it. |
| Undo idempotency (`reviewedByUser`)  | Partial   | Plan 02-02's `undoStatusChange` marks the linked email `reviewedByUser=true`. Phase 4 will exercise end-to-end on real Gmail data; the contract surface is in place. |
| Visually-distinct auto-update events | **Locked** | `src/features/applications/components/timeline.tsx` (cyan-50 + cyan-600 rail + label, no icon); ADR-0012 records the spec. |

The two trust-trio items in Phase 2's scope (status-regression block + visually-distinct events) are landed and locked by ADR-0012. Phase 4 reads the ADR + the implementation files; no re-derivation needed.

## Phase 4 readiness checklist

The four service functions Phase 4 will import from Phase 2's slice:

| Function                       | Source file                                              | Returns                                          | Notes                                                                                                  |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `createApplication`            | `src/features/applications/service.ts`                   | `Promise<Result<{applicationId, eventId}, AppError>>` | Used by capture flow + (eventually) inbox/act when classifier suggests creating a new foray.            |
| `applyAutoStatusChange`        | `src/features/applications/service.ts`                   | `Promise<Result<{event: Event \| null}, AppError>>` | **The Phase 4 contract surface.** Returns `Conflict({reason: 'STATUS_REGRESSION_REQUIRES_REVIEW'})` on regression — Phase 4 routes those emails to the review queue. |
| `undoStatusChange`             | `src/features/applications/service.ts`                   | `Promise<Result<{event: Event}, AppError>>`      | Used by the toast-undo + permanent timeline-undo affordance. Marks linked email `reviewedByUser=true` (idempotency hook for Phase 4 cron). |
| `applyManualStatusChange`      | `src/features/applications/service.ts`                   | `Promise<Result<{event: Event \| null}, AppError>>` | Bypass the regression guard — used by the user-driven dropdown only. Phase 4 won't call this; included for completeness. |

Plus the Event.data Zod schemas:

- `eventDataSchemaFor(type)` from `src/features/applications/schema.ts` — discriminated-union schema lookup. Phase 4 should use this to validate any Event row's `data` payload before reading from it. The strict() schema on `auto_status_changed` includes `emailId` so Phase 4 can wire the conditional "View source email" link in `timeline.tsx` by populating that field on real classifier writes.

ADR reference:

- `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` — Phase 4 must read this before implementing `inbox/act`. Re-implementing the regression rule elsewhere or changing the visual treatment without superseding ADR-0012 is forbidden.

## Decisions Made

1. **ADR-0012 placement at the service layer (not the controller).** Single enforcement site for the regression rule. Phase 4 becomes a thin orchestrator: try `applyAutoStatusChange`, on `Conflict` route to review queue. Documented in ADR-0012 §"Decision A" with the trade-off explained — alternative was guard-at-controller, rejected because it pushes safety to discipline.

2. **Terminal-status semantics in `STATUS_RANK`.** `rejected` and `withdrawn` both at rank 5. Non-terminal → terminal is forward (closing out is normal); terminal → non-terminal is regression (un-rejecting is human-only); terminal ↔ terminal is no-movement. Documented in ADR-0012 §"Decision A — Terminal-status semantics" as a 4-row exhaustive table. Tested by `status-transitions.test.ts` (36-cell truth table).

3. **Auto-update visual: option 3 (tinted background + colored left rail + text label, no icon).** Rejected option 1 (background-only, too subtle); rejected option 2 (icon + text, violates DESIGN.md no-icons rule). Cyan-600 chosen as the screening-hue anchor (semantically "in progress, gentle attention"). Documented in ADR-0012 §"Decision B" with all three options enumerated.

4. **All 12 Plan 02-04 browser-verify items DEFERRED to pre-merge UAT.** Mirrors Phase 1's pattern (`01-HUMAN-UAT.md` had 2 items deferred to the same pre-merge gate). User will walk through them in a single browser session before merging Phase 2 to `main`. Recorded in `02-UAT.md` with each item mapped to the originating Plan 02-04 Task 4 step + the requirement it satisfies (CAPT-01, CAPT-02, APP-01, APP-02, APP-03, APP-04, ADR-0012).

5. **Did NOT touch STATE.md, ROADMAP.md, or REQUIREMENTS.md.** Per the orchestrator's `<objective>` clause: those files are owned by the orchestrator. This executor only writes the plan's two artifacts + commits.

6. **Ran the final pre-commit gate as the LAST action before plan completion** (per Plan 02-05 `<verification>` line "is green ONE FINAL TIME"). Gate green: lint clean, typecheck clean, 158 passing + 4 todo, 6 routes built, 0 dependency violations (only the pre-existing middleware orphan warning carried forward from earlier plans).

## Auto-fixed Issues (Deviation Rules 1-3)

**None.** This plan is documentation + UAT — no code surface, no auto-fixes needed. The pre-commit gate ran clean on the first pass after both file additions.

The Next.js build emits one informational notice ("middleware file convention is deprecated; please use proxy instead") — this is a Next 16 framework deprecation warning carried forward from Plan 02-04, not an issue introduced or addressed by Plan 02-05. Documented as a known framework warning, not a deviation.

**Total deviations:** 0 auto-fixed. 0 stylistic. 0 architectural (Rule 4).

## Verification Against Plan-Level Checks

| Check                                                                                                                                                                  | Result                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` exists with ≥6 `## ` headings (Nygard format)                                                  | PASS — file exists, 6 headings: Context, Decision, Consequences, When we'd reconsider, References, Supersedes (Status + Date are bolded inline per ADR-0010/0011 convention). |
| ADR cites `status-transitions.ts`, `service.ts`, `timeline.tsx` as the implementation files                                                                            | PASS — `status-transitions` ×7, `timeline.tsx` ×7, `service.ts:applyAutoStatusChange` cited in body and References.                                                |
| `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md` exists with ≥30 lines including a structured table where ≥7 rows have a PASS/FAIL/DEFERRED status   | PASS — 113 lines, 29 PASS\|FAIL\|DEFERRED tokens (verified via `grep -cE 'PASS\|FAIL\|DEFERRED' >= 7`).                                                            |
| `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` is green ONE FINAL TIME                                                                  | PASS — lint clean, typecheck clean, 158 tests + 4 todo, 6 routes built, 0 dep violations (1 pre-existing middleware orphan warning carried forward).               |
| All 5 plans in this phase are complete: 02-01 through 02-05                                                                                                            | PASS at executor scope — Plan 02-05 complete; SUMMARY.md present at `.planning/phases/02-applications-slice-manual-tracker/02-05-SUMMARY.md`. ROADMAP.md update is the orchestrator's responsibility, not this executor's. |

## Verification Against Plan Acceptance Criteria

**Task 1 (ADR-0012):**
- [x] File exists at `docs/decisions/0012-status-regression-block-and-auto-update-styling.md`
- [x] ≥6 `## ` headings (got 6 — at floor)
- [x] References `status-transitions.ts` ≥2 times (got 7)
- [x] References `timeline.tsx` ≥2 times (got 7)
- [x] Includes literal `bg-cyan-50` (2 occurrences)
- [x] Includes literal `border-cyan-600` (3 occurrences)
- [x] Includes literal label `Auto-updated from email` (2 occurrences)
- [x] References ADR-0005 (1 occurrence) and ADR-0006 (2 occurrences)
- [x] Status reads "Accepted"
- [x] File length ≥80 lines (got 247)
- [x] `pnpm lint && pnpm typecheck` clean

**Task 2 (02-UAT.md):**
- [x] File exists at `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md`
- [x] ≥30 lines (got 113)
- [x] ≥7 PASS|FAIL|DEFERRED tokens (got 29)
- [x] Structured table with 5 ROADMAP success criteria + 4 Lean acceptance items + 12 browser-verify items
- [x] Final pre-commit gate (lint + typecheck + test:run + build + depcheck) re-run before commit, all green

## Issues Encountered

None. Both tasks completed clean on first pass. Pre-commit gate green from start.

## Known Stubs

The conditional **"View source email"** link branch in `timeline.tsx` continues to be a "Phase 4 wire-up surface" (carried forward from Plan 02-04, locked into ADR-0012 §"Decision B"). The branch's IF condition (`data.emailId != null`) renders a no-op in Phase 2 because no real Gmail data exists yet; Phase 4 will populate `emailId` on real classifier writes. This is intentional, documented, and grep-verifiable — not a defect.

## Threat Flags

None new. Plan 02-05's `<threat_model>` enumerated T-02-05-01 (ADR drift — `mitigate`) and T-02-05-02 (UAT artifact incompleteness — `accept`). No security threats introduced. ADR-0012 explicitly notes "do NOT silently edit" + Supersedes-via-new-ADR convention (matching ADR-0011).

## Next Phase Readiness

- **Phase 2 close-out is complete at the code layer.** ADR-0012 written; UAT artifact persisted; final pre-commit gate green. Pre-merge browser walkthrough by the owner remains as a process step before merging Phase 2 to `main` — this is captured in 02-UAT.md as 20 DEFERRED rows.
- **Phase 3 (Classifier + Matcher)** has no dependency on Phase 2's UI; it consumes `applyAutoStatusChange` (already shipped in Plan 02-02) and the canonical_status enum (Plan 02-01). Phase 3 can begin without waiting for the pre-merge UAT.
- **Phase 4 (Gmail Ingestion + Pipeline)** reads ADR-0012 + the four Phase 2 service functions enumerated above. The conditional "View source email" branch in `timeline.tsx` is the contract surface Phase 4 will wire by populating `data.emailId` on classifier-driven writes.

## Self-Check: PASSED

Files exist:
- `docs/decisions/0012-status-regression-block-and-auto-update-styling.md`: FOUND (verified by `test -f`)
- `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md`: FOUND (verified by `test -f`)

Commits exist:
- `21a9730` (Task 1, ADR-0012): FOUND in `git log --oneline`
- `5e2f004` (Task 2, 02-UAT.md): FOUND in `git log --oneline`

Pre-commit gate (lint + typecheck + test:run + build + depcheck): all PASS, executed end-to-end before Task 2 commit. 158 tests, 6 routes, 0 dep violations.

ADR-0012 verify gate: `[ "$(grep -c '^## ' docs/decisions/0012-status-regression-block-and-auto-update-styling.md)" -ge 6 ]` → 6 headings, PASS.

UAT verify gate: `[ "$(grep -cE 'PASS|FAIL|DEFERRED' .planning/phases/02-applications-slice-manual-tracker/02-UAT.md)" -ge 7 ]` → 29 tokens, PASS.

**Self-check status:** PASSED for all deliverables. Phase 2 close-out is shipped; pre-merge browser walkthrough is the next process step (recorded in 02-UAT.md, owner-driven).

---
*Phase: 02-applications-slice-manual-tracker*
*Plan: 05*
*Status: COMPLETE (code layer); pre-merge UAT walkthrough deferred to owner*
*Completed: 2026-05-09*
