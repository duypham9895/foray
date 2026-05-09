---
phase: 03-classifier-matcher
plan: 05
subsystem: docs
tags: [adr-amendment, asymmetric-thresholds, trust-trio, uat-artifact, pre-merge-verification, pitfall-4-defense, trust-contract]

# Dependency graph
requires:
  - phase: 03-classifier-matcher (Plan 01)
    provides: thresholds.ts THRESHOLDS map + meetsThreshold; budget.ts checkBudget + appendCostEntry; FAIL CLOSED pattern
  - phase: 03-classifier-matcher (Plan 02)
    provides: classifyEmail composition (rules → budget → LLM → cost log); MODEL constant
  - phase: 03-classifier-matcher (Plan 03)
    provides: matchEmail; withRls usage pattern (deviation from original tenantDb plan)
  - phase: 03-classifier-matcher (Plan 04)
    provides: 10 anonymized fixtures + harness; W3-tightened 0.80-tier rejection regex; subject-only recruiter_outreach 0.80
  - phase: 02-applications-slice (ADR-0012 §A + §B)
    provides: status-regression block + auto-update visual treatment; the existing trust-trio container ADR
provides:
  - "ADR-0012 §C — Asymmetric per-label classifier thresholds (in-place amendment, not supersession)"
  - "ADR-0012 Pitfall #4 — never quietly lower REJECTION_FLOOR (recovery UX gate + supersession requirement)"
  - "ADR-0012 §C bonus — budget guard as control-not-monitoring (FAIL CLOSED)"
  - "ADR-0012 supersession exception clause — documents §C as the recorded exception to the supersession rule"
  - "03-UAT.md — phase 3 pre-merge UAT artifact (5 ROADMAP + 7 requirements + 5 manual + 6 trust-trio rows)"
  - "Final pre-commit gate captured: 275 passing tests, 6 routes, depcheck clean"
affects: [04-gmail-pipeline, 05-review-queue]

# Tech tracking
tech-stack:
  added: []  # docs-only plan — no code changes, no dependencies added
  patterns:
    - "In-place ADR amendment for originally-deferred scope: append (not edit) when the original ADR's intent INCLUDED the deferred section. Document the amendment as the explicit exception to the supersession rule."
    - "UAT artifact pattern (mirrors 02-UAT.md): 5 ROADMAP + 7 requirements + manual items, each row carries PASS/FAIL/DEFERRED status + evidence column"
    - "Lockstep code-paths reference in ADR: the threshold-change checklist names every file that must update together (thresholds.ts, service.ts, budget.ts, plus colocated tests). Saves a future maintainer from re-deriving the integration map."

key-files:
  created:
    - ".planning/phases/03-classifier-matcher/03-UAT.md (147 LOC) — pre-merge UAT artifact"
  modified:
    - "docs/decisions/0012-status-regression-block-and-auto-update-styling.md (+112 lines, -1 line) — added Sub-context C, Decision C, Pitfall #4, References bullets, supersession exception clause, Date amended"

key-decisions:
  - "W4 plan-checker exception accepted: ADR-0012 amended in-place (not superseded) because the original ADR's scope INCLUDED the trust trio per ROADMAP §Cross-Cutting Concerns. The threshold leg was always intended to close in Phase 3; appending §C is the natural completion, not a revision. Supersession-rule exception documented explicitly in the Supersedes section so future readers know this is a one-off exception, not the new norm."
  - "Followed plan's locked threshold values 0.92 / 0.85 / 0.80 / 0.70 / 1.0 verbatim — these are the values shipped in src/features/classifier/thresholds.ts (Plan 03-01) and verified by the plan's grep-based <verify> block."
  - "Added Pitfall #4 (never quietly lower REJECTION_FLOOR) to lock the asymmetric-cost reasoning at the ADR layer. Anyone proposing to lower REJECTION_FLOOR below 0.92 must (a) measure recent precision, (b) propose a recovery UX (which Phase 3 does NOT ship), and (c) supersede this ADR — i.e., the change crosses the asymmetric-cost reasoning so it is no longer a tunable, it is a new decision."
  - "UAT items are heavily DEFERRED (5 of 5 manual items + 2 trust-trio rows) because Phase 3 has minimal browser-verify needs (no UI). Most criteria are PASS now (in-code coverage). The owner's pre-merge walkthrough is the single optional real-LLM smoke test (UAT-03-03) plus the privacy regression follow-up (UAT-03-04)."
  - "Did NOT touch STATE.md, ROADMAP.md, or REQUIREMENTS.md. The orchestrator owns those updates per the standard close-out pattern (matches Plan 02-05's precedent)."

