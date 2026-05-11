import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok } from 'neverthrow'

vi.mock('./llm', () => ({
  MODEL: 'claude-haiku-4-5-20251001',
  classifyByLlm: vi.fn(),
}))

vi.mock('./openai', () => ({
  OPENAI_MODEL: 'gpt-5.4-nano',
  classifyByOpenAi: vi.fn(),
}))

import { classifyByLlm } from './llm'
import { classifyByOpenAi } from './openai'
import { classifyBySelectedLlm, getModelForProvider } from './providers'

const mockedAnthropic = vi.mocked(classifyByLlm)
const mockedOpenAi = vi.mocked(classifyByOpenAi)

beforeEach(() => {
  mockedAnthropic.mockReset()
  mockedOpenAi.mockReset()
})

describe('getModelForProvider', () => {
  it('returns the concrete Anthropic model for anthropic', () => {
    expect(getModelForProvider('anthropic')).toBe('claude-haiku-4-5-20251001')
  })

  it('returns the concrete OpenAI model for openai', () => {
    expect(getModelForProvider('openai')).toBe('gpt-5.4-nano')
  })
})

describe('classifyBySelectedLlm', () => {
  const input = { subject: 'Update', bodyExcerpt: 'Thanks for applying.' }

  it('routes anthropic to the Anthropic adapter', async () => {
    mockedAnthropic.mockResolvedValue(
      ok({
        label: 'rejection',
        confidence: 0.9,
        classifiedBy: 'llm',
        inputTokens: 10,
        outputTokens: 5,
      }),
    )

    const result = await classifyBySelectedLlm(input, 'anthropic')

    expect(result.isOk()).toBe(true)
    expect(mockedAnthropic).toHaveBeenCalledWith(input)
    expect(mockedOpenAi).not.toHaveBeenCalled()
  })

  it('routes openai to the OpenAI adapter', async () => {
    mockedOpenAi.mockResolvedValue(
      ok({
        label: 'interview_invite',
        confidence: 0.88,
        classifiedBy: 'llm',
        inputTokens: 12,
        outputTokens: 6,
      }),
    )

    const result = await classifyBySelectedLlm(input, 'openai')

    expect(result.isOk()).toBe(true)
    expect(mockedOpenAi).toHaveBeenCalledWith(input)
    expect(mockedAnthropic).not.toHaveBeenCalled()
  })
})
