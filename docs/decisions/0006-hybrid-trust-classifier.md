# ADR-0006: Hybrid trust model + rules-first classifier with LLM fallback

**Status**: Accepted
**Date**: 2026-05-09

## Context

Email classification is the differentiating feature vs. a spreadsheet. Two questions:

1. **Trust**: how much do we let the system act on its own (auto-update status) vs. queue for human review?
2. **Implementation**: rules-based classifier, LLM-based, or hybrid?

## Decision

### Trust: hybrid

- **Confidence ≥ 0.85**: auto-update `Application.canonicalStatus`, write Event with `undoable=true`. UI surfaces an undo affordance (toast for ~10s + permanent in event timeline).
- **Confidence < 0.85**: store classification suggestion on the Email row, surface in `/inbox` review queue. User confirms or corrects with one click.

### Implementation: rules-first with LLM fallback

- **Rules first**: regex patterns against subject + body excerpt. Templated emails ("we regret to inform...", "we'd like to schedule a call...", "thank you for your interest...") match cleanly. Free + instant + deterministic.
- **LLM fallback**: only when rules give low confidence AND the email seems job-related (matched application or known recruiter sender). Uses Claude Haiku, prompt-cached classifier prompt, expected ~$0.0005 per email.

## Consequences

### Positive

- **Trust is graduated.** No "everything auto, you live with errors" or "everything manual, why use a tool". Errors at high confidence get caught via undo; low-confidence cases never silently apply.
- **Cost-controlled.** ~80% of emails are templated rejections / interview invites / noise. Rules handle them free. LLM only runs for ambiguous ~20%.
- **Explainable.** Every classification has a `classifiedBy` field (`rules` / `llm` / `manual`). User can see why something was classified and challenge it.
- **Improvable over time.** As user corrects low-confidence items in review queue, we can promote those patterns into rules — virtuous loop.

### Negative

- **Maintenance of rule patterns.** Email language drifts; rules need occasional updates. Mitigation: low-friction file (`src/features/classifier/rules.ts`) with comments + linked sample emails.
- **LLM cost can creep** if classifier prompt isn't cached or fan-outs occur. Mitigation: 5-minute prompt cache + dedup before LLM call.
- **Two sources of truth for label assignment** (rules + LLM). Mitigation: classifier returns single `{label, confidence, explainer}` regardless of source; consumers never branch on `classifiedBy`.

## Confidence threshold rationale

0.85 chosen because:
- Templated rejection language ("we regret to inform you") yields ~0.95 confidence. Should auto-apply.
- "Thank you for applying" boilerplate yields ~0.90 confidence (rejection ambiguous — might be initial confirmation, might be soft rejection). Should auto-apply only if not the very first email in thread.
- Recruiter outreach ("are you open to opportunities?") yields ~0.60 confidence. Should NOT auto-apply — could be a fresh foray opportunity, not a reply to existing.
- 0.85 puts the threshold where genuine errors become rare without being so high it stops being useful.

Threshold is a config (`CLASSIFIER_AUTO_THRESHOLD` env var) so it can be tuned without code change.

## Privacy

- Rules classifier is local — email content never leaves the machine.
- LLM classifier sends subject + body excerpt (≤500 chars) to Anthropic. Logged to `data/classifier-log.jsonl` (gitignored) for inspection. Full email body never sent.

## Alternatives rejected

- **Fully manual**: no time saving over spreadsheet. Why have a tool.
- **Fully automatic, no review queue**: trust-breaking error case (auto-rejecting an active application due to an unrelated old-thread email) destroys user faith.
- **LLM-only**: 5-10× cost increase for marginal accuracy gain on the 80% of emails that are templated.
- **Rules-only**: handles 80% but the other 20% is exactly the high-value ambiguous cases — worth the LLM tax.
