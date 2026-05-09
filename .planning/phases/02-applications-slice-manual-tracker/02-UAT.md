---
status: deferred
phase: 02-applications-slice-manual-tracker
source: [02-04-PLAN.md Task 4, 02-05-PLAN.md Task 2]
started: 2026-05-09T10:54:50Z
updated: 2026-05-09T10:54:50Z
---

# Phase 2 UAT — Lean Acceptance Walkthrough

**Date:** 2026-05-09
**Verifier:** Duy (Edward Pham) — owner
**Mode:** Pre-merge UAT (matches Phase 1 pattern: `.planning/phases/01-foundation-auth/01-HUMAN-UAT.md`)

## Decision

All browser-verify items from Plan 02-04 Task 4 are **DEFERRED to pre-merge UAT**.
The owner will walk through them in a single browser session before merging
Phase 2 to `main`. This mirrors Phase 1's pattern, where 12/14 verifications were
run automatically and 2 (login flow + middleware redirect) were deferred to the
same pre-merge gate.

The code-layer surface is fully shipped and pre-commit-gate-green: 158 passing
tests, lint + typecheck + build + depcheck all clean (re-confirmed at the end of
Plan 02-05 Task 2 pre-flight). The DEFERRED status here is a process choice —
visual + interactive behavior is verified by humans, not by automation.

---

## Phase 2 Browser-Verify Checklist (Plan 02-04 Task 4)

The 12 enumerated browser checks from `02-04-PLAN.md` §`<task type="checkpoint:human-verify">`
Task 4 `<how-to-verify>`. Each will be exercised in the pre-merge browser walkthrough.

| ID         | Description                                                                                                  | Status   | Notes                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------- |
| UAT-02-01  | Run `pnpm dev`; server boots without errors                                                                  | DEFERRED | Pre-merge browser verification                     |
| UAT-02-02  | Sign in via `/login` with `APP_PASSWORD`; lands on `/applications`                                           | DEFERRED | Pre-merge browser verification                     |
| UAT-02-03  | Empty state visible OR existing forays render; CTA "Capture your first foray" reachable                      | DEFERRED | Pre-merge browser verification                     |
| UAT-02-04  | Capture form fillable: company "Stripe", role "Senior Product Manager", source "linkedin", click Save        | DEFERRED | Pre-merge browser verification                     |
| UAT-02-05  | Stopwatch < 30 s end-to-end; redirected to `/applications/[id]`; detail renders header + status badge + timeline "Foray created" | DEFERRED | CAPT-01 acceptance — pre-merge browser verification |
| UAT-02-06  | ATS-domain rejection: domain "greenhouse.io" → inline error fires; domain "greenhouse-inc.com" → submits     | DEFERRED | CAPT-02 acceptance — pre-merge browser verification |
| UAT-02-07  | Status dropdown changes status; timeline gains a "Status changed: applied → screening" row; lastActivityAt bumps on list | DEFERRED | APP-03 acceptance — pre-merge browser verification |
| UAT-02-08  | Stage editor: Add stage "Recruiter call" → appears; "Mark passed" → outcome shown + timeline gains "Stage completed (passed)" | DEFERRED | APP-04 acceptance — pre-merge browser verification |
| UAT-02-09  | Notes autosave on blur: type → click outside → "Saved" indicator → timeline gains "Note updated"; refresh persists | DEFERRED | APP-04 acceptance — pre-merge browser verification |
| UAT-02-10  | Auto-update visual: run `pnpm tsx scripts/dev/insert-fake-auto-event.ts` → refresh detail → cyan-tinted row + cyan-600 left rail + "Auto-updated from email" label, NO icon, NO source-email link (emailId undefined) | DEFERRED | APP-02 + ADR-0012 acceptance — pre-merge browser verification |
| UAT-02-11  | Chip filter: `/applications?status=rejected` → empty-state copy; chip click toggles add/remove in URL; "Reset" link → `/applications` | DEFERRED | APP-01 acceptance — pre-merge browser verification |
| UAT-02-12  | Sort: `/applications?sort=appliedAt:desc` → order changes (most-recently-applied first)                      | DEFERRED | APP-01 acceptance — pre-merge browser verification |

## Phase 2 Success Criteria (ROADMAP.md §"Phase 2")

These are the contract gates the ROADMAP enumerates for Phase 2. Each is mapped
to the UAT row(s) above and the code-layer evidence already in the repo.

