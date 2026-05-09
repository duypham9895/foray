# ADR-0012: Status-regression block at the service layer + auto-update Event visual treatment

**Status**: Accepted
**Date**: 2026-05-09 (amended 2026-05-09 — added Decision C)

## Context

Phase 2 (Applications Slice — Manual Tracker) shipped two cross-cutting decisions
that future phases will be tempted to revisit. Both appear in ROADMAP.md
§"Cross-Cutting Concerns" under the **trust trio**: per-label thresholds (Phase 3),
status-regression block + undo idempotency (Phase 2 + Phase 4), and visually-distinct
event styling (Phase 2 + Phase 5). This ADR locks the two pieces that landed in
Phase 2 so Phase 4's `inbox/act` orchestrator and any later UI redesign know
where the boundary lives.

### Sub-context A — status regression

Phase 4's classifier-driven `inbox/act` stage will call `applyAutoStatusChange`
for every email the classifier labels with `confidence ≥ env.CLASSIFIER_AUTO_THRESHOLD`.
Without a guard, a single ambiguous email can un-reject a foray. Concrete failure
mode (PITFALLS.md §4): a recruiter's "did you receive our previous email?" reply
arriving on a thread that the classifier already labeled `rejection` could be
classified as `interview_invite` on the new message and silently overwrite the
rejection. This is the exact class of "silent record corruption" that ADR-0006
(hybrid trust classifier) was written to prevent.

Two valid placements were considered:

1. **Guard at the controller** (Phase 4 `inbox/act`) — keep the service
   permissive; let the orchestrator decide whether to apply or route to review.
   Risk: every future caller (cron handler, manual classifier replay, batch
   reconciliation script) re-implements the same check. The classifier
   contract becomes "service is permissive, callers are responsible" —
   discipline-based safety, which the four laws (PRINCIPLES.md) reject.

2. **Guard at the service** (Phase 2 `applications/service.ts`) — service refuses
   regressions; controller routes to the review queue on `Conflict`. Single
   enforcement site, single code path, single test surface.

### Sub-context B — auto-update Event visual treatment

Auto-applied status changes need to be visually distinct from manual edits in
the `/applications/[id]` timeline (APP-02 success criterion + DESIGN.md). A user
scanning the timeline must instantly tell which entries the system applied vs
which entries they applied themselves — especially when reviewing what the
classifier acted on. This is foundational to the trust contract: the user can
glance at any foray and see the line between "what I did" and "what the system
inferred."

DESIGN.md constraints:
- No decorative icons (§"Less icons, more humanity").
- Colors used sparingly, anchored to the canonical_status palette.
- Rejection rendered in muted gray, **never red** (§"Color palette").
- `cyan-600` is the `screening` hue — semantically "in progress, gentle attention."

Three visual treatments were considered:

1. **Background-only tint** (no rail, no label). Pros: minimal. Cons: invisible
   if the user scans on mobile or in dim light; "tinted row" reads as a hover
   state, not as a system-vs-human distinction.

2. **Icon + text** (e.g., a robot icon + "Auto"). Pros: instant pictogram
   read. Cons: violates DESIGN.md §"Less icons, more humanity"; introduces
   "AI" connotation that DESIGN.md §"Tone of voice" explicitly bans.

3. **Tinted background + colored left rail + text label, no icon.** Pros:
   redundant signals (color, geometry, words) for accessibility; aligns with
   DESIGN.md (text > icons); rail color anchors to the canonical_status
   palette so the visual stays consistent if Phase 4 adds more system events.
   Cons: more Tailwind classes to track in one component (acceptable — the
   classes are documented in this ADR + the file is the only renderer).

### Sub-context C — per-label threshold asymmetry

PITFALLS.md §4 documents the central trust risk: the FIRST wrong auto-classification
destroys trust before undo can save it. The asymmetric cost is the key insight —
a false-positive `rejection` on an active interview is *catastrophic* (the owner
may stop replying to the recruiter), while a false-negative (item lands in
review queue) is *zero cost*.

