---
phase: "02-applications-slice-manual-tracker"
plan: "01"
subsystem: "validation"
tags: ["zod", "schema", "ats-domains", "capt-02", "event-data-contract", "foundation"]
dependency_graph:
  requires:
    - "01-01 (withRls + branded ID types)"
    - "01-02 (Phase 1 surface complete — auth + tenantDb wiring shipped)"
  provides:
    - "ATS_DOMAINS + isAtsDomain — single source of truth for CAPT-02 (Phase 2) AND MATCH-02 (Phase 3)"
    - "createApplicationSchema, companyInputSchema, stageInputSchema, notesInputSchema, updateApplicationStatusSchema — Zod validation surface for Plans 02-02..02-05"
    - "eventDataSchemas + eventDataSchemaFor() — Phase 4 hard contract for Event.data per EventType (8 strict + 5 loose-passthrough fallbacks)"
  affects:
    - "02-02 services (consumes createApplicationSchema, companyInputSchema, eventDataSchemas)"
    - "02-04 actions/UI (consumes all input schemas + per-EventType data shapes)"
    - "Phase 3 matcher (consumes ATS_DOMAINS + isAtsDomain)"
    - "Phase 4 service composition (consumes autoStatusChangedData + statusUndoneData strict shapes)"
tech_stack:
  added: []
  patterns:
    - "Zod v4 idiomatic API (z.strictObject, z.looseObject, raw 'custom' issue code) — avoid deprecated .passthrough() / z.ZodIssueCode.custom"
    - "Discriminated event-data validation via eventDataSchemaFor(type) — strict per known EventType, loose passthrough fallback for unknown"
    - ".superRefine() with shared atsRejectionMessage helper — DRY error wording across two schemas"
key_files:
  created:
    - path: "src/core/domains/ats-domains.ts"
      lines: 45
      note: "15-entry hardcoded blocklist + isAtsDomain(case-insensitive, protocol-stripping, apex-or-subdomain match). No 'server-only' import — reusable on the client."
    - path: "src/core/domains/ats-domains.test.ts"
      lines: 75
      note: "11 unit tests covering protocol stripping, case-insensitivity, subdomain match, whitespace trim, near-miss rejection, list-shape invariants."
    - path: "src/features/applications/schema.ts"
      lines: 195
      note: "5 enum atoms + 5 input schemas (companyInputSchema, createApplicationSchema, updateApplicationStatusSchema, stageInputSchema, notesInputSchema) + 13 eventDataSchemas + eventDataSchemaFor() dispatcher."
    - path: "src/features/applications/schema.test.ts"
      lines: 320
      note: "31 unit tests across all schemas (C1–C7 application create, K1–K5 company input + ATS rejection, S1–S4 stage input, N1–N3 notes, E1–E12 per-EventType dispatch)."
  modified: []
decisions:
  - "Used Zod v4 idiomatic z.strictObject() / z.looseObject() instead of plan-suggested .strict() / .passthrough() chained methods. Functionally equivalent; the latter are JSDoc-deprecated in Zod v4."
  - "Used raw 'custom' string literal instead of z.ZodIssueCode.custom in addIssue() — z.ZodIssueCode is JSDoc-deprecated in Zod v4 with the docs explicitly recommending the string form."
  - "Extracted atsRejectionMessage() helper for the 2-callsite ATS error string. Justification: identical wording across companyInputSchema and createApplicationSchema; one source of truth for the user-facing error keeps tone consistent if it's ever tweaked. Per Karpathy 1.2 this is the threshold (= 2 callers, identical use). Inlined would be the choice if there were any axis-of-variation; there isn't."
  - "Used eventDataSchemaFor(type: string): z.ZodType signature instead of the plan's z.ZodTypeAny — z.ZodTypeAny is the deprecated alias; z.ZodType is the v4 idiomatic name."
metrics:
  duration_seconds: 240
  completed_date: "2026-05-09"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
