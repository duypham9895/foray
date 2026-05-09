# ADR-0005: Hybrid status model — canonical_status + current_stage + Stage[]

**Status**: Accepted
**Date**: 2026-05-09

## Context

Different companies run interviews differently. Google has "team match"; a startup has "founder coffee"; FAANG has "bar raiser". A fixed pipeline (`Applied → Screening → Phone → Onsite → Offer`) lies about reality. A fully free-form model breaks global views ("how many forays are in screening?").

## Decision

Three-layer model on the `Application` entity:

1. **`canonicalStatus`** — fixed enum (6 values: `applied`, `screening`, `interviewing`, `offer`, `rejected`, `withdrawn`). Used for global aggregations, list filtering, dashboard counts, classifier auto-updates.

2. **`currentStage`** — free text. Used for detail view nuance ("Tech round 2 with hiring manager scheduled Tuesday").

3. **`Stage[]`** — ordered timeline of stages, each with `name`, `scheduledAt`, `completedAt`, `outcome`, `notes`. Records the truth of how this specific company's process unfolded.

## Consequences

### Positive

- **Aggregations + truthfulness, both.** Global views work via `canonicalStatus`; detail captures reality via `currentStage` + `Stage[]`.
- **Email classifier has a clean target.** Classifier sets `canonicalStatus` (knowable from email content) without ever needing to set `currentStage` (would be guessing).
- **Matches industry pattern.** Greenhouse, Lever, Ashby all use canonical-stage-internal + per-job-custom-stages. We're rebuilding the same primitive at 1/1000th the scale.

### Negative

- **Two fields to keep in sync.** When user advances to "Tech round 2", `currentStage` updates but `canonicalStatus` may or may not (still `interviewing` either way). Convention: classifier and direct status changes update `canonicalStatus`; stage timeline updates and notes update `currentStage`.
- **Risk of drift.** User could have `canonicalStatus = applied` and `currentStage = "On-site round 3"`. Mitigation: UI surfaces this as a warning ("status seems stale — update?"); never auto-correct without user action.

## The 6 canonical_status values

| Value | Meaning |
|---|---|
| `applied` | Submitted, no signal back yet |
| `screening` | Recruiter / phone screen / take-home phase |
| `interviewing` | Multi-round interview phase (panel, on-site, etc.) |
| `offer` | Offer received, not yet decided |
| `rejected` | Closed by company OR by candidate-with-rejection-letter |
| `withdrawn` | Closed by candidate before any decision |

If a state turns out to be persistently missing, add it via a new ADR + migration. Don't squat unrelated meanings.

## Alternatives rejected

- **Fixed pipeline only**: lies about reality. Different companies → different stages.
- **Free-form per company only**: breaks global aggregations.
- **One enum, many values (e.g., `phone_screen_scheduled`, `phone_screen_complete`, `onsite_scheduled`...)**: enum explodes; tracking still imprecise per-company.