| # | Criterion                                                                                            | Status   | Notes                                                                                  |
| - | ---------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| 1 | Capture <30 s + ATS domain rejection client + server                                                 | DEFERRED | Code path verified by Plan 02-04 + Plan 02-01 unit tests; UAT-02-05 + UAT-02-06 will close the visual loop. |
| 2 | One transaction for create + Event(created)                                                          | DEFERRED | Verified by `applications/service.test.ts:createApplication` + `withRls` integration test (Plan 02-02 — 158 tests green). UAT-02-05 will visually confirm via "Foray created" timeline entry. |
| 3 | List filter + sort + per-status counts (chip toggle + Reset)                                         | DEFERRED | `application-list.test.ts:toggleStatusInUrl` 6 unit tests green (Plan 02-04). UAT-02-11 + UAT-02-12 will close the visual loop. |
| 4 | Detail timeline + auto-update visual distinction + inline edits                                      | DEFERRED | `timeline.tsx` rendering branch grep-verified (Plan 02-04). UAT-02-07 + UAT-02-08 + UAT-02-09 + UAT-02-10 will close the visual loop. |
| 5 | Phase 4 service contracts ready (`applyAutoStatusChange`, `undoStatusChange`, Event.data Zod schemas) | PASS     | Code-grep verified now: `grep -c "export async function applyAutoStatusChange\|export async function undoStatusChange" src/features/applications/service.ts` returns 2; `eventDataSchemaFor` exported from `applications/schema.ts`. ADR-0012 locks the contract. No browser interaction required. |

## Lean Acceptance Criteria (`docs/milestones/lean.md`, Phase-2 scope)

These are the Lean milestone's acceptance items that fall in Phase 2's surface
(the rest belong to Phases 3 / 4 / 5).

| ID | Criterion                                                                                       | Status   | Notes                                                                              |
| -- | ----------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| A  | Capture form completes in <30 s                                                                 | DEFERRED | Same gate as UAT-02-05. Pre-merge browser verification.                            |
| B  | Detail timeline is chronological, merging Stages + Events (Emails empty until Phase 4)          | DEFERRED | `timeline.tsx` sort logic grep-verified; UAT-02-07 + UAT-02-10 close the visual loop. Email rendering branch deferred to Phase 4 (no Gmail wired). |
| C  | List shows correct counts per status                                                            | DEFERRED | `countApplicationsByStatus` query unit-tested (Plan 02-02). UAT-02-11 closes the visual loop. |
| D  | ≥3 real applications captured manually via the form (not seed) to validate the workflow         | DEFERRED | Pre-merge: owner will capture ≥3 real forays during UAT walkthrough.                |

## Deferred to Later Phases (out-of-scope for Phase 2)

These items are explicitly out-of-scope for Phase 2's UAT — they belong to
later phases:

- Email-based timeline entries (real Gmail data) → Phase 4
- Auto-update Event with real classifier signal → Phase 3 + Phase 4 (Phase 2
  used a fake-event fixture via `scripts/dev/insert-fake-auto-event.ts` for
  visual verification only)
- Status-regression block fired by real classifier → Phase 4 (Phase 2 verified
  by `applications/service.test.ts` unit tests for `applyAutoStatusChange` +
  the 36-cell `status-transitions.test.ts` truth table)
- "View source email" link rendering exercised end-to-end → Phase 4 wires
  `/inbox/[emailId]`; the conditional branch already exists in `timeline.tsx`
  per ADR-0012

## Issues Found

(None recorded yet — pre-merge UAT walkthrough is the next opportunity to
record any.)

## Sign-off

**Pending — pre-merge browser walkthrough by owner before merging Phase 2 to `main`.**

Approval recorded here will close all DEFERRED rows above and unblock the
merge. Phase 1's `01-HUMAN-UAT.md` follows the same pattern: rows persist as
DEFERRED until the pre-merge session, then get flipped to PASS / FAIL.

---

## Summary

- **Total rows:** 21 (12 browser checks + 5 ROADMAP success criteria + 4 Lean acceptance items)
- **PASS:** 1 (criterion 5 — Phase 4 service contracts ready, code-grep verified)
- **FAIL:** 0
- **DEFERRED:** 20

Verify gate (Plan 02-05 Task 2): `grep -cE 'PASS|FAIL|DEFERRED' .planning/phases/02-applications-slice-manual-tracker/02-UAT.md` ≥ 7 — satisfied (21 status tokens recorded).
