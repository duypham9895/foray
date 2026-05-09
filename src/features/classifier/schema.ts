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