patterns-established:
  - "ADR amendment-vs-supersession test: amendment is allowed when (a) the original ADR's intent included the new section, AND (b) the new section is appended (not editing existing content). Otherwise, supersede via a new ADR. The §C amendment lands as the documented exception so the rule itself stays clear."
  - "Lockstep-code-paths block in ADRs that span multiple files: enumerate every file that must update together. Future maintainer can grep the ADR to find the integration map without re-deriving it."
  - "Per-phase UAT artifact persists pre-merge verifications: 5 ROADMAP + N requirements + ≥4 manual rows. Total ≥10 PASS|FAIL|DEFERRED tokens. PASS for in-code; DEFERRED for items needing owner CLI/browser walkthrough; FAIL only when something is actually broken at the layer."

requirements-completed: [CLASS-03]

# Metrics
duration: ~25min
completed: 2026-05-09
---

# Phase 03 Plan 05: ADR-0012 §C amendment + Phase 3 UAT artifact + final pre-commit gate

**ADR-0012 closes the trust trio with §C asymmetric per-label classifier thresholds (rejection 0.92 > interview_invite 0.85 > recruiter_outreach 0.80 > noise 0.70 > unmatched 1.0) plus Pitfall #4 against quietly lowering REJECTION_FLOOR; phase 3 UAT artifact persists 27 PASS/FAIL/DEFERRED rows for the owner's pre-merge walkthrough; final pre-commit gate captured at 275 passing tests, 6 build routes, depcheck clean.**

## Performance

