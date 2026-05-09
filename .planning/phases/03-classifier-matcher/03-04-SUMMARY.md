---
phase: 03-classifier-matcher
plan: 04
subsystem: classifier
tags: [classifier, fixtures, regression-fence, w3-tightening, pitfall-4-defense, ats-false-positive, anonymized-samples]

# Dependency graph
requires:
  - phase: 03-classifier-matcher (Plan 01)
    provides: classifyByRules() — pure regex tier table
  - phase: 03-classifier-matcher (Plan 02)
    provides: classifyEmail() composition (not directly used by harness; documents the LLM-fallback boundary)
provides:
  - "tests/integration/classifier-fixtures/ — 10-sample regression-fence corpus with README documenting the add-a-fixture loop"
  - "tests/integration/classifier-fixtures.test.ts — fixture-driven harness; loads ALL .json files and asserts label match via classifyByRules"
  - "Tightened 0.80 rejection regex (W3) — 'thank you for your interest' now requires a paired rejection signal within 200 chars"
  - "Tightened 0.80 recruiter_outreach regex — restricted to source: 'subject' to defeat ATS body false-positives"
affects: [03-05-adr-amendment, 04-gmail-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture-driven regression fence — JSON files in tagged subdirs, harness enumerates and asserts via vitest's it.each"
    - "Privacy regression fence inside the harness — REAL_DOMAINS regex blocks gmail/yahoo/outlook/icloud/hotmail/aol"
    - "Paired-trigger 0.80 rejection — 'thank you for your interest' must coexist with a rejection signal; bare phrase no longer fires"
    - "Subject-only 0.80 recruiter_outreach — body acknowledgments ('position at Acme Corp') no longer mis-classify as outreach"

key-files:
  created:
    - "tests/integration/classifier-fixtures/README.md (90 LOC) — fixture contract + anonymization rules + add-a-fixture loop"
    - "tests/integration/classifier-fixtures/rejection/canonical-rejection.json — 0.95-tier rejection sample"
    - "tests/integration/classifier-fixtures/rejection/generic-rejection.json — 0.80-tier rejection (paired trigger)"
    - "tests/integration/classifier-fixtures/interview_invite/explicit-schedule.json — 0.95-tier"
    - "tests/integration/classifier-fixtures/interview_invite/calendar-link.json — 0.80-tier"
    - "tests/integration/classifier-fixtures/recruiter_outreach/cold-outreach.json — 0.95-tier"
    - "tests/integration/classifier-fixtures/noise/newsletter.json — 0.95-tier"
    - "tests/integration/classifier-fixtures/unmatched/generic-notification.json — no rule fires"
    - "tests/integration/classifier-fixtures/should-not-have-fired/greenhouse-sample.json — ATS confirmation; expectedLabel='unmatched'"
    - "tests/integration/classifier-fixtures/should-not-have-fired/lever-sample.json — ATS confirmation; expectedLabel='unmatched'"
    - "tests/integration/classifier-fixtures/should-not-have-fired/workday-sample.json — ATS status update; expectedLabel='unmatched' (drives W3 regex tightening)"
    - "tests/integration/classifier-fixtures.test.ts (118 LOC) — fixture-driven harness, 14 tests"
  modified:
    - "src/features/classifier/rules.ts — 0.80 rejection split into sole-trigger + paired-trigger patterns; 0.80 recruiter_outreach restricted to source:'subject'"
    - "src/features/classifier/rules.test.ts — Tests 9 / 19 / 27 rewritten for new contract; Test 9b added as bare-phrase regression fence"

key-decisions:
  - "W3 disposition: chose option (a) — TUNE THE REGEX, not accept the inconsistency. Option (a) cleans up the regression fence (workday-sample.json now sits in should-not-have-fired/ with expectedLabel='unmatched' — semantically correct), eliminates Pitfall #4 risk on the bare 'thank you for your interest' phrase, and tightens the 0.80 tier intentionally (it was too loose; CONTEXT itself sanctions 'refine if fixtures fail'). Trade-off: bare 'thank you for your interest' is no longer a rejection signal; emails that ARE rejections but lack a paired signal will fall through to the LLM (rules-confidence < 0.85 → LLM fallback path). Acceptable: (i) most real rejections include both signals; (ii) the LLM is the failsafe for edge cases; (iii) NEVER auto-rejecting on a non-rejection is the higher priority (Pitfall #4)."
  - "Discovered second false-positive during RED — the Greenhouse and Lever fixtures fired as recruiter_outreach@0.80 because the regex /(opportunity|opening|position) (at|with) /i matched bodies like 'thank you for applying to the Senior Product Manager position at Acme Corp'. Tightened by restricting to source:'subject' (Karpathy §1.2 — simplest tightening that preserves real-outreach coverage). Documented in rules.ts comment block."
  - "Harness uses vitest's it.each(fixtures) so every fixture becomes its own named test in the runner output ('rejection/canonical-rejection.json → classifyByRules returns expectedLabel'). When a fixture fails, the assert message includes the full filepath, expected label, actual label, and matchedRuleIndex — one-glance debug surface."
  - "Sorted readdirSync output for deterministic test order. Vitest doesn't require it, but stable ordering makes diffing CI logs across runs trivial."
  - "Privacy regression fence inside the harness (real-domain grep) is in addition to the Task-1 verification grep. Defense-in-depth — if a future fixture adds a real address, BOTH the harness test AND the verify gate fail."
  - "Test 9b added as the explicit regression fence for the bare-phrase tightening. Without it, a future revert of the regex split would silently re-introduce the false-positive without any single test failing in src/. Test 9b makes the contract explicit at the unit-test layer (separate from the fixture layer)."

patterns-established:
  - "Fixture-driven regression fence pattern: <test-dir>/<corpus>/<label>/<sample>.json + sibling .test.ts that enumerates + asserts. Future plans (Phase 4 ingest fixtures, Phase 5 review-queue fixtures) can adopt the same shape."
  - "Paired-trigger regex pattern: when a generic phrase ('thank you for your interest') appears in BOTH the target class and adversarial classes (ATS confirmations), require it to coexist with a class-specific signal within a bounded distance. The .{0,N} bound keeps no-ReDoS posture."
  - "Source: 'subject' restriction as a tightening lever: when a generic phrase appears in BOTH outreach subjects AND acknowledgment bodies, restrict the rule to subject-side. Subject phrasing is more author-controlled and class-discriminating than body phrasing."

requirements-completed: [CLASS-01]

# Metrics
duration: 8m 12s
completed: 2026-05-09
---

# Phase 03 Plan 04: Classifier Fixtures Suite Summary

**10-fixture regression-fence corpus + harness test that loads every fixture and asserts the rule layer's label output, plus W3-driven tightening of two 0.80-tier regexes that were over-firing on Greenhouse/Lever/Workday acknowledgments. The fixture loop is now the canonical place to encode classifier truth — when a misclassification is reported, add a fixture, the harness fails, the rule gets tuned.**

## Performance

- **Duration:** 8 min 12 sec
- **Started:** 2026-05-09T12:23:13Z
- **Completed:** 2026-05-09T12:31:25Z
- **Tasks:** 2 (autonomous, no checkpoints)
- **Files created:** 12 (1 README + 10 fixtures + 1 harness test)
- **Files modified:** 2 (rules.ts, rules.test.ts)
- **Tests added:** 14 fixture-driven (4 meta + 10 parametrized) + 1 new unit fence (Test 9b) = 15
- **Total test suite:** 275 passing / 279 (4 pre-existing TODO)

## Accomplishments

- **Fixture corpus seeded.** 10 anonymized JSON fixtures across 6 subdirs cover every label (≥1 each) plus 3 ATS samples in `should-not-have-fired/`. All fixtures are `source: 'synthetic'`; ongoing fixture authoring will mix in anonymized real samples.
- **Privacy-by-construction.** Every fixture uses placeholder names (Jane Doe), placeholder companies (Acme Corp), placeholder domains (`example.com`). The harness includes a real-domain grep (`gmail|yahoo|outlook|icloud|hotmail|aol`) so a future commit with PII fails the test, not just the verify gate.
- **Harness pattern locked.** `tests/integration/classifier-fixtures.test.ts` uses `it.each(fixtures)` so each fixture is its own named test. When a fixture fails, the assert message names the full filepath, expected label, actual label, and matchedRuleIndex. The pattern scales to N fixtures automatically — future plans add files, never edit the harness.
- **W3 regex tightening landed.** The 0.80 rejection rule was split: sole-trigger ("after careful consideration") + paired-trigger ("thank you for your interest" within 200 chars of a rejection-specific signal). The 0.80 recruiter_outreach rule was restricted from `source: 'either'` to `source: 'subject'` to defeat ATS body false-positives. Both changes have inline comments citing the driving fixture(s).
- **Pre-commit gate green:** lint clean, typecheck clean, 275/279 (4 pre-existing TODO), build succeeds, depcheck clean (only pre-existing `middleware.ts` orphan warning).

## W3 Disposition (plan-checker note)

The plan-checker flagged that the workday "tricky" fixture in `should-not-have-fired/` had `expectedLabel: rejection` because the loose 0.80 rejection regex would fire on "thank you for your interest" alone. Two options were on the table:

(a) Move the workday fixture to `unmatched/` (semantically: `should-not-have-fired/` with `expectedLabel: 'unmatched'`) AND tune the 0.80 rejection regex to require additional phrasing.
(b) Accept the fixture in `should-not-have-fired/` with `expectedLabel: rejection` and document the inconsistency.

**Chose (a) — tighten the regex.** Rationale:

1. **Pitfall #4 (false-positive rejections destroy trust).** The 0.80 tier was already documented in the original CONTEXT as "intentionally conservative — needs the 0.92 threshold to auto-act". But it does affect the LLM-fallback decision (rules-confidence ≥ 0.85 short-circuits LLM; the bare "thank you for your interest" at 0.80 forces an LLM call on benign Workday status emails, burning budget). Tightening recovers both correctness AND cost.
2. **CONTEXT explicitly sanctions it.** The Plan 03-01 plan body says "refine if fixtures fail." This is exactly that case.
3. **Cleaner regression fence.** A `should-not-have-fired/` subdir whose fixtures all have `expectedLabel: 'unmatched'` is semantically tight. Mixing `expectedLabel: 'rejection'` into it would force readers to special-case the "tricky" item.

**Trade-off:** bare "thank you for your interest" is no longer a rejection signal. Real rejections almost always include a paired phrase ("not selected", "unable to offer", "decided to go with another candidate", "other candidates"); when they don't, the email falls to the LLM-fallback path (rules-confidence < 0.85). Acceptable because (i) the LLM is the explicit failsafe for ambiguous phrasings, and (ii) NEVER auto-rejecting on a non-rejection is strictly more important than catching a few edge-case rejections at the rule layer.

## Bonus discovery during RED — recruiter_outreach 0.80 also too loose

Running the harness in RED revealed a SECOND false-positive set: both the `greenhouse-sample.json` and `lever-sample.json` bodies fired as `recruiter_outreach@0.80` because `/(opportunity|opening|position) (at|with) /i` matched their candidate-acknowledgment phrasings ("thank you for applying to the Senior Product Manager position at Acme Corp", "Senior Product Manager opening at Acme Corp"). Same Pitfall #4 risk pattern: a generic noun phrase that appears in BOTH legitimate outreach AND adversarial ATS contexts. Fix: restrict to `source: 'subject'`. Recruiter outreach legitimately announces itself in the subject line (Test 13: "Senior engineering opening at TechCo", Test 14: "Re: developer position with Acme Inc."), but ATS confirmations have very different subject shapes. Documented in `rules.ts` with a comment block citing the fixtures.

## Algorithm — fixture harness loop

```
1. readdirSync(FIXTURES_ROOT, withFileTypes: true) → list subdirs
2. for each subdir: readdirSync → list .json files
3. for each .json: readFileSync + JSON.parse → Fixture record
4. it.each(fixtures): run classifyByRules({subject, bodyExcerpt})
                      assert result.label === fixture.expectedLabel
5. Plus 4 meta tests:
   - count fence (≥8 fixtures, ≥5 subdirs)
   - shape fence (every fixture has required keys + valid enum)
   - privacy fence (body excerpt ≤500 chars per CLAUDE.md §6)
   - real-domain fence (no @gmail/@yahoo/@outlook/@icloud/@hotmail/@aol)
```

When a misclassification is reported in production:
1. Add `tests/integration/classifier-fixtures/<label-or-should-not-have-fired>/<descriptive-name>.json`.
2. `pnpm test:run tests/integration/classifier-fixtures.test.ts` — fails.
3. Tune `src/features/classifier/rules.ts` (NOT the fixture).
4. Re-run; ship as one commit.

## Task Commits

1. **Task 1: seed fixture suite + README** — `5ca045a` (test) — README.md + 10 .json fixtures.
2. **Task 2 fix: tighten 0.80 regexes (W3 + bonus discovery)** — `88562b4` (fix) — rules.ts + rules.test.ts.
3. **Task 2 test: fixture-driven harness** — `3262b9f` (test) — classifier-fixtures.test.ts.

The commit split is per CLAUDE.md §5 ("one concern per commit"): the rule fix is a bug fix; the harness is test infrastructure. Tests passed at every commit (the rule fix landed first so the harness commit is a clean test add). All 3 commits pass the full pre-commit gate.

## Files Created/Modified

### Created (12)

- `tests/integration/classifier-fixtures/README.md` — fixture contract, anonymization rules, source-tag convention, `should-not-have-fired/` semantics, add-a-fixture loop.
- `tests/integration/classifier-fixtures/rejection/canonical-rejection.json` — 0.95-tier (decided not to move forward).
- `tests/integration/classifier-fixtures/rejection/generic-rejection.json` — 0.80-tier (paired trigger: "thank you for your interest" + "not selected").
- `tests/integration/classifier-fixtures/interview_invite/explicit-schedule.json` — 0.95-tier (would like to schedule + propose times for).
- `tests/integration/classifier-fixtures/interview_invite/calendar-link.json` — 0.80-tier (calendar invite).
- `tests/integration/classifier-fixtures/recruiter_outreach/cold-outreach.json` — 0.95-tier (saw your profile + reach out about a role).
- `tests/integration/classifier-fixtures/noise/newsletter.json` — 0.95-tier (unsubscribe + manage your subscriptions).
- `tests/integration/classifier-fixtures/unmatched/generic-notification.json` — no rule fires (DocSign notification).
- `tests/integration/classifier-fixtures/should-not-have-fired/greenhouse-sample.json` — ATS confirmation; `expectedLabel: 'unmatched'`.
- `tests/integration/classifier-fixtures/should-not-have-fired/lever-sample.json` — ATS confirmation; `expectedLabel: 'unmatched'`.
- `tests/integration/classifier-fixtures/should-not-have-fired/workday-sample.json` — ATS status update; `expectedLabel: 'unmatched'` (drives W3 tightening).
- `tests/integration/classifier-fixtures.test.ts` — 14-test fixture harness with `it.each` parameterization.

### Modified (2)

- `src/features/classifier/rules.ts`:
  - 0.80 rejection rule split: `/after careful consideration/i` (sole-trigger) + `/thank you for your interest.{0,200}<rejection signal>/i` (paired-trigger requiring "not selected" | "unable to offer" | "not (be )?moving forward" | "decided to (move forward|go) with another" | "chosen (another|a different) (candidate|applicant)" | "other (candidates|applicants)" | "(another|different) (candidate|applicant)").
  - 0.80 recruiter_outreach rule restricted from `source: 'either'` to `source: 'subject'`.
  - Inline comment blocks cite the driving fixture(s) for each change.

- `src/features/classifier/rules.test.ts`:
  - Test 9: rewrote to test the paired-trigger contract ("thank you for your interest" + "not selected").
  - Test 9b (NEW): regression fence — bare "thank you for your interest" must NOT classify as rejection.
  - Test 19: rewrote to test paired-trigger body-side (the body-side counterpart to Test 9).
  - Test 27: rewrote to use "after careful consideration" so the matchedRuleIndex contract is tested without depending on the bare-phrase trigger.

### Fixture count breakdown by subdir

| Subdir | Files | expectedLabel |
|--------|-------|---------------|
| `rejection/` | 2 | `rejection` (0.95 + 0.80 paired) |
| `interview_invite/` | 2 | `interview_invite` (0.95 + 0.80) |
| `recruiter_outreach/` | 1 | `recruiter_outreach` (0.95) |
| `noise/` | 1 | `noise` (0.95) |
| `unmatched/` | 1 | `unmatched` |
| `should-not-have-fired/` | 3 | `unmatched` (Greenhouse, Lever, Workday) |
| **Total** | **10** | — |

Floor was ≥8 fixtures across ≥6 subdirs; delivered 10 across 6.

### Test count breakdown — `classifier-fixtures.test.ts` (14 tests)

| ID | What it verifies |
|----|------------------|
| Meta-1 | Discovers ≥8 fixtures across ≥5 subdirs |
| Meta-2 | Every fixture has required keys + valid enum values |
| Meta-3 | Every body excerpt ≤500 chars (CLAUDE.md §6) |
| Meta-4 | No fixture contains real personal email domains |
| F1 | `interview_invite/calendar-link.json` → `interview_invite` |
| F2 | `interview_invite/explicit-schedule.json` → `interview_invite` |
| F3 | `noise/newsletter.json` → `noise` |
| F4 | `recruiter_outreach/cold-outreach.json` → `recruiter_outreach` |
| F5 | `rejection/canonical-rejection.json` → `rejection` |
| F6 | `rejection/generic-rejection.json` → `rejection` |
| F7 | `should-not-have-fired/greenhouse-sample.json` → `unmatched` |
| F8 | `should-not-have-fired/lever-sample.json` → `unmatched` |
| F9 | `should-not-have-fired/workday-sample.json` → `unmatched` |
| F10 | `unmatched/generic-notification.json` → `unmatched` |

## Decisions Made

1. **W3 disposition: chose option (a) — tune the regex.** Rationale spelled out in the dedicated section above. Trade-off accepted: bare "thank you for your interest" is no longer a rejection signal; LLM fallback handles edge cases.
2. **Bonus tightening: recruiter_outreach 0.80 → subject-only.** Discovered during RED that Greenhouse/Lever bodies tripped the regex via "position at <Company>" / "opening at <Company>". Source-restriction is the simplest tightening that preserves real-outreach coverage (subject lines are author-controlled and class-discriminating).
3. **Two commits for Task 2 (fix + test) per CLAUDE.md §5.** The rule fix and the harness are separate concerns. Sequencing the fix BEFORE the harness commit ensures every commit passes the gate cleanly.
4. **Test 9b explicit unit fence.** Without it, a future revert of the regex split could silently re-introduce the false-positive without breaking any unit test (the fixture harness would still catch it, but locking the contract at both layers is defense-in-depth).
5. **`it.each` over a `describe` per file.** Vitest reports each fixture as a named test (`rejection/canonical-rejection.json → classifyByRules returns expectedLabel`), and the assert message includes the full filepath. One-glance debug surface when a fixture fails.
6. **Sorted directory enumeration.** Stable test order across runs makes CI log diffs trivial. Karpathy §1.2 — simple change with real benefit.
7. **All 10 seed fixtures are `source: 'synthetic'`.** Plan 03-04 ships the seed set; ongoing fixture authoring will mix in anonymized real samples over time. The README documents the loop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] 0.80 recruiter_outreach regex over-fires on ATS body acknowledgments**
- **Found during:** Task 2 RED — running the harness against the 10 seed fixtures revealed BOTH `greenhouse-sample.json` AND `lever-sample.json` fired as `recruiter_outreach@0.80` (not just the workday-sample as `rejection@0.80` per the plan-checker note).
- **Issue:** `/(opportunity|opening|position) (at|with) /i` with `source: 'either'` matches body phrasings like "thank you for applying to the Senior Product Manager position at Acme Corp" (Greenhouse) and "Senior Product Manager opening at Acme Corp" (Lever). Same Pitfall #4 shape as the Workday case — a generic noun phrase that appears in legitimate outreach AND adversarial ATS contexts.
- **Fix:** Restricted the rule to `source: 'subject'`. Real recruiter outreach announces itself in the subject (Tests 13, 14 already cover this); ATS bodies use very different subject phrasings ("We've received your application", "Application received") so they don't match.
- **Files modified:** `src/features/classifier/rules.ts` (one-line `source: 'either'` → `source: 'subject'` + comment block citing the driving fixtures).
- **Verification:** All 33 unit tests in `rules.test.ts` pass; F7 + F8 fixture tests pass.
- **Committed in:** `88562b4` (alongside the W3 rejection fix).

