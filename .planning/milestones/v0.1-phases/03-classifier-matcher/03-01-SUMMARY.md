---
phase: 03-classifier-matcher
plan: 01
subsystem: classifier
tags: [classifier, regex-rules, asymmetric-thresholds, budget-guard, anthropic-haiku, fail-closed, sha256-hash]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: errors taxonomy (RateLimited, ExternalApi), env validation (ANTHROPIC_API_KEY), pino logger, server-only mock
  - phase: 02-applications-slice
    provides: EmailClassification enum (via Prisma schema), Result<T, AppError> pattern, vertical slice structure
provides:
  - "classifyByRules({subject, bodyExcerpt}) — pure rules-first classifier"
  - "CLASSIFICATION_RULES — typed regex tier table (0.95 / 0.80)"
  - "THRESHOLDS — per-label asymmetric auto-action gates"
  - "meetsThreshold(label, confidence) — Phase 4 act-stage predicate"
  - "checkBudget() — pre-call daily-cap guard (FAILS CLOSED on read failure)"
  - "appendCostEntry({inputTokens, outputTokens, model, emailHash}) — JSONL recorder"
  - "computeCostUsd(input, output) — pure Haiku 4.5 cost arithmetic"
  - "hashEmailContent(subject, body) — sha256 privacy-preserving id"
  - "secondsUntilMidnight(now?) — pure helper"
  - "ANTHROPIC_API_KEY now required at env-load time"
affects: [03-02-classifier-service, 03-03-matcher, 03-04-classifier-fixtures, 03-05-adr-amendment, 04-gmail-pipeline]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — node:crypto + node:fs are stdlib; pino + neverthrow already present
  patterns:
    - "FAIL-CLOSED I/O: file-read or parse failure returns RateLimited, not silent ok()"
    - "Privacy-preserving cost log: sha256(subject + '\\n' + body) NEVER raw content"
    - "Test seam via env var (CLASSIFIER_LOG_PATH) — undocumented in .env.example because not user-configurable"
    - "Pure utility quartet (rules, thresholds, budget arithmetic, hash) with NO Anthropic SDK import — Plan 03-02 wires that"
    - "Asymmetric per-label thresholds in code (rejection 0.92 > interview_invite 0.85) — flat env var gate is REJECTED"

key-files:
  created:
    - "src/features/classifier/rules.ts (165 LOC) — CLASSIFICATION_RULES + classifyByRules()"
    - "src/features/classifier/rules.test.ts — 32 unit tests"
    - "src/features/classifier/thresholds.ts (40 LOC) — THRESHOLDS + meetsThreshold()"
    - "src/features/classifier/thresholds.test.ts — 9 unit tests"
    - "src/features/classifier/budget.ts (200 LOC) — checkBudget + appendCostEntry + helpers"
    - "src/features/classifier/budget.test.ts — 21 unit tests"
  modified:
    - "src/core/env.ts — ANTHROPIC_API_KEY: z.string().optional() → .min(1, ...)"
    - "src/core/env.test.ts — added Tests 5 + 5b for ANTHROPIC_API_KEY required"
    - ".env.example — comment updated to mark REQUIRED (Phase 3 classifier)"
    - "vitest.setup.ts — added ANTHROPIC_API_KEY fixture so suite passes"

key-decisions:
  - "W2 (plan-checker note): cost-log model field accepts the dated Anthropic model string (e.g. claude-haiku-4-5-20251001) supplied by Plan 03-02's llm.ts — better audit trail than the bare claude-haiku-4-5 from CONTEXT's illustrative example. Kept appendCostEntry's model param as plain string (no enum) so model upgrades are no-code changes."
  - "Rejection 0.95 regex refined to accept 'not TO move forward' and 'will not be moving forward' (CONTEXT's seed regex was too strict; per CONTEXT itself: 'refine if fixtures fail')"
  - "ANTHROPIC_API_KEY moved to required NOW (Plan 03-01) instead of waiting for Plan 03-02. Justification: tests need a fixture value; making it required + adding the fixture in vitest.setup.ts is one change rather than two."
  - "FAIL CLOSED on missing field shape (ts/costUsd missing in entry): treats malformed entries the same as JSON.parse failures — refuses LLM call. Plan didn't spec this but Threat T-03-01-02 requires it (Rule 2)."
  - "Test-only CLASSIFIER_LOG_PATH env override is intentionally NOT in .env.example. It's a test seam, not a production knob. Production path is fixed at <cwd>/data/classifier-log.jsonl."