requirements_completed: ["CAPT-02"]
---

# Phase 02 Plan 01: Validation Foundation Summary

**One-liner:** Shared ATS-domain blocklist (`isAtsDomain` + 15-entry hardcoded list) plus the complete applications-slice Zod schema set — including 13 per-EventType `Event.data` schemas with `emailId` baked into `autoStatusChangedData.strictObject()` so callers can't bypass strict via post-parse spread. Zero consumers in this plan; both files are pure libraries Plans 02–04 wire in.

## Performance

- **Duration:** ~4 min (plan-budget was much higher; foundation plan with no integration friction)
- **Started:** 2026-05-09T16:59:31Z
- **Completed:** 2026-05-09T17:04:30Z
- **Tasks:** 2
- **Files created:** 4 (2 modules + 2 colocated test files)
- **Tests added:** 42 (11 ATS + 31 schema)
- **Total tests after:** 57 passing, 4 todo (was 15 passing, 4 todo)

## Accomplishments

- **CAPT-02 enforced at the schema boundary.** ATS domains (greenhouse.io, lever.co, …) reject in `companyInputSchema` AND `createApplicationSchema.companyDomain` with a single shared error message. Same module runs client and server.
- **Phase 4 hard contract locked.** `eventDataSchemas` defines exactly 13 schemas — one per `EventType` enum value — with strict() on the 8 typed events (preventing post-parse spread that bypasses validation) and `looseObject({})` passthrough on the 5 not-yet-typed events (manual_classification, document_uploaded, recruiter_linked, archived, unarchived).
- **`emailId` is part of `autoStatusChangedData`'s strict shape.** Phase 4 callers MUST include it before `.parse()`. Plan-checker B2 fix (recorded in CONTEXT history): callers cannot spread emailId after parse — strict() rejects unknown keys.
- **ATS list is the single source of truth.** Phase 3 matcher will `import { isAtsDomain, ATS_DOMAINS }` from the same module — no duplicated blocklist.
- **Pre-commit gate green.** lint, typecheck, test:run (57 passing), build, depcheck all clean.

## Task Commits

| Task | Name                                                              | Type | Commit    | Files                                                                                            |
| ---- | ----------------------------------------------------------------- | ---- | --------- | ------------------------------------------------------------------------------------------------ |
| 1    | ATS-domain blocklist + isAtsDomain helper (TDD red→green)         | feat | `85def42` | `src/core/domains/ats-domains.ts`, `src/core/domains/ats-domains.test.ts`                        |
| 2    | Applications-slice Zod schemas + per-EventType data contracts     | feat | `21ed531` | `src/features/applications/schema.ts`, `src/features/applications/schema.test.ts`                |

_TDD note: per-task RED/GREEN was inlined into a single commit per task because the test file is created and the implementation file is created in the same atomic unit; there's no production consumer touching either file in this plan, so a separate test-first commit would be visual-only with nothing to break against._

## Locked Invariants (Phase 4 + Plan 02 contract)

| Invariant                                | Value                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ATS_DOMAINS.length`                     | exactly 15 (greenhouse.io, lever.co, workday.com, myworkdayjobs.com, linkedin.com, ashbyhq.com, smartrecruiters.com, jobvite.com, icims.com, taleo.net, recruitee.com, breezy.hr, bamboohr.com, indeed.com, glassdoor.com) |
| `companyName` max                        | 120 chars                                                                                                      |
| `roleTitle` max                          | 160 chars                                                                                                      |
| `roleUrl` max                            | 2048 chars (URL-validated)                                                                                     |
| `jobDescription` max                     | 50,000 chars                                                                                                   |
| application-level `notes` max            | 2,000 chars (createApplicationSchema), 10,000 chars (notesInputSchema autosave editor)                         |
| stage `notes` max                        | 2,000 chars                                                                                                    |
| salary range refine                      | `salaryMin > salaryMax` → message contains "salary range invalid"                                              |
| ATS error wording                        | `That looks like an ATS domain ({domain}). Use the company's actual domain (e.g., stripe.com) — ATS platforms aren't the company you're applying to.` |
| `eventDataSchemas` keys (must equal 13)  | created, status_changed, auto_status_changed, status_undone, stage_added, stage_completed, email_received, note_added, manual_classification, document_uploaded, recruiter_linked, archived, unarchived |
| `autoStatusChangedData` shape            | `strictObject({ previousStatus, newStatus, classifierConfidence?: 0..1, classifiedBy?, emailId?: positive int })` |
| Unknown EventType fallback               | `z.looseObject({})` (extras pass through; timeline can fall back to "Event #{id}")                             |