**2. [Rule 2 — Missing Critical] Add Test 9b as the bare-phrase regression fence at the unit-test layer**
- **Found during:** Task 2 GREEN — after splitting the 0.80 rejection rule, only Test 9 (paired-trigger) and Test 19 (paired-trigger body-side) tested the new contract. Nothing locked in "the bare phrase MUST NOT fire."
- **Issue:** A future refactor that accidentally collapses the two patterns back into one (e.g., `/(thank you for your interest|after careful consideration)/i` again) would silently break the W3 tightening at the unit-test layer. The fixture harness would still catch it, but defense-in-depth says we should lock the contract at the unit-test layer too — same level as the `rules.ts` change.
- **Fix:** Added Test 9b: `subject: 'Thank you for your interest in Acme'`, empty body, `expect(out.label).not.toBe('rejection')`. Compact and explicit.
- **Files modified:** `src/features/classifier/rules.test.ts` (one new test).
- **Verification:** Test 9b passes under the new regex; would fail if the regex were reverted.
- **Committed in:** `88562b4` (alongside the rule fix it locks in).

**3. [Rule 1 — Bug] Test 19's first rewrite still triggered the 0.95-tier rejection rule**
- **Found during:** Task 2 GREEN — after first rewriting Test 19 to use "After careful consideration, we have decided to proceed with other candidates", the test failed because the body ALSO triggered the 0.95 rejection regex (`we have decided` + `other candidates` within 40 chars).
- **Issue:** I picked a body phrasing that exercised both the 0.95 AND 0.80 rules; first-match priority within a label gave me 0.95, breaking the 0.80-tier intent.
- **Fix:** Changed Test 19's body to "Thank you for your interest in joining our team. After review your application is not selected." — exercises only the new 0.80 paired-trigger pattern. Documented the choice in the test's comment.
- **Files modified:** `src/features/classifier/rules.test.ts` (Test 19 body string).
- **Verification:** Test 19 passes with `confidence === 0.8`.
- **Committed in:** `88562b4`.

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug + 1 Rule 2 missing-critical + 1 Rule 1 bug discovered while writing tests).