patterns-established:
  - "Fail-closed I/O guards in any pre-call validator: file errors → rateLimited(60), parse errors → rateLimited(60), missing data shape → rateLimited(60). Never silently ok()."
  - "Privacy hashing for audit logs: sha256(subject + '\\n' + body) with the literal '\\n' separator to prevent prefix collisions ('a' + 'bc' must not equal 'ab' + 'c'). Tested explicitly."
  - "Per-label asymmetric thresholds in code, not in env. Environment values are blunt instruments; per-label gates encode the asymmetric stakes (rejection-wrong > interview-wrong)."
  - "TDD execution split: RED commit (test only) + GREEN commit (impl). Both atomic, both named in commit subject. Pre-commit gate verifies GREEN passes the full pipeline."

requirements-completed: [CLASS-01, CLASS-03, CLASS-04]

# Metrics
duration: 9min
completed: 2026-05-09
---

# Phase 03 Plan 01: Classifier Pure Utilities Summary

**Pure rules-first classifier (regex tier table + 5-label priority tiebreak), per-label asymmetric thresholds (rejection 0.92 > interview_invite 0.85), and fail-closed daily-budget guard with sha256-hashed cost log — all without an Anthropic SDK import.**

## Performance

- **Duration:** 9 min 9 sec
- **Started:** 2026-05-09T11:46:29Z
- **Completed:** 2026-05-09T11:55:38Z
- **Tasks:** 3 (autonomous, no checkpoints)
- **Files created:** 6 (3 source + 3 test)
- **Files modified:** 4 (env.ts, env.test.ts, .env.example, vitest.setup.ts)
- **Tests added:** 62 (32 rules + 9 thresholds + 21 budget) — exceeds ≥41 minimum
- **Total test suite:** 222 passing / 226 (4 pre-existing TODO)

## Accomplishments

- **Trust-trio knob #1 — rules-first classifier:** typed `CLASSIFICATION_RULES` table with 0.95/0.80 tiers, deterministic priority tiebreak (`rejection > interview_invite > recruiter_outreach > noise > unmatched`), bounded regex quantifiers (no ReDoS exposure), and a pure `classifyByRules()` entry point with a `matchedRuleIndex` audit field.
- **Trust-trio knob #2 — asymmetric per-label thresholds:** `THRESHOLDS` map locked at `rejection 0.92 / interview_invite 0.85 / recruiter_outreach 0.80 / noise 0.70 / unmatched 1.0` with a boundary-inclusive `meetsThreshold()` predicate. Asymmetry encoded explicitly: rejection-wrong destroys trust catastrophically; interview-wrong is recoverable.
- **Trust-trio knob #3 — daily budget guard:** `checkBudget()` reads `data/classifier-log.jsonl`, sums today's `costUsd`, returns `RateLimited(secondsUntilMidnight())` at ≥ \$0.50. **FAILS CLOSED** on file-read error, JSON-parse error, or missing-shape error → `RateLimited(60)`. Plan 03-02's orchestrator cannot accidentally bypass this.
- **Cost recorder with privacy hash:** `appendCostEntry()` writes JSONL with computed cost (using LITERAL Haiku 4.5 prices `\$0.80/MTok input, \$4.00/MTok output` — comment cites source/date for future updates) and a sha256 of subject+body for de-duplication. Raw email content is NEVER logged.
- **`ANTHROPIC_API_KEY` promoted to required** at env-load time. Tests get a fixture value; production fails loud at startup if missing.

## Task Commits

Each task was committed atomically. TDD tasks (2 + 3) split into RED + GREEN commits.

1. **Task 1: Verify error taxonomy + require `ANTHROPIC_API_KEY`** — `e894447` (feat)
2. **Task 2 (RED): Failing tests for rules + thresholds** — `203e2eb` (test)
3. **Task 2 (GREEN): Implement `classifyByRules` + `THRESHOLDS`** — `ea46ff7` (feat)
4. **Task 3 (RED): Failing tests for budget guard + cost recorder** — `c8d45f9` (test)
5. **Task 3 (GREEN): Implement `checkBudget` + `appendCostEntry`** — `12861b8` (feat)

_All 5 commits pass `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck`._

## Files Created/Modified

### Created (6)

