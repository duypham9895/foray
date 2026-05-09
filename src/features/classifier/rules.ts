// Rules-first classifier — pure regex tier table + classifyByRules() entry point.
//
// **Tier semantics (LOCKED in CONTEXT §Area 1):**
//   - 0.95 = explicit phrase ("we have decided not to move forward")
//   - 0.80 = generic phrase ("thank you for your interest")
//   - 1.00 reserved for unmatched (means "definitely cannot decide")
//
// **Match strategy:** scan the subject FIRST, then the body, in declaration
// order. First match per label wins. When multiple labels match across the two
// scans, return the highest-priority label by:
//
//   rejection > interview_invite > recruiter_outreach > noise > unmatched
//
// This priority is intentional and asymmetric — rejection auto-applied wrongly
// destroys trust catastrophically (see Pitfall #4 / ADR-0012 amendment in
// Plan 03-05).
//
// **No I/O. No DB. No Anthropic SDK.** This file is pure code; the LLM fallback
// lives in service.ts (Plan 03-02). Keeping the rules pure means we can test
// the regex tier table in isolation, with no mocks.
//
// Regexes use bounded `.{0,N}` quantifiers (no unbounded `.+`) to avoid
// catastrophic-backtracking ReDoS exposure (threat T-03-01-05).

import type { EmailClassification } from '@/generated/prisma/client'

// ---------------------------------------------------------------------------
// Rule shape
// ---------------------------------------------------------------------------

export type ClassificationRule = {
  label: EmailClassification
  pattern: RegExp
  /** 0.95 = explicit phrase, 0.80 = generic phrase. */
  confidence: 0.95 | 0.8
  /** Where to scan: subject only, body only, or either (the default). */
  source: 'subject' | 'body' | 'either'
}

// ---------------------------------------------------------------------------
// Priority order — index = priority (lower wins).
// ---------------------------------------------------------------------------

const PRIORITY: Record<EmailClassification, number> = {
  rejection: 0,
  interview_invite: 1,
  recruiter_outreach: 2,
  noise: 3,
  unmatched: 4,
}

// ---------------------------------------------------------------------------
// Rule table — refine if Plan 03-04 fixture tests fail.
// ---------------------------------------------------------------------------
//
// IMPORTANT: order within a label matters when both tiers could match — first
// match wins per (label, scan), and 0.95 entries appear before 0.80 so the
// stronger signal is preferred.

export const CLASSIFICATION_RULES: ReadonlyArray<ClassificationRule> = [
  // -- rejection -----------------------------------------------------------
  // Allow optional "to" between the lead-in ("we have decided") and the action
  // ("not move forward") — real recruiter phrasing is almost always
  // "decided not TO move forward". Accept both with `to ?`.
  {
    label: 'rejection',
    pattern:
      /we (have decided|regret to inform).{0,40}(not to move forward|not move forward|not be moving forward|will not be moving forward|other (candidates|applicants))/i,
    confidence: 0.95,
    source: 'either',
  },
  {
    label: 'rejection',
    pattern: /(thank you for your interest|after careful consideration)/i,
    confidence: 0.8,
    source: 'either',
  },

  // -- interview_invite ----------------------------------------------------
  {
    label: 'interview_invite',
    pattern:
      /(would (you )?like to (set up|schedule)|propose times for|next step.{0,30}(call|interview))/i,
    confidence: 0.95,
    source: 'either',
  },
  {
    label: 'interview_invite',
    pattern: /(scheduling|book a time|calendar invite)/i,
    confidence: 0.8,
    source: 'either',
  },

  // -- recruiter_outreach --------------------------------------------------
  {
    label: 'recruiter_outreach',
    pattern:
      /(saw your (profile|background)|came across your (resume|profile)|reach out about a role)/i,
    confidence: 0.95,
    source: 'either',
  },
  {
    label: 'recruiter_outreach',
    pattern: /(opportunity|opening|position) (at|with) /i,
    confidence: 0.8,
    source: 'either',
  },

  // -- noise ---------------------------------------------------------------
  {
    label: 'noise',
    pattern:
      /(unsubscribe|view in browser|update your preferences|manage your subscriptions)/i,
    confidence: 0.95,
    source: 'either',
  },
] as const

// ---------------------------------------------------------------------------
// classifyByRules — pure entry point.
// ---------------------------------------------------------------------------

export type ClassifyByRulesInput = {
  subject: string
  bodyExcerpt: string
}

export type ClassifyByRulesOutput = {
  label: EmailClassification
  confidence: number
  classifiedBy: 'rules'
  /** Index into CLASSIFICATION_RULES of the winning rule, or undefined when unmatched. */
  matchedRuleIndex?: number
}

/**
 * Classify an email by the rule table alone. Pure: no I/O, no DB, no LLM.
 *
 * Algorithm:
 *   1. For each (rule, scan) pair in declaration order, test the pattern
 *      against the chosen field(s).
 *   2. Collect all matches.
 *   3. Pick the highest-priority label (rejection > … > noise).
 *   4. Among matches for that label, pick the FIRST (which is the strongest
 *      tier because the rule table puts 0.95 before 0.80 within each label,
 *      and subject is scanned before body).
 *   5. No matches → unmatched/0.
 */
export function classifyByRules(input: ClassifyByRulesInput): ClassifyByRulesOutput {
  const matches: Array<{ ruleIndex: number; rule: ClassificationRule }> = []

  for (let i = 0; i < CLASSIFICATION_RULES.length; i++) {
    const rule = CLASSIFICATION_RULES[i]!
    // Subject scan first.
    if (rule.source !== 'body' && input.subject && rule.pattern.test(input.subject)) {
      matches.push({ ruleIndex: i, rule })
      continue
    }
    // Body scan.
    if (rule.source !== 'subject' && input.bodyExcerpt && rule.pattern.test(input.bodyExcerpt)) {
      matches.push({ ruleIndex: i, rule })
    }
  }

  if (matches.length === 0) {
    return { label: 'unmatched', confidence: 0, classifiedBy: 'rules' }
  }

  // Highest-priority label wins (lowest PRIORITY number).
  let winner = matches[0]!
  for (let i = 1; i < matches.length; i++) {
    const candidate = matches[i]!
    if (PRIORITY[candidate.rule.label] < PRIORITY[winner.rule.label]) {
      winner = candidate
    }
  }

  return {
    label: winner.rule.label,
    confidence: winner.rule.confidence,
    classifiedBy: 'rules',
    matchedRuleIndex: winner.ruleIndex,
  }
}