**Impact on plan:** All three were correctness fixes. The plan body said "If a fixture fails (rules.ts didn't match expectedLabel), DO NOT EDIT THE FIXTURE — instead, refine `src/features/classifier/rules.ts` regex(es) to make the fixture pass" — exactly what was done. No scope creep; all changes contained within the plan's named files plus the unit-test file `rules.test.ts` (which the plan implicitly required updating because the tightening is a behavior change).

The plan's `<must_haves>` count assumption (≥8 fixtures, harness asserts label match) is satisfied. The `expected outcome: 11+ tests pass (8 fixtures + 3 meta tests)` line in the plan body undercounted: I added a fourth meta test (real-domain privacy fence) AND seeded 10 fixtures instead of 8, so the actual count is 14 (4 meta + 10 parametrized). Both directional changes (more fixtures, more meta safety) are inside the spirit of the plan.

## Issues Encountered

- **Existing rules tests partially encoded the OLD 0.80 contract.** Tests 9, 19, and 27 each used the bare "thank you for your interest" trigger as the test input. The W3 tightening required rewriting them; the rewrites are documented in the test comments (each one cites Plan 03-04 W3) so future readers know why the tests changed.
- **Pre-existing modified files in working tree.** `git status` showed `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`, and several `.planning/phases/03-classifier-matcher/03-XX-PLAN.md` files as modified/untracked from prior orchestration. Per CLAUDE.md §1.3 (surgical), I did not touch them — they're outside this plan's scope. The orchestrator (or a separate STATE-update step) will manage them.
- **`@gmail.com` etc. in the harness real-domain regex.** Initially considered also blocking `.io`/`.com`/`.net` directly, but that would block `example.com` (which we DO use for placeholders). Settled on the personal-email-provider list; ATS provider domains (greenhouse.io, lever.co, workday.com) are NOT blocked because the fixture content references them as company names, not as user PII.