- `src/features/classifier/rules.ts` — `CLASSIFICATION_RULES` typed array (8 entries), `classifyByRules({subject, bodyExcerpt}) → {label, confidence, classifiedBy: 'rules', matchedRuleIndex?}`. Pure. No SDK.
- `src/features/classifier/rules.test.ts` — 32 unit tests covering each label's 0.95 + 0.80 tiers, body-side matching, priority tiebreaks, case-insensitivity, no-match behavior, and 4 negative tests.
- `src/features/classifier/thresholds.ts` — `THRESHOLDS: Record<EmailClassification, number>` + `meetsThreshold(label, confidence): boolean`. Inclusive boundary.
- `src/features/classifier/thresholds.test.ts` — 9 unit tests including the asymmetry invariant + boundary tests at 0.92/0.85/0.70/1.0.
- `src/features/classifier/budget.ts` — `DAILY_BUDGET_USD = 0.50`, `HAIKU_INPUT_USD_PER_MTOK = 0.80`, `HAIKU_OUTPUT_USD_PER_MTOK = 4.00`, `computeCostUsd`, `hashEmailContent`, `secondsUntilMidnight`, `checkBudget`, `appendCostEntry`. Uses `pino` from `@/core/logger` for FAIL CLOSED logging.
- `src/features/classifier/budget.test.ts` — 21 unit tests with per-test temp dir + `CLASSIFIER_LOG_PATH` override; never touches the real cost log.

### Modified (4)

- `src/core/env.ts` — `ANTHROPIC_API_KEY` from `.optional()` to `.min(1, ...)` with helpful error message.
- `src/core/env.test.ts` — added `ANTHROPIC_API_KEY` to `baseEnv` fixture; added Tests 5 (missing) and 5b (empty string) for the new requirement.
- `.env.example` — updated `ANTHROPIC_API_KEY` comment to "REQUIRED — Phase 3 classifier".
- `vitest.setup.ts` — added `process.env['ANTHROPIC_API_KEY'] ??= 'sk-ant-test-fixture-key-not-real'` so the entire suite continues to pass after env.ts becomes stricter.

### Function signatures (Phase 4 import surface)

```ts
// rules.ts
export type ClassifyByRulesInput = { subject: string; bodyExcerpt: string }
export type ClassifyByRulesOutput = {
  label: EmailClassification
  confidence: number
  classifiedBy: 'rules'
  matchedRuleIndex?: number
}
export function classifyByRules(input: ClassifyByRulesInput): ClassifyByRulesOutput

// thresholds.ts
export const THRESHOLDS: Record<EmailClassification, number> = {
  rejection: 0.92,
  interview_invite: 0.85,
  recruiter_outreach: 0.80,
  noise: 0.70,
  unmatched: 1.0,
}
export function meetsThreshold(label: EmailClassification, confidence: number): boolean

// budget.ts
export const DAILY_BUDGET_USD = 0.50
export const HAIKU_INPUT_USD_PER_MTOK = 0.80
export const HAIKU_OUTPUT_USD_PER_MTOK = 4.00
export function computeCostUsd(inputTokens: number, outputTokens: number): number
export function hashEmailContent(subject: string, bodyExcerpt: string): string
export function secondsUntilMidnight(now?: Date): number
export async function checkBudget(): Promise<Result<void, AppError>>
export async function appendCostEntry(input: AppendCostInput): Promise<Result<{ costUsd: number }, AppError>>
```

## Decisions Made

