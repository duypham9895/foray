// Public classifier service — composition of rules-first → budget gate → LLM
// fallback → cost recording.
//
// **Algorithm (LOCKED in CONTEXT §Area 2):**
//
//   1. Validate input via classifyEmailInputSchema (≤500 chars each).
//   2. Run classifyByRules() — pure regex tier table from Plan 03-01.
//   3. Short-circuit:
//        - rules.confidence >= 0.85            → return rules result as-is
//      Confident rules skip checkBudget AND classifyByLlm — cost-bound by
//      design. Unmatched and weak rules escalate to the selected LLM provider.
//   4. checkBudget() — FAIL CLOSED on read failure (Plan 03-01 / T-03-02-03).
//      If RateLimited, return that err. The LLM is NEVER called.
//   5. classifyBySelectedLlm() — user-selected provider with structured output.
//      If err, return that err. appendCostEntry is NOT called (no charge for
//      failures).
//   6. appendCostEntry() — best-effort. See HACK comment below for why we
//      intentionally ignore the Result.
//   7. Return ok({label, confidence, classifiedBy: 'llm'}).
//
// **Trust contract for Phase 4 (inbox.pollOnce):**
//   - Idempotency on email.classifiedBy is the CALLER's job (skip re-classify
//     if already classified). This service is pure w.r.t. the database.
//   - The 50-email-per-tick cap is the CALLER's loop concern.
//
// See PRINCIPLES.md §"Error handling" + threat-model entries T-03-02-01..08.

import 'server-only'

import { ok, err, type Result } from 'neverthrow'

import { errors, type AppError } from '@/core/errors'
import { logger } from '@/core/logger'
import type { EmailClassification } from '@/generated/prisma/client'
import type { LlmProvider } from '@/generated/prisma/client'

import { classifyByRules } from './rules'
import { classifyBySelectedLlm, DEFAULT_LLM_PROVIDER, getModelForProvider } from './providers'
import { checkBudget, appendCostEntry, hashEmailContent } from './budget'
import { classifyEmailInputSchema } from './schema'

// ---------------------------------------------------------------------------
// Public types — Phase 4's import surface
// ---------------------------------------------------------------------------

export type ClassifyEmailInput = {
  subject: string
  bodyExcerpt: string
  provider?: LlmProvider
}

export type ClassifyEmailOutput = {
  label: EmailClassification
  confidence: number
  classifiedBy: 'rules' | 'llm'
}

/** The `confidence >= RULES_SHORT_CIRCUIT` threshold above which a rules
 *  match is accepted without LLM refinement. CONTEXT §Area 2 LOCKED at 0.85. */
const RULES_SHORT_CIRCUIT = 0.85

// ---------------------------------------------------------------------------
// classifyEmail — public entry point
// ---------------------------------------------------------------------------

export async function classifyEmail(
  input: ClassifyEmailInput,
): Promise<Result<ClassifyEmailOutput, AppError>> {
  // Step 1: validate input (slice boundary).
  const parsed = classifyEmailInputSchema.safeParse(input)
  if (!parsed.success) {
    return err(errors.validation(parsed.error.issues))
  }
  const { subject, bodyExcerpt } = parsed.data
  const provider = input.provider ?? DEFAULT_LLM_PROVIDER

  // Step 2: rules-first.
  const rules = classifyByRules({ subject, bodyExcerpt })

  // Step 3: short-circuit only confident rules. Unmatched and weak rules need
  // LLM refinement; otherwise most mail never reaches the selected provider.
  if (rules.confidence >= RULES_SHORT_CIRCUIT) {
    return ok({ label: rules.label, confidence: rules.confidence, classifiedBy: 'rules' })
  }

  // Step 4: budget gate BEFORE the SDK call (control, not monitoring).
  const budget = await checkBudget()
  if (budget.isErr()) return err(budget.error)

  // Step 5: LLM call. On failure, propagate without recording cost — Anthropic
  // doesn't bill for failed requests (T-03-02-07 documents the trade-off).
  const llm = await classifyBySelectedLlm({ subject, bodyExcerpt }, provider)
  if (llm.isErr()) return err(llm.error)

  // Step 6: best-effort cost recording.
  // HACK(duy, 2026-05-09): cost-log write failure does not abort the
  // classification — the LLM call SUCCEEDED and the caller already paid for
  // it; failing closed here would punish the user for a disk hiccup. The
  // trade-off: today's budget under-counts during the un-writable window
  // (between this append failure and the next checkBudget call when the
  // file becomes readable again, which fail-closes correctly per T-03-01-02).
  // We surface the silent loss to the logger so an operator triaging the
  // cost-log can see why a classified email is missing from data/classifier-
  // log.jsonl. Standard milestone: route to a dedicated alerting channel.
  const emailHash = hashEmailContent(subject, bodyExcerpt)
  const append = await appendCostEntry({
    inputTokens: llm.value.inputTokens,
    outputTokens: llm.value.outputTokens,
    model: getModelForProvider(provider),
    emailHash,
  })
  if (append.isErr()) {
    logger.error(
      { op: 'classifier.cost.silent_loss', emailHash, err: append.error },
      'cost entry not recorded — classification succeeded but today’s budget will under-count',
    )
  }

  // Step 7.
  return ok({
    label: llm.value.label,
    confidence: llm.value.confidence,
    classifiedBy: 'llm',
  })
}