## Files Created/Modified

- `src/core/domains/ats-domains.ts` (NEW, 45 LOC) — ATS_DOMAINS const, AtsDomain type, isAtsDomain function. Pure module; no `'server-only'` import.
- `src/core/domains/ats-domains.test.ts` (NEW, 75 LOC) — 11 unit tests; pure-function tests, zero mocks.
- `src/features/applications/schema.ts` (NEW, 195 LOC) — All slice Zod schemas + per-EventType data dispatcher. 17 exports.
- `src/features/applications/schema.test.ts` (NEW, 320 LOC) — 31 unit tests across all 6 logical groups.

No files modified. No `.planning/` files touched (orchestrator owns STATE.md / ROADMAP.md per the prompt's `<sequential_execution>` clause).

## Decisions Made

1. **Zod v4 idiomatic API substitutions** (Karpathy 1.3 — match current codebase style; not a behaviour change):
   - `z.strictObject({...})` instead of `z.object({...}).strict()` — both valid, the former is shorter and Zod v4's preferred form.
   - `z.looseObject({})` instead of `z.object({}).passthrough()` — the latter is JSDoc-deprecated in Zod v4.4.3.
   - `code: 'custom'` (string literal) instead of `code: z.ZodIssueCode.custom` — `z.ZodIssueCode` is JSDoc-deprecated with the typedoc explicitly saying "Use the raw string literal codes instead, e.g. 'invalid_type'".
   - `eventDataSchemaFor(type: string): z.ZodType` instead of `: z.ZodTypeAny` — `z.ZodTypeAny` is a deprecated alias for `z.ZodType` in v4.

2. **Extracted `atsRejectionMessage(domain)` helper** for the 2-callsite ATS error string. CLAUDE.md §1.2 says "Three similar lines is better than a premature abstraction" — but this is one ~80-char string used identically in two schemas with zero axis-of-variation. The Sandi Metz threshold is "extract only if all sites share their axis of variation" — they do (the only thing that varies is the input domain, which is a parameter). One callsite would inline; two with literal-identical wording is the right time to extract one tiny helper.

## Deviations from Plan

### Auto-fixed Issues

None substantive. The Zod v4 idiomatic substitutions above are not deviations — the plan's example code worked, but used JSDoc-deprecated APIs that the codebase's clean lint/typecheck would still pass (deprecation is a JSDoc tag, not a `@typescript-eslint/no-deprecated` enforcement). Choosing the non-deprecated form is the surgical Karpathy 1.3 call: match current Zod v4 style.

The `atsRejectionMessage` helper extraction (vs the plan's inline string literal in two places) is a Karpathy 1.2 judgment call documented in Decisions above. Not a Rule 1/2/3 trigger; it's a stylistic choice that matches the "extract only when wording is identical and a parameter cleanly captures the variation" threshold.

**Total deviations:** 0 auto-fixed (Rules 1/2/3). 4 stylistic substitutions documented under Decisions for traceability.
**Impact on plan:** None. All acceptance criteria met as written. All `<must_haves.truths>` verified by passing tests.

## Issues Encountered

None.

## Verification Against Plan-Level Checks

| Check                                                                                            | Result                                                                                  |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm test:run -- src/core/domains/`                                                             | PASS — 11 tests green                                                                   |
| `pnpm test:run -- src/features/applications/schema.test.ts`                                      | PASS — 31 tests green                                                                   |
| `pnpm lint`                                                                                      | PASS — no issues                                                                        |
| `pnpm typecheck`                                                                                 | PASS — clean                                                                            |
| `pnpm build`                                                                                     | PASS — Next.js 16.2.6, 3 routes (/ /login /_not-found), no schema.ts imports yet        |
| `pnpm depcheck`                                                                                  | PASS (exit 0) — only pre-existing `src/middleware.ts` orphan warning                    |
| `grep -r "from '@/features/applications/schema'" src/`                                           | (empty — no consumers in this plan, as expected)                                        |
| `grep -r "from '@/core/domains/ats-domains'" src/`                                               | 1 hit (`src/features/applications/schema.ts:13`)                                        |

## Verification Against Plan Acceptance Criteria

**Task 1:**
- [x] `src/core/domains/ats-domains.ts` exists
- [x] `grep -c "'greenhouse.io'" …` returns 1
- [x] `grep -E "^export (const\|function\|type)" …` shows exactly 3 exports (ATS_DOMAINS, AtsDomain, isAtsDomain)
- [x] `grep -F -c "it(" …test.ts` returns 11
- [x] Test file passes 11/11 green
- [x] typecheck + lint + depcheck clean
- [x] No `'server-only'` import in ats-domains.ts

**Task 2:**
- [x] `src/features/applications/schema.ts` exists
- [x] 17 `^export ` matches (≥ 13 required)
- [x] 3 `isAtsDomain` matches (≥ 2 required)
- [x] 4 `emailId` matches (≥ 2 required) — covers `autoStatusChangedData` + `emailReceivedData` plus 2 in-comment references
- [x] Test file has 31 `it(` blocks (≥ 28 required)
- [x] All 31 tests pass green
- [x] typecheck + lint + depcheck + build all clean
- [x] `eventDataSchemas` has exactly 13 keys matching the 13 EventType enum values
- [x] No `any`, no `'use client'`, no direct prisma imports

## Known Stubs

None. Both modules are fully implemented; there is intentionally no consumer wiring in this plan (per `<contract>` and `<verification>` — "no consumers yet; Plan 02 will be the first" is the planned state).

## Threat Flags

None. No new trust boundaries introduced (per the plan's `<threat_model>` section: this plan is pure logic, both modules ship zero I/O / zero auth surface / zero DB writes). The ATS error message echoes user input but is rendered through React's auto-escaping — no XSS path.

## Next Phase Readiness

Plan 02 (services) and Plan 04 (UI/actions) can now both `import { createApplicationSchema, companyInputSchema, stageInputSchema, notesInputSchema, eventDataSchemaFor, … } from '@/features/applications/schema'` against a frozen contract. Phase 3 matcher can `import { isAtsDomain, ATS_DOMAINS } from '@/core/domains/ats-domains'` for MATCH-02 sender-domain skip rule. Nothing in this plan blocks any other plan in the wave; the next plan in the wave should be unblocked the moment the orchestrator advances state.

## Self-Check: PASSED

Files exist:
- `src/core/domains/ats-domains.ts`: FOUND
- `src/core/domains/ats-domains.test.ts`: FOUND
- `src/features/applications/schema.ts`: FOUND
- `src/features/applications/schema.test.ts`: FOUND

Commits exist:
- `85def42` (Task 1, ATS module): FOUND
- `21ed531` (Task 2, schemas): FOUND

Pre-commit gate (lint + typecheck + test:run + build + depcheck): all PASS, executed end-to-end after Task 2 commit.

---
*Phase: 02-applications-slice-manual-tracker*
*Plan: 01*
*Completed: 2026-05-09*
