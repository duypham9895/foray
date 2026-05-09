# ADR-0007: v1-Full delivered as Lean → Standard → Full milestones

**Status**: Accepted
**Date**: 2026-05-09

## Context

The owner asked for v1-Full scope despite the brainstorm recommending v1-Standard for a job-hunting timeline. v1-Full estimated at ~3+ weeks of focused work; v1-Lean at ~4 days; v1-Standard at ~1.5 weeks.

## Decision

Build v1-Full incrementally as three milestones — each a usable end-state — rather than a single 3-week drop:

1. **Lean** (~week 1): manual entry + Gmail polling + classifier + review queue + applications list/detail. Owner can use foray for real job hunt by end of week 1.

2. **Standard** (~week 2-3): + bookmarklet capture + "Today" dashboard + tags + search. Removes friction from capture flow; gives daily-check ritual a clear landing.

3. **Full** (~week 4+): + native Chrome MV3 extension + document storage + recruiter entity + Google Calendar sync + analytics + follow-up reminders. The "real product" version.

See [docs/milestones/](../milestones/) for each milestone's checklist.

## Consequences

### Positive

- **Time to first value: 1 week, not 3+.** Owner uses the tool during the rest of the job hunt rather than waiting for full feature set.
- **Each milestone is shippable.** Stopping at Lean is fine. Stopping at Standard is fine. Full only happens if Standard's gaps justify the work.
- **Learning compounds.** Real usage in week 1 reshapes weeks 2+. Things planned for Standard might get cut as unnecessary; things skipped from Full might get pulled forward as critical.
- **Schema scope is clear up-front.** All entities (Document, Recruiter, etc.) are in `prisma/schema.prisma` from the start, but unused tables don't hurt — they're cheap. Code that uses them lands per-milestone.

### Negative

- **Slightly more planning overhead** than a single drop. Mitigated by milestones being explicit, not aspirational — they're committed scope.
- **Risk of milestone drift.** "Standard could really use this Full feature..." Mitigation: explicit ADR for any scope change between milestones.

## Implementation cadence

- Each milestone: `gsd-plan-phase` (or equivalent) → execute → verify → archive
- Between milestones: pause, use the tool for a few days, decide whether the next milestone is still right
- A milestone is "done" when its acceptance criteria all check (see [docs/milestones/](../milestones/))

## Alternatives rejected

- **Single 3-week drop of v1-Full.** Owner has no working tool for 3 weeks during their job hunt. Wrong tradeoff.
- **Drop to v1-Standard.** Owner explicitly chose v1-Full; not our call to override.
- **Drop to v1-Lean and re-evaluate.** Reasonable but loses the explicit Full-roadmap commitment. The milestone structure preserves both options.