1. **W2 — cost-log model field (plan-checker note):** Accept the dated Anthropic model string (e.g. `claude-haiku-4-5-20251001`) instead of the bare `claude-haiku-4-5` from CONTEXT's illustrative example. Better audit trail. `appendCostEntry`'s `model` param stays a plain `string` (no enum), so future Anthropic model upgrades are a no-code change in this slice — Plan 03-02's `llm.ts` owns the constant.
2. **Rejection 0.95 regex refinement:** CONTEXT's seed regex `we (have decided|regret to inform).{0,40}(not move forward|...)` rejects the natural English `we have decided not TO move forward`. Per CONTEXT itself ("refine if fixtures fail"), I added `not to move forward` and `will not be moving forward` to the alternation. Bounded `.{0,40}` quantifier preserved — no ReDoS exposure.
3. **`ANTHROPIC_API_KEY` required NOW (Plan 03-01) not Plan 03-02:** Tests need a fixture value. Doing the env change + the vitest fixture together is one atomic change; deferring would split it across two plans.
4. **FAIL CLOSED on missing-shape entries:** Plan didn't explicitly cover the case where a JSONL line parses but is missing `ts` or `costUsd`. Threat T-03-01-02 ("budget read failure → fail closed") implies it. Added explicit shape check that returns `rateLimited(60)` when `ts` or `costUsd` are missing/non-string/non-number.
5. **Test-only `CLASSIFIER_LOG_PATH` is intentionally undocumented in `.env.example`.** It's a test seam, not a production knob. Production path is fixed at `<cwd>/data/classifier-log.jsonl`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] env.ts hardening broke 2 existing env tests + would block ALL tests at module load**
- **Found during:** Task 1 (Verify error taxonomy + require ANTHROPIC_API_KEY)
- **Issue:** Making `ANTHROPIC_API_KEY` required without a fixture value means `vitest.setup.ts` can't validate `env.ts` at module load → entire test suite fails to start. Separately, `src/core/env.test.ts` Tests 1 + 4 use a `baseEnv` literal that lacked `ANTHROPIC_API_KEY` → safeParse returns `{ success: false }` → asserts fail.
- **Fix:**
  - Added `process.env['ANTHROPIC_API_KEY'] ??= 'sk-ant-test-fixture-key-not-real'` to `vitest.setup.ts`.
  - Added `ANTHROPIC_API_KEY: 'sk-ant-test-fixture-key-not-real'` to the `baseEnv` literal in `src/core/env.test.ts`.
  - Also added `.env` placeholder line so `pnpm build` passes locally; gitignored, won't be committed.
- **Files modified:** `vitest.setup.ts`, `src/core/env.test.ts`, `.env` (local-only, gitignored).
- **Verification:** `pnpm test:run src/core/env.test.ts` → 7/7 pass; `pnpm build` succeeds.
- **Committed in:** `e894447` (Task 1 commit).

**2. [Rule 1 — Bug] Rejection 0.95 regex from CONTEXT misses the canonical "decided not TO move forward" phrasing**
- **Found during:** Task 2 GREEN run (Tests 2 + 15 failed: expected `rejection`, got `unmatched`).
- **Issue:** CONTEXT's seed regex `we (have decided|regret to inform).{0,40}(not move forward|not be moving forward|other (candidates|applicants))` requires the string `not move forward` (no "to") to match. The natural English phrasing (and the test fixtures based on real recruiter emails) is `decided not TO move forward`.
- **Fix:** Added `not to move forward` and `will not be moving forward` to the alternation. CONTEXT itself sanctions this: "refine if fixtures fail".
- **Files modified:** `src/features/classifier/rules.ts` (one-line regex extension).
- **Verification:** All 32 rules tests pass; bounded `.{0,40}` quantifier preserved — no ReDoS regression.
- **Committed in:** `ea46ff7` (Task 2 GREEN commit).

**3. [Rule 2 — Missing Critical] Added env.ts regression tests for the new ANTHROPIC_API_KEY requirement**
- **Found during:** Task 1 (after the env.ts change landed, no test would catch a regression).
- **Issue:** Promoting a Zod field from `.optional()` to `.min(1, ...)` is a breaking contract change. Without a regression test, a future revert (or a refactor that mistakenly re-adds `.optional()`) would silently pass.
- **Fix:** Added Test 5 (missing key → safeParse fails with path 'ANTHROPIC_API_KEY') and Test 5b (empty string → safeParse fails) to `src/core/env.test.ts`.
- **Files modified:** `src/core/env.test.ts`.
- **Verification:** Both tests fail with the old `.optional()` schema, pass with the new `.min(1)` schema. Locks the contract.
- **Committed in:** `e894447` (Task 1 commit).

**4. [Rule 2 — Missing Critical] Added FAIL-CLOSED handling for missing-shape JSONL entries in checkBudget**
- **Found during:** Task 3 implementation (writing `checkBudget`).
- **Issue:** Plan covers FAIL CLOSED on `JSON.parse` failure. It does NOT cover an entry that parses successfully but is missing `ts` or `costUsd`. Without a shape check, the loop's `parsed.ts.slice(0, 10)` would throw on `undefined.slice(...)` — yielding an UNCAUGHT exception that bubbles up through the Server Action, leaking a 500 to the user. Threat T-03-01-02 says "FAIL CLOSED on read failure" — extending to "read or shape failure" is the consistent reading.
- **Fix:** Added explicit `if (typeof parsed.ts !== 'string' || typeof parsed.costUsd !== 'number')` check that logs at error level and returns `err(errors.rateLimited(60))`.
- **Files modified:** `src/features/classifier/budget.ts`.
- **Verification:** Test 6 (malformed line) covers the broader behavior; the explicit shape check is defense-in-depth.
- **Committed in:** `12861b8` (Task 3 GREEN commit).