The original `env.CLASSIFIER_AUTO_THRESHOLD` (single number, default 0.85)
encodes the wrong assumption that all labels carry equal cost. A 0.85 threshold
is too lax for `rejection` (which needs to be near-certain to auto-act) and too
strict for `noise` (where filtering aggressively is the goal — false positives
just sit in review queue harmlessly).

Phase 3's classifier slice introduces a typed map of asymmetric thresholds
that supersedes the single env-var gate.

## Decision

### A. Status regression is enforced at the service layer

The single source of truth for the regression rule is
`src/features/applications/status-transitions.ts`, which exports
`isStatusRegression(prev, next): boolean`. The implementation file is the
authoritative spec; this ADR locks the *placement* and *semantics*.

Enforcement site: `src/features/applications/service.ts:applyAutoStatusChange`.
The service reads the current status, compares via `isStatusRegression`, and
on a regression returns
`err({_tag: 'Conflict', reason: 'STATUS_REGRESSION_REQUIRES_REVIEW'})`. The
check happens inside the same `withRls` transaction as the would-be write,
so a rejection rolls the transaction back atomically (no partial state).

`applyManualStatusChange` does **not** call `isStatusRegression`. Manual
changes by the user are intentional; the user has context the classifier
doesn't. The dropdown in `status-dropdown.tsx` is the user saying "I know
what I'm doing" — bypassing the guard is the contract.

#### Terminal-status semantics

`rejected` and `withdrawn` are both at rank 5 in the
`STATUS_RANK` table inside `status-transitions.ts`. The terminal-status rule:

| From → To | Classification | Rationale |
|-----------|----------------|-----------|
| Any non-terminal → terminal | **Forward** | Closing out is normal lifecycle progress. |
| Terminal → non-terminal | **Regression** (blocked) | Un-rejecting requires deliberate human undo via `undoStatusChange`, not an automated reclassification. |
| Terminal ↔ terminal (rejected ↔ withdrawn) | **No movement** | Neither forward nor regression — the foray is already closed. |
| Non-terminal → non-terminal (rank decreases) | **Regression** (blocked) | Going backward in the funnel without explicit human intent is the failure mode this ADR prevents. |

The terminal rule prevents the exact PITFALLS.md §4 bug: an `interview_invite`
classification on a thread post-rejection cannot un-reject the foray. The
regression check fires; the conflict is returned; Phase 4's controller will
route the email to the review queue.

Tests: `src/features/applications/status-transitions.test.ts` covers all 36
cells of the canonical_status × canonical_status truth table.

### B. Auto-update Event renders with cyan-tinted row + 2px cyan-600 left rail + text label

Implementation site: `src/features/applications/components/timeline.tsx`.
The visual treatment fires when:
- `event.type === 'auto_status_changed'`
- `event.undoneAt === null` (undone events get the strikethrough treatment
  described below)

Exact Tailwind classes (the timeline.tsx classes are the spec; this ADR
mirrors them so a future redesign can find both via `git grep`):

- **Background**: `bg-cyan-50` (light), `dark:bg-cyan-950/30` (dark)
- **Left rail**: `border-l-2 border-cyan-600`
  (cyan-600 = the `screening` hue per DESIGN.md status palette; "in progress,
  gentle attention" — the right semantic anchor for "system inferred this")
- **Label**: `<span className="text-sm text-stone-500">Auto-updated from email</span>`
  — text only, no icon (per DESIGN.md §"Less icons, more humanity")

Manual events (`status_changed`, `stage_added`, `stage_completed`,
`note_added`, `status_undone`) get a plain row: no rail, no tinted background,
no special label. The visual contrast IS the signal.

Undone events (`event.undoneAt !== null`) render with `text-stone-400 line-through`
to show the action was reversed. The strikethrough overlays the cyan rail
(rather than removing it) so the audit trail stays visible — a user can
still see "the system did this, then I undid it" in one row.

Conditional source-email link (Phase 4 contract surface):

```tsx
{data.emailId != null && (
  <a href={`/inbox/${data.emailId}`}
     className="text-sm text-stone-500 hover:text-stone-700 underline">
    View source email
  </a>
)}
```

Phase 2 doesn't exercise this branch (no Gmail wired yet; `emailId` is always
null on real data). The branch must exist in code so Phase 4 can wire
`/inbox/[emailId]` without re-editing `timeline.tsx`. Verified by grep in
the Plan 04 acceptance criteria.