- **Duration:** ~25 min (one full re-attempt after the first ADR Edit operations did not persist; second pass re-applied both edits + Pitfall #4 + supersession-exception clause + References)
- **Started:** 2026-05-09T19:35:00Z (approx, after plan load + initial reads)
- **Completed:** 2026-05-09T20:00:00Z (after final pre-commit gate captured)
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files created:** 1 (`.planning/phases/03-classifier-matcher/03-UAT.md`)
- **Files modified:** 1 (`docs/decisions/0012-status-regression-block-and-auto-update-styling.md`, +112 / -1)
- **Tests added:** 0 — docs-only plan
- **Total test suite:** 275 passing / 4 todo / 279 (unchanged from Plan 03-04 baseline)

## Accomplishments

- **ADR-0012 §C asymmetric per-label classifier thresholds locked.** The amendment is appended (not editing §A or §B) and adds: (1) Sub-context C explaining the asymmetric-cost reasoning under Context, (2) Decision C with the locked threshold table (0.92 / 0.85 / 0.80 / 0.70 / 1.0) plus the typed-map-vs-env-var argument, (3) Pitfall #4 against quietly lowering `REJECTION_FLOOR`, (4) the budget-guard-as-control bonus section, (5) lockstep code-paths checklist, (6) appended References bullets. `thresholds.ts` is referenced 4× (≥3 floor) so a future redesign can find both ADR + impl via `git grep`.
- **Documented exception to the supersession rule.** ADR-0012's Supersedes section gains a new paragraph that records §C as the explicit, one-off exception: future amendments to visual/regression-semantics MUST supersede; this one is appended-not-edited because the original ADR's scope INCLUDED the trust trio (per ROADMAP §Cross-Cutting Concerns) and the threshold leg was deferred only because it required a working classifier.
- **03-UAT.md persists 27 PASS/FAIL/DEFERRED tokens** across 5 ROADMAP success criteria, 7 v1 requirement IDs (CLASS-01..04 + MATCH-01..03), 5 manual verification items, and 6 cross-cutting trust-trio rows. Every row has an Evidence column linking to the SUMMARY/test-file/file-line that locks the criterion. PASS=14, DEFERRED=7, FAIL=0.
- **Final pre-commit gate green:** lint clean, typecheck clean, **275 passing tests** / 4 todo / 279 total (unchanged from Plan 03-04 baseline), build succeeds with 6 routes (`/`, `/_not-found`, `/applications`, `/applications/[id]`, `/applications/new`, `/login`) plus the proxy middleware, depcheck reports 0 errors / 1 warning (the pre-existing `no-orphans: src/middleware.ts` carried over from Phase 1, still un-fixed and not in scope).
- **STATE/ROADMAP/REQUIREMENTS untouched** per the orchestrator's-responsibility convention (matches Plan 02-05 precedent). The Phase 3 close-out commit is two clean commits in this plan + the orchestrator's metadata commit will follow.

## Task Commits

Each task was committed atomically:

1. **Task 1: amend ADR-0012 with §C asymmetric thresholds** — `b7db596` (docs)
2. **Task 2: persist phase 3 UAT artifact (deferred to pre-merge)** — `ad2968c` (test — UAT artifacts are persisted-verification fixtures per the 02-UAT.md precedent)

_Both commits pass `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck`. Task 2's commit was preceded by the live final-gate run; the UAT file's "Final pre-commit gate" section was updated inline with the actuals captured during that run._

## Files Created/Modified

### Created (1)

- `.planning/phases/03-classifier-matcher/03-UAT.md` — 147 lines. Frontmatter + decision rationale + 4 tables (5 ROADMAP rows, 7 requirement rows, 5 manual rows, 6 trust-trio rows) + "Deferred to later phases" + final gate capture + Phase 4 readiness import block + sign-off + summary footer. 27 PASS/FAIL/DEFERRED tokens.

### Modified (1)

- `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` — +112 lines, -1 line. Changes:
  - Date line: `2026-05-09` → `2026-05-09 (amended 2026-05-09 — added Decision C)`
  - New `### Sub-context C — per-label threshold asymmetry` appended after `Sub-context B`
  - New `### C. Asymmetric per-label classifier thresholds (Phase 3 — added 2026-05-09)` appended after `### B. Auto-update Event renders ...` (LIVES BEFORE `## Consequences`, per the plan's "between Decision B and ## Consequences" instruction)
  - Decision C body: locked threshold table, typed-map argument, env-var deprecation, Pitfall #4, budget-guard-as-control bonus, lockstep code-paths checklist
  - Appended 5 References bullets (thresholds.ts, budget.ts, service.ts, 03-CONTEXT.md, PITFALLS.md §4)
  - Appended supersession exception paragraph under Supersedes
- §A and §B remain word-for-word identical (verified by re-reading lines 75–155 against the pre-edit cached version). The amendment is purely additive.

### ADR-0012 verification grep summary (after the amendment commit)

| Check                                             | Required | Actual |
| ------------------------------------------------- | -------- | ------ |
| `^## ` headings                                   | ≥6       | 6      |
| `Asymmetric per-label classifier thresholds`      | ≥1       | 1      |
| `thresholds.ts` references                        | ≥3       | 4      |
| `rejection.*0.92` ⌳ `0.92.*rejection`             | ≥1       | 2      |
| `interview_invite.*0.85` ⌳ `0.85.*interview_invite` | ≥1       | 1      |
| `noise.*0.70` ⌳ `0.70.*noise`                     | ≥1       | 1      |
| `unmatched.*1.0` ⌳ `1.0.*unmatched`               | ≥1       | 1      |
| `budget.ts` references                            | ≥1       | 5      |
| `FAIL CLOSED` (or `fail closed`)                  | ≥1       | 1      |
| `amended 2026-05-09`                              | ≥1       | 1      |
| `^### ` subsections                               | ≥5       | 8      |

All plan-spec'd grep checks satisfied.

### 03-UAT.md verification grep summary

| Check                                  | Required | Actual |
| -------------------------------------- | -------- | ------ |
| Total lines                            | ≥30      | 147    |
| `PASS\|FAIL\|DEFERRED` tokens          | ≥10      | 27     |
| `CLASS-(01\|02\|03\|04)` mentions      | ≥4       | 4      |
| `MATCH-(01\|02\|03)` mentions          | ≥3       | 3      |
| `ANTHROPIC_API_KEY` mentions           | ≥1       | 3      |
| `classifier-log.jsonl` mentions        | ≥1       | 2      |

All plan-spec'd grep checks satisfied.

## W4 plan-checker note — exception explicitly documented

The plan-checker's W4 noted that ADR-0012 contains a self-rule (~line 245 of the original ADR) saying:

> Future ADRs amending the visual treatment or regression semantics MUST mark themselves as superseding this one (do **not** silently edit) — see ADR-0011 §"Supersedes" for the established convention.

Plan 03-05 amends ADR-0012 in-place rather than superseding. This is a deliberate exception, justified because:

1. **The original ADR's intent INCLUDED the trust trio.** ADR-0012's Context section names the trust trio explicitly: "per-label thresholds (Phase 3), status-regression block + undo idempotency (Phase 2 + Phase 4), and visually-distinct event styling (Phase 2 + Phase 5)." Phase 2 only covered §A + §B; the threshold half was deferred to Phase 3 because it required a working classifier slice. Decision C is therefore the natural completion of the original scope.
2. **The amendment IS visible.** It is date-stamped (`amended 2026-05-09 — added Decision C`), appended as a new ## subsection (not editing §A or §B), and the Supersedes section now carries an explicit "documented exception" paragraph. This is the opposite of "silent editing."
3. **The supersession rule itself is preserved.** Future amendments to visual treatment or regression semantics MUST supersede. The exception's scope is narrow: appending originally-deferred trust-trio scope. The supersession-exception paragraph in the ADR draws the line explicitly: "edits to existing §A or §B content require supersession; appending the originally-deferred §C does not."

This is the recorded one-off. Future maintainers reading the ADR see both the rule AND the exception in the same document — the supersession discipline stays clean.

## Final pre-commit gate

Re-ran as the LAST action of Plan 03-05, before creating this SUMMARY:

```bash
pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck
```

| Gate              | Result | Detail                                                                                                                                                                                                                  |
| ----------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`       | PASS   | `ESLint: No issues found` (0 errors, 0 warnings)                                                                                                                                                                        |
| `pnpm typecheck`  | PASS   | `tsc --noEmit` exits 0                                                                                                                                                                                                  |
| `pnpm test:run`   | PASS   | 19 test files, **275 passing / 4 todo / 279 total**. Duration 8.15s. Note: there is one expected pino error log line during the budget.test.ts FAIL CLOSED test — this is the audit signal, not a test failure.        |
| `pnpm build`      | PASS   | Next.js 16.2.6 + Turbopack. 6 routes (`/`, `/_not-found`, `/applications`, `/applications/[id]`, `/applications/new`, `/login`) plus the proxy middleware. (Framework emits a `middleware → proxy` migration prompt; not a regression.) |
| `pnpm depcheck`   | PASS   | `depcruise src --config .dependency-cruiser.cjs` — 75 modules, 153 dependencies cruised; 0 errors, 1 warning. The single warning is `no-orphans: src/middleware.ts`, pre-existing and unchanged from Plan 03-04 baseline. |

## Decisions Made

1. **In-place amendment (not supersession)** — see "W4 plan-checker note" section above for the full justification. Documented in the ADR's Supersedes section as the explicit one-off exception.
2. **Followed plan's locked threshold values verbatim:** 0.92 / 0.85 / 0.80 / 0.70 / 1.0. These are the values already shipped in `src/features/classifier/thresholds.ts` (Plan 03-01); the plan's <verify> grep-block locks them in the ADR too. No discretionary tuning at this layer.
3. **Added Pitfall #4 (never quietly lower `REJECTION_FLOOR`)** — strengthens the asymmetric-cost reasoning at the ADR layer. Without this, a future operator's "let's auto-apply at 0.90" suggestion has no documented pushback. With it, the suggestion triggers (a) precision measurement, (b) recovery UX requirement (which Phase 3 does NOT ship), and (c) supersession of ADR-0012. This is Rule 2 (auto-add missing critical functionality) at the documentation layer.
4. **Added supersession-exception clause inside ADR-0012's Supersedes section** — makes the §C exception self-documenting at the ADR level. A future maintainer reading the ADR sees both the rule and the recorded exception in the same paragraph.
5. **UAT items DEFERRED, not PASS, for the manual rows** — even though the in-code criteria are PASS, the manual items (UAT-03-01 through UAT-03-05) require an owner CLI walkthrough that hasn't happened yet. DEFERRED is the honest status. UAT-03-03 + UAT-03-04 are the only ones that touch live infrastructure (real LLM call + classifier-log.jsonl); the others are local-only sanity checks.
6. **Did NOT touch STATE/ROADMAP/REQUIREMENTS** — orchestrator owns those updates. Plan 02-05's SUMMARY documented the same precedent explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Pre-commit hook commit-msg subject ≤72-char limit triggered an aborted first commit attempt**

- **Found during:** Task 1 first commit attempt — `scripts/check-commit-msg.mjs` rejected my initial subject `"docs(03-05): amend ADR-0012 with §C asymmetric per-label thresholds and pitfall 4"` because the subject body was over the 72-char ceiling enforced by the `Subject too long` rule.
- **Issue:** A long descriptive subject is allowed by Conventional Commits but not by this repo's commit-msg hook. The first attempt failed, leaving the ADR uncommitted. (Re-investigation showed the larger Edit operation may also have been aborted by the failed hook, so I re-applied the full amendment from scratch in a second pass.)
- **Fix:** Rewrote the subject as `"docs(03-05): amend ADR-0012 with section C asymmetric thresholds"` (61 chars including type/scope), kept all the detail in the commit body (which has no length limit, only line-wrap convention).
- **Files modified:** None — workflow change only.
- **Verification:** Second commit attempt landed cleanly as `b7db596`. Commit body retains all 13 bullet points capturing the change set.
- **Committed in:** `b7db596` (Task 1 commit).

**2. [Rule 2 — Missing Critical] Added Pitfall #4 to the ADR (never quietly lower `REJECTION_FLOOR`)**

- **Found during:** Task 1 — drafting Decision C revealed the asymmetric threshold table makes the trust contract LEGIBLE but does NOT lock against a future operator's "let's just lower 0.92 to 0.85, more rejections will auto-apply" suggestion. Without an explicit pitfall, the asymmetric-cost reasoning lives only in the table's prose, which a hurried PR reviewer might skim past.
- **Issue:** Plan body says to add Decision C with the threshold table; it does NOT mention adding a Pitfall #4 paragraph or extending the existing pitfalls list. But Phase 3's CONTEXT §Area 3 EXPLICITLY cites Pitfall #4 from research/PITFALLS.md as the driving rationale, and Plan 03-04's W3 disposition relied on Pitfall #4 reasoning to tighten the 0.80-tier rejection regex. Locking the asymmetric-cost reasoning at the ADR level — with explicit (a) measure precision, (b) recovery UX, (c) supersede gates — makes the contract enforceable at code review time. This is Rule 2 (auto-add missing critical functionality) at the documentation layer.
- **Fix:** Added Pitfall #4 as a `#### Pitfall #4 — never quietly lower REJECTION_FLOOR` subsection inside Decision C. The three gates (precision measurement, recovery UX, supersession) make the threshold change a deliberate decision, not a one-line tunable.
- **Files modified:** `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` (the Pitfall #4 subsection is part of the +112-line append; the README's existing "Pitfalls" list elsewhere in the project remains untouched, per CLAUDE.md §1.3 surgical scope).
- **Verification:** Pitfall #4 paragraph contains `REJECTION_FLOOR` (1 hit), `recovery UX` (1 hit), `supersede` (1 hit). The three required gates are spelled out in a single sentence so a future maintainer can see all three at once.
- **Committed in:** `b7db596` (Task 1 commit).

**3. [Rule 2 — Missing Critical] Added supersession-exception clause inside ADR-0012's Supersedes section**

- **Found during:** Task 1 — the plan body says "Plan 03-05 deliberately AMENDS ADR-0012 (not supersedes)" and lists the justification in `<existing_patterns>`, but the ADR's Supersedes section itself originally contained ONLY the supersession rule, with no record of the §C exception. A future maintainer reading the ADR alone (without the plan) would see the supersession rule and conclude the §C amendment is a violation.
- **Issue:** Without an explicit clause INSIDE the ADR documenting the §C exception, the supersession rule looks self-contradictory. Per CLAUDE.md §1.3 (surgical), I should not silently weaken the rule by making the §C exception invisible.
- **Fix:** Appended a new paragraph to the Supersedes section explicitly recording §C as "the documented exception" — names the precedent (ROADMAP cross-cutting concerns), states the appending-not-editing rule, and reaffirms the supersession discipline for future amendments. The supersession rule and its one-off exception now sit in the same paragraph, both visible in `git grep`.
- **Files modified:** `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` (the supersession-exception paragraph is part of the +112-line append).
- **Verification:** `grep -c "documented exception" docs/decisions/0012-status-regression-block-and-auto-update-styling.md` returns 1; the paragraph contains both the supersession rule and the §C exception side by side.
- **Committed in:** `b7db596` (Task 1 commit).

**4. [Rule 3 — Blocking] First Edit pass to ADR did not persist on disk**

- **Found during:** Task 1 — after running my initial pair of Edit operations (Pitfall #4 insertion + supersession-exception expansion), `git diff` reported only the 1-line Date change, not the ~112 lines of additions. Investigation: the working tree had not been persisted because — during the same multi-tool block — a parallel Bash command that included a too-long commit-message line aborted via the commit-msg hook's `exit 1`, and the Edit tool's success message in the cached-context view did not match disk reality.
- **Issue:** Without re-applying, the commit would have shipped only the Date line — none of the §C content. This is a Rule 3 blocking situation: I cannot complete Task 1's done criteria without all the §C content on disk.
- **Fix:** Re-read the file from disk (line 175ff and 235ff to confirm only the Date line had persisted), then re-applied: (a) Sub-context C insertion, (b) Decision C insertion, (c) References + Supersedes-exception update. All three Edits used uniquely-anchored old_string fragments; success was verified by `grep -c '## ' = 6` and the rest of the plan-spec'd grep block.
- **Files modified:** `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` (the second-pass Edits ran cleanly; the third commit attempt landed).
- **Verification:** Plan's <verify> automated grep block runs all-green. `git show b7db596 --stat` shows `1 file changed, 112 insertions(+), 1 deletion(-)` — proving the full amendment landed in the commit.
- **Committed in:** `b7db596` (Task 1 commit).

---

**Total deviations:** 4 auto-fixed (1 Rule 3 blocking commit-msg, 1 Rule 2 Pitfall #4, 1 Rule 2 supersession-exception clause, 1 Rule 3 blocking re-apply after first Edit pass did not persist)
**Impact on plan:** All four are corrections to the documentation contract — none change code behavior. The plan body's intent (lock the asymmetric thresholds + UAT artifact + final gate) is fully satisfied. The Pitfall #4 + supersession-exception additions strengthen the ADR contract beyond the plan's literal instructions but stay inside the plan's spirit (lock the contract at the ADR level so Phase 4 cannot accidentally re-derive). No scope creep into code.

## Issues Encountered

- **Hook-rejected first commit + ADR Edit non-persistence:** see Deviations #1 and #4. The recovery path was to re-read the file from disk, re-apply the Edits with uniquely-anchored old_string fragments, and re-attempt the commit with a ≤72-char subject. The second attempt landed cleanly. Future executions of this plan should pre-shorten the commit subject to <70 chars before issuing the commit command.
- **Cached file context vs disk reality:** during the first failed pass, the Edit tool's "file state is current in your context" message did not match disk reality (the Edits had not actually persisted). Re-reading the file from disk before re-applying was the canonical recovery; see the Read at line 175ff that confirmed only the Date line had survived.

## Authentication Gates

None — docs-only execution, no external API calls. UAT-03-03 (the optional real-LLM smoke test) is the first time real Anthropic API auth would be exercised, and it is DEFERRED to the owner's pre-merge walkthrough; not in scope for Plan 03-05's executor.

## Phase 4 Readiness — exports unchanged, ADR contract locked

Plan 03-05 doesn't change any Phase 4 import surface — the imports listed in 03-04-SUMMARY (and now repeated in 03-UAT.md "Phase 4 readiness") are still the canonical entry points:

```ts
import { classifyEmail } from '@/features/classifier/service'
import { THRESHOLDS, meetsThreshold } from '@/features/classifier/thresholds'
import { matchEmail } from '@/features/matcher/service'
```

What this plan adds is the ADR-0012 §C contract surface. Phase 4's act-stage MUST consume `meetsThreshold(cls.label, cls.confidence)` rather than `cls.confidence >= env.CLASSIFIER_AUTO_THRESHOLD`. The env var still exists in `env.ts` for backward compatibility but is intentionally not the discriminating value. ADR-0012 §C is grep-discoverable (`thresholds.ts` referenced 4× in the ADR body), so Phase 4's plan-phase agent will find it during context assembly.

## Self-Check

- **Created file exists on disk:**
  - `/Users/edwardpham/Documents/Programming/Projects/foray/.planning/phases/03-classifier-matcher/03-UAT.md` — FOUND (147 lines, 27 PASS/FAIL/DEFERRED tokens, all plan grep checks pass)
- **Modified file persisted on disk:**
  - `docs/decisions/0012-status-regression-block-and-auto-update-styling.md` — FOUND, `git show b7db596 --stat` confirms +112 / -1 (the second-pass Edits did persist)
- **Both task commits exist:** `b7db596` (Task 1 — ADR amendment), `ad2968c` (Task 2 — UAT artifact) — confirmed by `git log --oneline -3`
- **Plan's <verify> automated grep checks for ADR pass:** `## ` headings = 6, `Asymmetric per-label classifier thresholds` = 1, `thresholds.ts` = 4, all five threshold values present, `budget.ts` = 5, `FAIL CLOSED` = 1, `amended 2026-05-09` = 1, `### ` subsections = 8.
- **Plan's <verify> automated grep checks for UAT pass:** total lines = 147 (≥30), `PASS|FAIL|DEFERRED` = 27 (≥10), `CLASS-01..04` = 4 (≥4), `MATCH-01..03` = 3 (≥3), `ANTHROPIC_API_KEY` = 3 (≥1), `classifier-log.jsonl` = 2 (≥1).
- **Final pre-commit gate green:** all five gates pass (lint, typecheck, test:run, build, depcheck). Test count 275 passing / 4 todo unchanged from Plan 03-04 baseline (no Phase-3 tests added in Plan 03-05).
- **STATE/ROADMAP/REQUIREMENTS untouched:** `git status --short` after both task commits shows only `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` as ` M` (pre-existing modifications carried over from earlier plans) and the `.planning/phases/03-classifier-matcher/03-XX-PLAN.md` files as `??` untracked — none of these were touched in this plan, per the orchestrator's-responsibility convention.
- **W4 exception explicitly documented inside the ADR** (Supersedes section's new paragraph). Future ADR amendments to §A or §B must supersede; this §C amendment is the recorded one-off.

## Self-Check: PASSED

## Next Phase Readiness

- Phase 4 (Gmail Ingestion + Pipeline) can proceed. ADR-0012 §C is the authoritative spec for the auto-act gate. The classifier + matcher imports are unchanged and ready.
- Pre-merge UAT walkthrough deferred to owner (5 manual rows in 03-UAT.md). Most useful: UAT-03-03 (one real-LLM call to validate live SDK boundary) + UAT-03-04 (privacy regression check on `data/classifier-log.jsonl`).
- No blockers. No deferred items at the code layer. No threat flags (the ADR amendment is in-place per the documented exception; the Spoofing risk T-03-05-04 is `accept`-dispositioned per the plan's threat model).

---
*Phase: 03-classifier-matcher*
*Completed: 2026-05-09*
