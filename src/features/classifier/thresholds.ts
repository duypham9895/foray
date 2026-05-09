// Per-label asymmetric auto-action thresholds.
//
// Values LOCKED in CONTEXT §Area 3 (Phase 3 planning) and rationale captured in
// the ADR-0012 amendment that lands in Plan 03-05. The asymmetry —
// rejection (0.92) HIGHER than interview_invite (0.85) — exists because a
// wrongly auto-applied rejection destroys user trust catastrophically
// (Pitfall #4). A wrongly auto-applied interview_invite is recoverable.
//
// **Anti-pattern blocked:** A single env var
// `CLASSIFIER_AUTO_THRESHOLD=0.85` blanket gate is REJECTED — every label has
// different stakes. The env var still exists in env.ts for backward compat
// but per-label gates live here in code.
//
// Phase 4's act-stage will read this map directly:
//   if (cls.confidence >= THRESHOLDS[cls.label]) applyAutoStatusChange(...)
//
// Module-load-time invariant (encoded as a test, not a throw): the rejection
// threshold MUST exceed the interview_invite threshold. We don't throw at
// module load because production should not crash on a typed misconfiguration.

import type { EmailClassification } from '@/generated/prisma/client'

export const THRESHOLDS: Record<EmailClassification, number> = {
  rejection: 0.92,
  interview_invite: 0.85,
  recruiter_outreach: 0.8,
  noise: 0.7,
  unmatched: 1.0,
} as const

/**
 * Predicate used by Phase 4's act-stage. Returns true iff the classifier's
 * confidence is at or above the per-label threshold. Boundary is INCLUSIVE
 * (`>=`) so the table values match the auto-act decision exactly.
 */
export function meetsThreshold(label: EmailClassification, confidence: number): boolean {
  return confidence >= THRESHOLDS[label]
}
