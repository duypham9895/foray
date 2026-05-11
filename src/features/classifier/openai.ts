import 'server-only'

import { env } from '@/core/env'
import { err, errors, ok, type AppError, type Result } from '@/core/errors'

import {
  CLASSIFY_OUTPUT_JSON_SCHEMA,
  SYSTEM_PROMPT,
  type ClassifyByLlmInput,
  type ClassifyByLlmSuccess,
  classifyToolOutputSchema,
} from './schema'

export const OPENAI_MODEL = 'gpt-5.4-nano' as const
export const OPENAI_MAX_OUTPUT_TOKENS = 256 as const
export const OPENAI_TIMEOUT_MS = 15_000 as const

type OpenAiResponsesUsage = {
  input_tokens?: number
  output_tokens?: number
}

type OpenAiResponsesBody = {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  usage?: OpenAiResponsesUsage
}

export async function classifyByOpenAi(
  input: ClassifyByLlmInput,
): Promise<Result<ClassifyByLlmSuccess, AppError>> {
  if (!env.OPENAI_API_KEY) {
    return err(errors.unauthorized())
  }

  const userMessage = `Subject: ${input.subject}\n\nBody (excerpt, <=500 chars): ${input.bodyExcerpt}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: SYSTEM_PROMPT,
        input: [{ role: 'user', content: userMessage }],
        max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: 'json_schema',
            name: 'classify_email',
            strict: true,
            schema: CLASSIFY_OUTPUT_JSON_SCHEMA,
          },
        },
      }),
    })
  } catch (cause) {
    clearTimeout(timeout)
    return err(errors.externalApi('llm', cause))
  }
  clearTimeout(timeout)

  if (!response.ok) {
    return err(mapOpenAiError(response.status))
  }

  let body: OpenAiResponsesBody
  try {
    body = await response.json() as OpenAiResponsesBody
  } catch (cause) {
    return err(errors.externalApi('llm', cause))
  }

  const outputText = extractOutputText(body)
  if (!outputText) {
    return err(errors.externalApi('llm', 'unstructured_response'))
  }

  let rawOutput: unknown
  try {
    rawOutput = JSON.parse(outputText)
  } catch {
    return err(errors.externalApi('llm', 'invalid_json_output'))
  }

  const parsed = classifyToolOutputSchema.safeParse(rawOutput)
  if (!parsed.success) {
    return err(errors.externalApi('llm', 'invalid_tool_output'))
  }

  return ok({
    label: parsed.data.label,
    confidence: parsed.data.confidence,
    classifiedBy: 'llm',
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
  })
}

function extractOutputText(body: OpenAiResponsesBody): string | null {
  if (typeof body.output_text === 'string') return body.output_text

  for (const item of body.output ?? []) {
    if (item.type !== 'message') continue
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }

  return null
}

function mapOpenAiError(status: number): AppError {
  if (status === 401 || status === 403) return errors.unauthorized()
  if (status === 429) return errors.rateLimited(60)
  return errors.externalApi('llm', `openai_http_${status}`)
}
