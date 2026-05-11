// Zod schemas for the classifier slice.
//
// Two responsibilities:
//   1. classifyEmailInputSchema — slice-boundary input validator. Caps subject
//      and bodyExcerpt at 500 chars each (CLAUDE.md §6 privacy + the LLM
//      prompt is built from these fields verbatim, so the cap also bounds
//      token spend per call).
//   2. classifyToolOutputSchema — validates the JSON Anthropic returns inside
//      a `classify_email` tool call. Anthropic enforces the input_schema
//      server-side, but we re-validate here so a future SDK regression or
//      bypass cannot poison the classifier with an unexpected label.
//
// **Privacy note:** these caps are NOT the only place the 500-char rule is
// enforced — Phase 4's ingestion stage also caps when it slices the email
// body. Defense-in-depth (T-03-02-01).

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Slice-boundary input validator
// ---------------------------------------------------------------------------

export const classifyEmailInputSchema = z.object({
  subject: z.string().max(500),
  bodyExcerpt: z.string().max(500),
})

export type ClassifyEmailInput = z.infer<typeof classifyEmailInputSchema>

// ---------------------------------------------------------------------------
// Anthropic tool-call output validator
// ---------------------------------------------------------------------------

export const classifyToolOutputSchema = z.object({
  label: z.enum(['rejection', 'interview_invite', 'recruiter_outreach', 'noise', 'unmatched']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
})

export type ClassifyToolOutput = z.infer<typeof classifyToolOutputSchema>

export const CLASSIFY_OUTPUT_JSON_SCHEMA = {
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
  additionalProperties: false,
}

export type ClassifyByLlmInput = {
  subject: string
  bodyExcerpt: string
}

export type ClassifyByLlmSuccess = {
  label: z.infer<typeof classifyToolOutputSchema>['label']
  confidence: number
  classifiedBy: 'llm'
  inputTokens: number
  outputTokens: number
}

export const SYSTEM_PROMPT = `You classify job-related emails into exactly one of these 5 labels.
- rejection: an explicit "we are not moving forward" / "we have decided not to proceed" message.
- interview_invite: a request to schedule, propose times, or join an interview/call.
- recruiter_outreach: a recruiter introducing a new role, asking if you're interested. NOT a follow-up on an existing application.
- noise: newsletters, automated digests, marketing, "view in browser" / "unsubscribe" footer dominant.
- unmatched: none of the above. Includes generic notifications, calendar updates, document signing, etc.

Output exactly one classify_email object. Do not output free text.` as const