## Authentication Gates

None — all execution was local pure code. The harness mocks nothing; it calls `classifyByRules` directly.

## Owner-facing note: how to add a fixture when a misclassification is reported

When the classifier mislabels something in production (e.g., a recruiter_outreach gets routed to rejection):

1. **Capture the email** (subject + body excerpt ≤500 chars). Anonymize per the README's rules: replace personal names with "Jane Doe" / "John Smith", company names with "Acme Corp" / "TechCo", email addresses with `@example.com`. Preserve the rule-tripping phrasing verbatim.
2. **Pick the subdir.** True positive of a label → `tests/integration/classifier-fixtures/<label>/`. ATS confirmation that mis-fired → `tests/integration/classifier-fixtures/should-not-have-fired/`.
3. **Create a `.json` file** with `{subject, bodyExcerpt, expectedLabel, source: 'real', notes}`. Filename is descriptive (e.g., `wellfound-recruiter-cold.json`).
4. **Run the harness:** `pnpm test:run tests/integration/classifier-fixtures.test.ts`. The new fixture will fail.
5. **Tune `src/features/classifier/rules.ts`** until the test passes. Add a comment in the regex citing the fixture file.
6. **Update `rules.test.ts` if needed** — if a unit test now encodes the OLD contract, update or supplement it.
7. **Commit fixture + rule(s) + test together** (or as two commits per §5: fix + test, then add fixture). Subject line: `fix(classifier): <what false-positive>` / `test(classifier): add <fixture> to regression corpus`.

