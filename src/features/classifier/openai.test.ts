import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/core/env'

import { classifyByOpenAi, OPENAI_MODEL } from './openai'

const ORIGINAL_OPENAI_API_KEY = env.OPENAI_API_KEY

function responseJson(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

beforeEach(() => {
  env.OPENAI_API_KEY = 'sk-openai-test-fixture-key-not-real'
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY
  vi.unstubAllGlobals()
})

describe('classifyByOpenAi', () => {
  it('calls Responses API with strict JSON schema output and parses output_text', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      responseJson({
        output_text: JSON.stringify({
          label: 'rejection',
          confidence: 0.91,
          reasoning: 'Explicit rejection language.',
        }),
        usage: { input_tokens: 42, output_tokens: 8 },
      }),
    )

    const result = await classifyByOpenAi({
      subject: 'Application update',
      bodyExcerpt: 'We will not be moving forward.',
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toEqual({
        label: 'rejection',
        confidence: 0.91,
        classifiedBy: 'llm',
        inputTokens: 42,
        outputTokens: 8,
      })
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer sk-openai-test-fixture-key-not-real',
      'Content-Type': 'application/json',
    })

    const body = JSON.parse(String(init?.body)) as {
      model: string
      text: { format: { type: string; name: string; strict: boolean } }
    }
    expect(body.model).toBe(OPENAI_MODEL)
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      name: 'classify_email',
      strict: true,
    })
  })

  it('parses output array fallback when output_text is not present', async () => {
    vi.mocked(fetch).mockResolvedValue(
      responseJson({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  label: 'interview_invite',
                  confidence: 0.86,
                  reasoning: 'Scheduling request.',
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 20, output_tokens: 7 },
      }),
    )

    const result = await classifyByOpenAi({ subject: 'Interview', bodyExcerpt: 'Can you meet tomorrow?' })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.label).toBe('interview_invite')
      expect(result.value.inputTokens).toBe(20)
      expect(result.value.outputTokens).toBe(7)
    }
  })

  it('returns ExternalApi when the model returns invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(responseJson({ output_text: 'not-json' }))

    const result = await classifyByOpenAi({ subject: 'Update', bodyExcerpt: 'Body' })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        _tag: 'ExternalApi',
        service: 'llm',
        cause: 'invalid_json_output',
      })
    }
  })

  it('maps HTTP 429 to RateLimited', async () => {
    vi.mocked(fetch).mockResolvedValue(responseJson({ error: 'too many requests' }, 429))

    const result = await classifyByOpenAi({ subject: 'Update', bodyExcerpt: 'Body' })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: 'RateLimited', retryAfterSeconds: 60 })
    }
  })

  it('returns Unauthorized when OPENAI_API_KEY is not configured', async () => {
    env.OPENAI_API_KEY = undefined

    const result = await classifyByOpenAi({ subject: 'Update', bodyExcerpt: 'Body' })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Unauthorized')
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})