### C. Asymmetric per-label classifier thresholds (Phase 3 — added 2026-05-09)

The single source of truth for the auto-act gate is
`src/features/classifier/thresholds.ts`, which exports a typed
`THRESHOLDS: Record<EmailClassification, number>` and a `meetsThreshold(label, confidence): boolean`
predicate. Phase 4's `inbox/act` stage MUST use `meetsThreshold(cls.label, cls.confidence)`
as the auto-act gate — NOT `cls.confidence >= env.CLASSIFIER_AUTO_THRESHOLD`.

Locked threshold values (Phase 3 CONTEXT §Area 3):

| Label                | Threshold | Rationale                                                                                                                                                                                |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rejection`          | **0.92**  | HIGH bar — false positive is catastrophic (PITFALLS.md §4). Better to land in review than to silently un-engage with a live opportunity.                                                |
| `interview_invite`   | **0.85**  | Moderate — false positive is recoverable (the user sees a "scheduled interview" status they didn't expect, edits to correct). False negative just goes to review.                       |
| `recruiter_outreach` | **0.80**  | Moderate-low — these emails don't change `Application.canonicalStatus`; the cost of mis-labeling is informational.                                                                     |
| `noise`              | **0.70**  | Aggressive — we WANT noise filtered. False positives sit in review queue with no downstream effect. False negatives clutter the user's view.                                            |
| `unmatched`          | **1.0**   | NEVER auto-acts. Always sent to review. The unmatched label is the explicit "I don't know" outcome.                                                                                     |

Why a typed map, not env vars:

- Per-label values must be set together (asymmetry is the contract).
- Threshold changes are decisions that warrant code review + test changes — not
  an .env edit at runtime.
- The map is type-checked: adding a new `EmailClassification` enum variant
  forces a TypeScript error in `thresholds.ts` until the new label is mapped.

The pre-existing `env.CLASSIFIER_AUTO_THRESHOLD` (default 0.85) STAYS in
`src/core/env.ts` for backward compatibility but is **not consumed by the
act-stage gate**. Phase 4 may use it as a global *floor* (e.g., reject if
any label's confidence is below 0.5 regardless of `THRESHOLDS[label]`),
but it is NOT the discriminating value.

#### Pitfall #4 — never quietly lower `REJECTION_FLOOR`

A future operator looking at the review queue and seeing rejections sitting at
0.90 confidence will be tempted: "why don't we just auto-apply these?" The
answer is the asymmetric cost matrix above. Rejection is destructive: hides a
foray, removes it from active tracking, can be undone but the user has to
notice it happened. Interview-invite and recruiter-outreach are additive: they
create or surface state. False positives there waste a slot in the review
queue or add a label; false positives on rejection make the user lose track
of a live opportunity.

Anyone proposing to lower `REJECTION_FLOOR` below 0.92 must (a) measure
recent classifier precision on rejections at the current floor, (b) propose a
recovery UX (e.g., "undo last 24h of auto-rejections" — Phase 3 does NOT ship
that view), AND (c) supersede this ADR per the rule below — a numeric tweak
that lowers the rejection floor crosses the asymmetric-cost reasoning, so it
is no longer a tunable, it is a new decision.

#### Bonus — budget guard as control, not monitoring (Phase 3 CONTEXT §Area 4)

Plan 03-01's `src/features/classifier/budget.ts` exports `checkBudget()`,
which Plan 03-02's `classifyEmail` calls BEFORE every Anthropic SDK call
(PITFALLS.md §6: pre-call check, not post-call accounting). The daily cap
is `$0.50 USD`, computed from `data/classifier-log.jsonl` entries with
today's `ts`. On budget exhaustion: `err({_tag: 'RateLimited', retryAfterSeconds: secondsUntilMidnight()})`.
On read failure: **FAIL CLOSED** (also `RateLimited`) — never silently allow.

Anthropic Claude Haiku 4.5 pricing constants (locked in `budget.ts`,
comment-anchored to source date):

- `HAIKU_INPUT_USD_PER_MTOK = 0.80`
- `HAIKU_OUTPUT_USD_PER_MTOK = 4.00`

Updates to pricing require a `budget.ts` edit + a test re-run (the pure
`computeCostUsd` function is unit-tested with exact expected values).

#### Code paths that must update in lockstep

Anyone changing the threshold values must update them in lockstep:

- `src/features/classifier/thresholds.ts` — the values themselves and their JSDoc.
- `src/features/classifier/service.ts` — composes rules → budget → LLM; reads the rules-confidence short-circuit threshold (0.85). If the THRESHOLDS table changes, the short-circuit threshold may need to follow.
- `src/features/classifier/budget.ts` — pricing + daily cap. Independent of the per-label thresholds, but lives in the same slice and is part of the same trust contract (Decision C bonus).
- The corresponding `*.test.ts` colocated tests — every threshold has a boundary test that pins the value (e.g., 0.91 → review queue, 0.92 → auto-apply for rejection). The pre-commit hook runs `pnpm test:run`; do not bypass it with `--no-verify`.

## Consequences

### Positive

- Phase 4's `inbox/act` stage is a thin orchestrator. The contract becomes:
  call `applyAutoStatusChange`; on `Conflict({reason: 'STATUS_REGRESSION_REQUIRES_REVIEW'})`
  route the email to the review queue. Zero regression logic in Phase 4 — the
  rule is locked here.
- The timeline visual is consistent across Phase 2 (manual + classifier-fixture
  seed via `scripts/dev/insert-fake-auto-event.ts`) and Phase 4 (real
  Gmail-driven auto events) without further coordination.
- Terminal-status rule prevents the PITFALLS.md §4 bug class. The 36-cell
  truth table in `status-transitions.test.ts` serves as the regression
  fence — any future change to the rule must update the truth table first.
- `cyan-600` anchors auto-update events in the `screening` hue family — same
  semantic register ("system inferred something is in progress"). If Phase 4
  adds more auto event types (e.g., `auto_stage_inferred`), they inherit
  the same visual vocabulary without further design work.
- The visual treatment is grep-discoverable: `git grep "border-cyan-600"` and
  `git grep "Auto-updated from email"` both land in `timeline.tsx` and this
  ADR — a future redesign or an a11y audit can find the contract in one
  search.

### Negative

- Service-layer regression block means Phase 4 must distinguish `Validation`
  and `NotFound` errors (which surface as user-visible feedback) from
  `Conflict` errors (which silently route to review queue). Mitigation:
  the structured `AppError._tag` discriminator already supports this; no
  new error variant needed.
- The Tailwind classes for the auto-update treatment live in `timeline.tsx`.
  If a future redesign moves to a different design system, those classes
  need to migrate. Mitigation: the class set is enumerated in this ADR
  and grep-anchored on `bg-cyan-50` and `border-cyan-600` — a redesign PR
  can find every callsite in one pass.
- `STATUS_RANK` in `status-transitions.ts` encodes the rank table as a
  literal `Record<CanonicalStatus, number>`. Adding a new canonical status
  (e.g., `accepted` distinct from `offer`) requires updating this map AND
  updating the truth table tests. This is intentional — the rank table is
  the contract; changing it without test updates would be a silent semantic
  drift.

## When we'd reconsider

- **Phase 4 reveals a class of email signal where regression is correct.**
  Example: a "we'd like to re-open your application for a different role"
  email from the same recruiter, where the classifier is highly confident.
  At that point: introduce a `forceRegression` flag on `applyAutoStatusChange`
  requiring explicit caller intent; do **not** remove the default block.
  The flag forces the caller to write the comment explaining why this case
  is different.
- **The classifier becomes confident enough that the regression block is too
  conservative.** Example: a hypothetical Phase 6 with multi-signal
  corroboration (sender domain + thread continuity + LLM agreement at >0.95).
  At that point: add a confidence-tier flag to the regression check, not
  a global override.
- **DESIGN.md adopts a different status palette.** Update this ADR, supersede
  with a new ADR (do **not** silently edit), and migrate the Tailwind classes
  in `timeline.tsx` in the same PR.
- **`rejected` and `withdrawn` diverge in semantics** — e.g., `withdrawn`
  becomes a "soft pause" rather than a terminal closure. At that point:
  update `STATUS_RANK`, supersede this ADR, regenerate the truth table
  tests.

## References

- ADR-0005 (`docs/decisions/0005-hybrid-stages.md`) — establishes the
  `canonical_status` enum and its 6 values; the rank table here lives on
  top of that enum.
- ADR-0006 (`docs/decisions/0006-hybrid-trust-classifier.md`) — the upstream
  rationale for "auto-applied with explicit undo" and the trust contract
  this ADR enforces at the lower boundary.
- ROADMAP.md §"Cross-Cutting Concerns" → "Trust trio (per-label thresholds
  + status-regression block + undo race fix + visually-distinct events)"
- `.planning/phases/02-applications-slice-manual-tracker/02-CONTEXT.md`
  §"Area 3" + §"Area 4" — the locked Phase 2 decisions this ADR records.
- DESIGN.md §"Color palette" + §"Less icons, more humanity" + §"Tone of voice"
  — the aesthetic constraints driving the visual treatment.
- Implementation: `src/features/applications/status-transitions.ts`
  (the rank table + `isStatusRegression`),
  `src/features/applications/service.ts:applyAutoStatusChange` (the
  enforcement site),
  `src/features/applications/components/timeline.tsx` (the rendering site).
- Tests: `src/features/applications/status-transitions.test.ts` (36-cell
  truth table covering every (prev, next) canonical_status pair).
- `src/features/classifier/thresholds.ts` (Plan 03-01) — the typed THRESHOLDS map + meetsThreshold predicate. Authoritative spec for Decision C.
- `src/features/classifier/budget.ts` (Plan 03-01) — checkBudget pre-call guard + appendCostEntry recorder. Authoritative spec for Decision C bonus.
- `src/features/classifier/service.ts` (Plan 03-02) — composes rules → budget gate → LLM. Reference implementation for "budget gate runs before SDK call".
- `.planning/phases/03-classifier-matcher/03-CONTEXT.md` §"Area 3" + §"Area 4" — the locked Phase 3 decisions Decision C records.
- PITFALLS.md §4 — "First wrong auto-classification destroys trust before undo can save it". The driving rationale for the asymmetry table and Pitfall #4.

## Supersedes

None. New decision. Future ADRs amending the visual treatment or regression
semantics MUST mark themselves as superseding this one (do **not** silently
edit) — see ADR-0011 §"Supersedes" for the established convention.

The §C amendment landed on 2026-05-09 (Plan 03-05) is the **documented
exception** to that rule. The trust trio (block + flash + threshold) was
always intended to close in Phase 3 per ROADMAP.md §"Cross-Cutting Concerns";
the threshold half was held back only because it required a working
classifier. Decision C is therefore the natural completion of the original
scope, not a revision of any decision actually made in Phase 2. The amendment
is visible (date-stamped, new section appended after §B; §A and §B are
unchanged), so the supersession line is drawn at: **edits to existing §A or
§B content require supersession; appending the originally-deferred §C does
not.** Future amendments must follow the supersession rule. This one is the
recorded exception.