## Phase 4 Readiness — exports unchanged

Plan 03-04 doesn't change the Phase 4 import surface. `classifyEmail`, `THRESHOLDS`, `meetsThreshold`, `matchEmail` are all still the canonical imports. The fixture harness is a sibling test that runs in CI; Phase 4's pipeline doesn't import from it.

The 0.80 rejection / 0.80 recruiter_outreach tightening DOES affect Phase 4's behavior at the rule-tier layer — emails that previously fell into those tiers will now (a) get reclassified via LLM (rules-confidence < 0.85) or (b) fall through to `unmatched`. The auto-action behavior (`meetsThreshold(rejection, 0.92)`) is unchanged; the change is purely in the LLM-fallback branch.

## Self-Check

- **All 12 created files exist on disk:**
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/README.md` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/rejection/canonical-rejection.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/rejection/generic-rejection.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/interview_invite/explicit-schedule.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/interview_invite/calendar-link.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/recruiter_outreach/cold-outreach.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/noise/newsletter.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/unmatched/generic-notification.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/should-not-have-fired/greenhouse-sample.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/should-not-have-fired/lever-sample.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures/should-not-have-fired/workday-sample.json` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/classifier-fixtures.test.ts` — FOUND
- **All 3 task commits exist:** `5ca045a`, `88562b4`, `3262b9f` — FOUND in `git log`.
- **Pre-commit gate green:** `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test:run` 275/279 (4 pre-existing TODO), `pnpm build` succeeds, `pnpm depcheck` clean (only pre-existing `middleware.ts` orphan warning).
- **Fixture harness pass count verified:** 14/14 tests pass via `pnpm test:run tests/integration/classifier-fixtures.test.ts`.
- **JSON fixtures all parse-valid:** verified by the harness's load-time `JSON.parse` (no SyntaxError on any fixture); also pre-flight verified Task 1 with a `node -e "JSON.parse(...)"` loop.
- **Privacy gate verified:** `! grep -rE "@gmail|@yahoo|@outlook|@icloud" tests/integration/classifier-fixtures/*/*.json` returns clean. The harness includes the same check + hotmail + aol so future commits can't sneak through.
- **W3 regex tightening verified:** `Test 9b` (bare-phrase regression fence) passes under the new regex; would fail under the old. Workday fixture (`F9`) returns `unmatched` not `rejection`.
- **Recruiter_outreach 0.80 tightening verified:** Greenhouse fixture (`F7`) and Lever fixture (`F8`) both return `unmatched` not `recruiter_outreach`.
- **`source: 'subject'` restriction preserves Tests 13, 14:** both pass — they use subject-side phrasings that still match.
- **No new dependencies:** `package.json` unchanged. Reuses `vitest`, `node:fs`, `node:path` (stdlib).

## Self-Check: PASSED

## Next Phase Readiness

- Plan 03-05 (ADR-0012 amendment) can now reference the fixture-driven regression-fence pattern as the operationalization of the asymmetric-threshold philosophy.
- Phase 4 (Gmail pipeline + cron) has the rule layer regression-fenced. New misclassifications are added to the fixture corpus first, rules tuned second.
- Phase 5's FND-03 (b) "classifier ≥1 fixture per label" coverage category is satisfied (1 rejection, 1 interview_invite, 1 recruiter_outreach, 1 noise, 1 unmatched at minimum — actual is 2/2/1/1/1 + 3 ATS).
- No blockers. No deferred items. No threat flags.

---
*Phase: 03-classifier-matcher*
*Completed: 2026-05-09*
