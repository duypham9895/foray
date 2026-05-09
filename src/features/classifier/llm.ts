// Anthropic SDK wrapper for the classifier (CLASS-02).
//
// Single responsibility: take {subject, bodyExcerpt}, call Claude Haiku 4.5
// with a structured `classify_email` tool, return a typed Result.
//
// **Trust contract (LOCKED in CONTEXT §Area 2):**
//   - Model: claude-haiku-4-5-20251001 (dated string — Plan 03-01 SUMMARY W2)
//   - timeout: 15_000 ms
//   - maxRetries: 0  (Pitfall #6 — SDK retries compound cost on 529 storms;
//                     the cron's next tick is the retry mechanism)
//   - tool_choice: {type: 'tool', name: 'classify_email'}  — forces structured
//                                                           output, defeats
//                                                           prompt-injection
//                                                           (T-03-02-02)
//
// **NOT this file's job:**
//   - checkBudget()       → service.ts (Plan 03-02 Task 2)
//   - appendCostEntry()   → service.ts
//   - rules-first short-circuit → service.ts
//   - input validation (Zod)    → service.ts via classifyEmailInputSchema
//
// llm.ts is a thin SDK adapter: SDK-call-and-translate-errors. No composition.

import 'server-only'

import Anthropic, {
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js'

import { env } from '@/core/env'
import { type AppError, type Result, err, errors, ok } from '@/core/errors'
import type { EmailClassification } from '@/generated/prisma/client'

import { classifyToolOutputSchema } from './schema'

// ---------------------------------------------------------------------------
// LOCKED constants — see CONTEXT §Area 2
// ---------------------------------------------------------------------------

/** Dated Anthropic model string. Plan 03-01 SUMMARY W2 chose the dated form
 *  (over bare "claude-haiku-4-5") for audit-trail clarity. */
export const MODEL = 'claude-haiku-4-5-20251001' as const

/** Cap on response tokens. Tool output is small (label + confidence +
 *  short reasoning). 256 is plenty and keeps cost predictable. */
export const MAX_TOKENS = 256 as const

/** SDK request timeout in milliseconds (T-03-02-08). */
export const TIMEOUT_MS = 15_000 as const

// ---------------------------------------------------------------------------
// Tool definition — input_schema is also enforced server-side by Anthropic,
// but classifyToolOutputSchema in schema.ts re-validates client-side as
// defense in depth.
// ---------------------------------------------------------------------------

export const classifyTool: Tool = {
  name: 'classify_email',
  description: 'Classify a job-related email into one of 5 labels.',
  input_schema: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        enum: ['rejection', 'interview_invite', 'recruiter_outreach', 'noise', 'unmatched'],
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reasoning: { type: 'string', maxLength: 200 },
    },
    required: ['label', 'confidence', 'reasoning'],
  },
}

// ---------------------------------------------------------------------------
// System prompt — names the 5 labels with one example each. Direct: instructs
// the model to output ONLY a tool call, not free text. The "Output exactly one
// classify_email tool call" line is the prompt-injection mitigation lever
// (paired with tool_choice forcing structured output).
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You classify job-related emails into exactly one of these 5 labels.
- rejection: an explicit "we are not moving forward" / "we have decided not to proceed" message.
- interview_invite: a request to schedule, propose times, or join an interview/call.
- recruiter_outreach: a recruiter introducing a new role, asking if you're interested. NOT a follow-up on an existing application.
- noise: newsletters, automated digests, marketing, "view in browser" / "unsubscribe" footer dominant.
- unmatched: none of the above. Includes generic notifications, calendar updates, document signing, etc.

Output exactly one classify_email tool call. Do not output free text.` as const

// ---------------------------------------------------------------------------
// classifyByLlm — public function
// ---------------------------------------------------------------------------

export type ClassifyByLlmInput = {
  subject: string
  bodyExcerpt: string
}

export type ClassifyByLlmSuccess = {
  label: EmailClassification
  confidence: number
  classifiedBy: 'llm'
  inputTokens: number
  outputTokens: number
}

/**
 * Call Anthropic with the locked tool definition and parse the response.
 *
 * Caller is responsible for:
 *   - Running the rules-first short-circuit FIRST (skip LLM if rules confident)
 *   - Calling checkBudget() BEFORE this function
 *   - Calling appendCostEntry() AFTER this function returns ok
 *
 * Failure modes (all return Result.err):
 *   - 401/403 → Unauthorized (bad API key, no retry)
 *   - 429     → RateLimited(60) (Anthropic rate limit; SDK does not retry)
 *   - 529/5xx → ExternalApi (overloaded/server error; cron's next tick retries)
 *   - timeout → ExternalApi (15s cap exceeded)
 *   - response missing tool_use block → ExternalApi('unstructured_response')
 *   - response tool input fails Zod → ExternalApi('invalid_tool_output')
 */
export async function classifyByLlm(
  input: ClassifyByLlmInput,
): Promise<Result<ClassifyByLlmSuccess, AppError>> {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  })

  const userMessage = `Subject: ${input.subject}\n\nBody (excerpt, ≤500 chars): ${input.bodyExcerpt}`

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [classifyTool],
      tool_choice: { type: 'tool', name: 'classify_email' },
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (cause) {
    return err(mapAnthropicError(cause))
  }

  // Inspect response.content for the locked tool_use block.
  const content = (response as { content?: unknown[] }).content
  if (!Array.isArray(content)) {
    return err(errors.externalApi('llm', 'unstructured_response'))
  }
  const toolUse = content.find(
    (block): block is { type: 'tool_use'; name: string; input: unknown } =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: string }).type === 'tool_use' &&
      (block as { name?: string }).name === 'classify_email',
  )
  if (!toolUse) {
    return err(errors.externalApi('llm', 'unstructured_response'))
  }

  const parsed = classifyToolOutputSchema.safeParse(toolUse.input)
  if (!parsed.success) {
    return err(errors.externalApi('llm', 'invalid_tool_output'))
  }

  // Usage block — types declare both fields as numbers; default 0 if SDK ever
  // returns undefined (defensive — should not happen on success).
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
  return ok({
    label: parsed.data.label,
    confidence: parsed.data.confidence,
    classifiedBy: 'llm',
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  })
}

// ---------------------------------------------------------------------------
// Error mapping — Anthropic SDK error class → AppError variant
// ---------------------------------------------------------------------------

function mapAnthropicError(cause: unknown): AppError {
  // Auth / permission first — both are 401/403, both map to Unauthorized.
  if (cause instanceof AuthenticationError || cause instanceof PermissionDeniedError) {
    return errors.unauthorized()
  }

  // Rate limit — 429. SDK exposes RateLimitError; we use the default 60s
  // retry-after because Anthropic's rate-limit headers are not surfaced by
  // the SDK uniformly across versions.
  if (cause instanceof RateLimitError) {
    return errors.rateLimited(60)
  }

  // Generic APIError — covers 5xx, 529 overloaded, and any other status.
  if (cause instanceof APIError) {
    const status = cause.status
    // 529 overloaded → annotate cause string for caller telemetry.
    if (status === 529) {
      return errors.externalApi('llm', '529_overloaded')
    }
    return errors.externalApi('llm', cause)
  }

  // Network errors / timeouts / unknown — APIConnectionError, AnthropicError,
  // plain Error all fall through here.
  return errors.externalApi('llm', cause)
}
