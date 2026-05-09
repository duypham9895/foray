---
status: deferred
phase: 03-classifier-matcher
source: [03-05-PLAN.md Task 2]
started: 2026-05-09T19:00:00Z
updated: 2026-05-09T19:00:00Z
---

# Phase 3 UAT — Classifier + Matcher

**Status:** PRE-MERGE — owner walkthrough required before merging Phase 3 to `main`.
**Created:** 2026-05-09 (Plan 03-05)
**Verifier:** Duy (Edward Pham) — owner
**Mode:** Pre-merge UAT (mirrors Phase 2's `02-UAT.md` pattern)

## Decision

Phase 3 has minimal browser-verify needs (pure-ish slices, no UI surface). The
in-code criteria are PASS now; the manual items below are DEFERRED to the
owner's pre-merge CLI walkthrough — primarily one optional real-LLM smoke
test (UAT-03-03) that costs ~$0.0005 and validates the live Anthropic SDK
path that integration tests cover with mocks. Privacy regression check
(UAT-03-04) follows the smoke test if it is run.

The code layer is fully shipped and pre-commit-gate-green: see "Final
pre-commit gate" below for the exact test count, build route count, and
depcheck status captured at the end of Plan 03-05.

---

## ROADMAP.md Phase 3 success criteria

| #   | Criterion                                                                                                                                                              | Status              | Evidence                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `classifyEmail` returns `Result<{label, confidence, classifiedBy}, AppError>` via rules-first then LLM fallback                                                        | PASS                | Plan 03-02 `service.test.ts` (11 tests covering rules short-circuit, LLM happy-path, budget gate, LLM error, best-effort cost, validation, privacy fence) + `rules.test.ts` (33 tests) |
| 2   | Per-label asymmetric thresholds in typed config (NOT env-var blanket)                                                                                                  | PASS                | `thresholds.ts` `THRESHOLDS` const + `meetsThreshold` predicate + `thresholds.test.ts` (9 tests including asymmetry invariant + boundary at 0.92/0.85/0.80/0.70/1.0); ADR-0012 §C records the rationale |
| 3   | Pre-call budget guard returns `RateLimited` at ≥$0.50/day                                                                                                              | PASS (in-scope)     | `budget.test.ts` covers the guard, `service.test.ts` T4 verifies the LLM is NEVER called when budget is exhausted. Idempotency on `email.classifiedBy` and per-batch 50-email cap are Phase 4 concerns and are documented in `03-02-SUMMARY.md` |
| 4   | `matcher/service.matchEmail()` with thread → ATS-skip → domain → unmatched tiebreak; zero direct prisma                                                                | PASS                | `tests/integration/matcher-service.test.ts` (9 tests covering all 4 paths + RLS isolation + multi-row tiebreaks + ATS subdomain); depcheck Rule 4 verifies no direct prisma in `matcher/` |
| 5   | Classifier-fixtures suite ≥1/label + ≥3 ATS samples; matcher tests cover 4 paths; ADR-0012 amendment committed                                                          | PASS                | `tests/integration/classifier-fixtures.test.ts` loads 10 fixtures (rejection ×2, interview_invite ×2, recruiter_outreach ×1, noise ×1, unmatched ×1, should-not-have-fired ×3); matcher 4-path tests T1–T4 + T9; ADR-0012 §C amended this plan |

## v1 requirement IDs (Phase 3 scope)

| ID         | Description                                                                                            | Status              | Evidence                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLASS-01   | Rules-first classifier with externalized regex tier table                                              | PASS                | `rules.ts` + `rules.test.ts` (33 tests) + `classifier-fixtures.test.ts` (14 tests) — see 03-01-SUMMARY + 03-04-SUMMARY                                                  |
| CLASS-02   | LLM fallback wrapped in `Result`; `timeout: 15_000`; `maxRetries: 0`                                   | PASS                | `llm.ts` + `llm.test.ts` (18 tests including T8 constructor-arg fence verifying `{timeout: 15_000, maxRetries: 0}`) — see 03-02-SUMMARY                                |
| CLASS-03   | Per-label thresholds in typed config; NOT a single env var                                             | PASS                | `thresholds.ts` + `thresholds.test.ts`; ADR-0012 §C is the authoritative spec (committed this plan, b7db596)                                                            |
| CLASS-04   | Anthropic calls logged to `data/classifier-log.jsonl`; pre-call budget guard ≥ $0.50/day                | PASS                | `budget.ts` + `budget.test.ts` (21 tests including FAIL-CLOSED on read/parse/shape errors); `appendCostEntry` called from `service.ts` after LLM success                |
| MATCH-01   | `matchEmail` returns `Result<{applicationId: ApplicationId \| null}, AppError>`                         | PASS                | `matcher/service.ts` + `matcher-service.test.ts` T1–T9                                                                                                                  |
| MATCH-02   | Tiebreak order: thread → domain (skipping ATS) → unmatched                                              | PASS                | `matcher-service.test.ts` T1 (thread), T2/T7 (domain), T3/T9 (ATS skip + subdomain), T4 (unmatched)                                                                     |
| MATCH-03   | All Prisma access via `withRls` (replaces the original `tenantDb` plan); zero direct prisma in matcher | PASS                | `grep -E "@prisma/client\|@/generated/prisma" src/features/matcher/*.ts` returns 0; depcheck Rule 4 clean. **Note:** Plan 03-03-SUMMARY documents the deviation from the original `tenantDb` prescription to `withRls` (FORCE RLS on `foray_app` requires the GUC-fenced transaction). |

## Manual / pre-merge verification items (owner walkthrough required)

| ID         | What to verify                                                                                                                                                                                                                                                                       | Status   | Notes                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UAT-03-01  | Set a real `ANTHROPIC_API_KEY` in local `.env` (Plan 03-01 promoted the variable to required at env-load time; the local `.env` is gitignored). Get a key from <https://console.anthropic.com/settings/keys>                                                                          | DEFERRED | Without it, `pnpm build` fails at env validation — that IS the desired behavior (fail loud at startup, not silently at runtime). The Plan 03-01 executor placed a test fixture string in `.env` so the build passes locally; replace with a real key before running UAT-03-03.    |
| UAT-03-02  | Run `pnpm build` end-to-end with the real `ANTHROPIC_API_KEY` set. Confirm zero errors and that `next build` reports the standard 7-route output                                                                                                                                       | DEFERRED | Validates the env wiring without making any network calls (the SDK constructor is lazy). Used as the pre-merge sanity check.                                                                                                                                                       |
| UAT-03-03  | (Optional, costs ~$0.0005) Run a single real LLM classification. Write a short throwaway script that imports `classifyEmail` from `@/features/classifier/service` and calls it with one sample email subject + body excerpt, then `console.log`s the result. Confirm `Result.ok` returns `{label, confidence, classifiedBy: 'llm'}` | DEFERRED | Owner-discretion smoke test. NOT required for merge — the integration tests already mock the full SDK boundary including error paths and constructor args. Skip if `ANTHROPIC_API_KEY` is not yet provisioned.                                                                       |
| UAT-03-04  | After UAT-03-03 (only if it ran), inspect `data/classifier-log.jsonl`. Confirm exactly one new row exists with the keys `{ts, model, inputTokens, outputTokens, costUsd, emailHash}`. Confirm `emailHash` starts with `sha256:` and is followed by 64 hex chars. Confirm NO raw subject or body content appears anywhere in the row | DEFERRED | This is the privacy regression check on the live path. The Plan 03-02 service test T9 fences this at unit-test layer; UAT-03-04 is the runtime backstop. If raw content appears, it is a Plan 03-02 bug — file an issue and revert before merging.                                |
| UAT-03-05  | (Optional) Curate ≥1 real anonymized email per label and add to `tests/integration/classifier-fixtures/<label>/`. Re-run `pnpm test:run tests/integration/classifier-fixtures.test.ts` to confirm fixtures match expected labels (or refine `rules.ts` per Plan 03-04 README's add-a-fixture loop) | DEFERRED | Plan 03-04 ships 10 synthetic fixtures; replacing with anonymized real samples improves rule precision over time. Optional for Phase 3 merge; the regression-fence pattern is locked.                                                                                              |

## Cross-cutting trust trio status (per ROADMAP.md §"Cross-Cutting Concerns")

| Concern                                            | Status              | Where it lives                                                                                                                                              |
| -------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-label classifier thresholds                    | **Locked (Phase 3)** | `thresholds.ts` `THRESHOLDS` + `meetsThreshold`; ADR-0012 §C (Plan 03-05)                                                                                  |
| Status-regression block                            | Locked (Phase 2)    | `applications/service.ts:applyAutoStatusChange`; ADR-0012 §A; 36-cell truth-table tests in `status-transitions.test.ts`                                    |
| Visually-distinct auto-update events               | Locked (Phase 2)    | `applications/components/timeline.tsx`; ADR-0012 §B                                                                                                         |
| Budget guard (control, not monitoring; FAIL CLOSED) | **Locked (Phase 3)** | `budget.ts:checkBudget` (pre-call); `budget.ts:appendCostEntry` (post-success); ADR-0012 §C bonus (Plan 03-05); `service.ts` invokes guard before SDK call |
| Idempotency on `email.classifiedBy`                | Phase 4             | Phase 3's `classifyEmail` is database-AGNOSTIC. Phase 4's `inbox.pollOnce` checks `email.classifiedBy != null` before calling. Documented in 03-02-SUMMARY |
| Per-batch hard cap (50 emails / tick)              | Phase 4             | Phase 3 doesn't loop. Phase 4's `pollOnce` will. Documented in 03-02-SUMMARY                                                                                |

---

## Deferred to later phases (out-of-scope for Phase 3)

These items are explicitly out-of-scope for Phase 3's UAT — they belong to Phase 4 / Phase 5:

- Real Gmail OAuth + sync end-to-end (GMAIL-01..04) → Phase 4
- The `inbox/act` orchestrator that imports `classifyEmail`, `THRESHOLDS`, `meetsThreshold`, `matchEmail` and stitches them into the live pipeline → Phase 4
- Auto-applied status changes triggered by real classifier signals (AUTO-01..04) → Phase 4
- Review queue UI at `/inbox` (REVIEW-01, REVIEW-02) → Phase 5
- First-50-emails-bypass behavior (AUTO-03) → Phase 4
- The `forceRegression` flag on `applyAutoStatusChange` (would-be ADR-0012 §A escape hatch) → not in scope until Phase 6 evidence shows it is needed (per ADR-0012 "When we'd reconsider")

---

## Final pre-commit gate

Re-run as the LAST action of Plan 03-05:

```bash
pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck
```

Result: PASS — all five steps green. Captured at the end of Plan 03-05 execution on 2026-05-09:

- `pnpm lint`: clean (`ESLint: No issues found`; 0 errors, 0 warnings)
- `pnpm typecheck`: clean (`tsc --noEmit` exits 0)
- `pnpm test:run`: 19 test files, **275 passing / 4 todo / 279 total** (todo count unchanged from Plan 03-04 baseline; no Phase-3 tests added in Plan 03-05)
- `pnpm build`: succeeds, **6 routes** (`/`, `/_not-found`, `/applications`, `/applications/[id]`, `/applications/new`, `/login`) plus the proxy middleware. (Next.js 16.2.6 emits a "middleware → proxy" deprecation notice; that is the framework migration prompt, not a Phase-3 regression.)
- `pnpm depcheck` (`depcruise src --config .dependency-cruiser.cjs`): 75 modules, 153 dependencies cruised; **0 errors, 1 warning** — the pre-existing `no-orphans: src/middleware.ts`, unchanged from Plan 03-04 baseline.

This run is documented in `03-05-SUMMARY.md` "Final pre-commit gate" with the same numbers.

---

## Phase 4 readiness

Phase 4's `inbox/` slice imports the following from Phase 3:

```ts
import { classifyEmail } from '@/features/classifier/service'
import { THRESHOLDS, meetsThreshold } from '@/features/classifier/thresholds'
import { matchEmail } from '@/features/matcher/service'
```

The `dependency-cruiser` slice-isolation rule forbids cross-slice imports between `features/*` siblings; Phase 4's `inbox/` slice will be the only consumer of `classifier/` and `matcher/` (the act-stage and the orchestrator). This is the natural shape per ADR-0010 (Vertical Slice Architecture) — an orchestrator slice composes peer slices via their public service entry points. No `dependency-cruiser` config change is needed before Phase 4 begins.

ADR-0012 §C is the authoritative spec for the auto-act gate. Phase 4's act-stage MUST call `meetsThreshold(cls.label, cls.confidence)` rather than re-deriving from `env.CLASSIFIER_AUTO_THRESHOLD`. The env var still exists in `env.ts` for backward compatibility but is intentionally not consumed by the act-stage gate.

---

## Issues Found

(None recorded yet — pre-merge UAT walkthrough is the next opportunity to record any.)

## Sign-off

**Pending — pre-merge owner walkthrough before merging Phase 3 to `main`.**

Approval recorded here will close all DEFERRED rows above and unblock the merge. Phases 1 + 2 follow the same pattern: rows persist as DEFERRED until the pre-merge session, then get flipped to PASS / FAIL.

---

## Summary

- **Total rows:** 23 (5 ROADMAP success criteria + 7 v1 requirement IDs + 5 manual verification items + 6 cross-cutting trust trio rows)
- **PASS:** 14 (5 ROADMAP + 7 requirements + 2 trust-trio rows newly locked in Phase 3 — per-label thresholds, budget guard)
- **DEFERRED:** 7 (5 manual verification items + 2 trust-trio rows for Phase 4 — idempotency, per-batch cap)
- **Locked (Phase 2 — counted but not in PASS/DEFERRED):** 2 (status-regression block, visually-distinct events)
- **FAIL:** 0

Verify gate (Plan 03-05 Task 2): `grep -cE 'PASS|FAIL|DEFERRED' .planning/phases/03-classifier-matcher/03-UAT.md` ≥ 10 — satisfied.

*Phase 3 UAT artifact created by Plan 03-05 on 2026-05-09. Owner walkthrough required for items marked DEFERRED before merging Phase 3 to `main`.*