---

**Total deviations:** 4 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug, 2 Rule 2 missing-critical)
**Impact on plan:** All four were necessary for correctness or test-suite viability. No scope creep. Plan body not modified — all fixes contained within the plan's named files plus the test-suite fixtures it implicitly required.

## Issues Encountered

- **Test seam pattern (`CLASSIFIER_LOG_PATH`):** I considered three options for letting tests target a temp file: (a) module-level `LOG_PATH` resolved at import time + reset between tests via `vi.resetModules()`; (b) export a setter; (c) read `process.env['CLASSIFIER_LOG_PATH']` at every call site. Picked (c) — simplest, no module-cache games, no API surface beyond the env var. Production behavior is unchanged because `process.env['CLASSIFIER_LOG_PATH']` is undefined and the fallback is the canonical path. Documented in the file's JSDoc.
- **`.env` placeholder for local builds:** `.env` is gitignored. The plan's pre-flight requirement asks the executor to add `ANTHROPIC_API_KEY` to local `.env` so `pnpm build` passes. I did this; the line will not be committed.

## Authentication Gates

None — all execution was local pure code. Plan 03-02 will introduce the Anthropic SDK call, where API-key validation by Anthropic IS an auth gate.

## Phase 4 Readiness — exports ready to import

```ts
import { classifyByRules } from '@/features/classifier/rules'
import { THRESHOLDS, meetsThreshold } from '@/features/classifier/thresholds'
import {
  DAILY_BUDGET_USD,
  HAIKU_INPUT_USD_PER_MTOK,
  HAIKU_OUTPUT_USD_PER_MTOK,
  appendCostEntry,
  checkBudget,
  computeCostUsd,
  hashEmailContent,
  secondsUntilMidnight,
} from '@/features/classifier/budget'
```

Plan 03-02 will compose these into a `classifyEmail({subject, bodyExcerpt}): Promise<Result<{label, confidence, classifiedBy: 'rules' | 'llm'}, AppError>>` orchestrator that calls `checkBudget()` first, `classifyByRules()` second, falls back to LLM only when rules-confidence < 0.85 AND label != 'unmatched', and `appendCostEntry()` after a successful LLM call.

## Self-Check

- **All 6 created files exist on disk:**
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/classifier/rules.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/classifier/rules.test.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/classifier/thresholds.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/classifier/thresholds.test.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/classifier/budget.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/classifier/budget.test.ts` — FOUND
- **All 5 task commits exist:** `e894447`, `203e2eb`, `ea46ff7`, `c8d45f9`, `12861b8` — FOUND
- **Pre-commit gate green:** lint clean, typecheck clean, 222/226 tests passing (4 pre-existing TODO), build succeeds, depcheck clean (only the pre-existing `no-orphans` warning on `middleware.ts`).
- **THRESHOLDS table values verified:** `0.92 / 0.85 / 0.80 / 0.70 / 1.0` — exact match to CONTEXT §Area 3.
- **No Anthropic SDK import in classifier files** — `grep -E '@anthropic-ai' src/features/classifier/*.ts` returns zero matches.
- **No runtime Prisma usage in classifier files** — only type-only `import type { EmailClassification }` in `rules.ts` + `thresholds.ts`.
- **Privacy verified:** `appendCostEntry` writes only `{ts, model, inputTokens, outputTokens, costUsd, emailHash}` — no raw subject or body. `emailHash` shape is `sha256:` + 64 hex chars (Test 10).
- **FAIL CLOSED verified:** Test 6 + Test 6 logs confirm a malformed line returns `err(rateLimited(60))`; the pino error log line in test output is the FAIL CLOSED audit signal, not a test failure.

## Self-Check: PASSED

## Next Phase Readiness

- Plan 03-02 (classifier service + LLM fallback) can begin immediately.
- Plan 03-02 will: import all of the above, add Anthropic SDK call (`@anthropic-ai/sdk` 0.95.x already in package.json), define the `claude-haiku-4-5-20251001` model constant in `llm.ts`, wire `checkBudget` → `classifyByRules` → optional LLM → `appendCostEntry`, expose a single `classifyEmail()` Server-side function.
- Plan 03-05 (ADR-0012 amendment) will document the asymmetric-threshold rationale captured in `thresholds.ts`'s top-of-file JSDoc.
- No blockers. No deferred items. No threat flags.

---
*Phase: 03-classifier-matcher*
*Completed: 2026-05-09*
