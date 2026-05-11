import 'server-only'

import type { Result } from 'neverthrow'

import { env } from '@/core/env'
import type { AppError } from '@/core/errors'
import type { LlmProvider } from '@/generated/prisma/client'

import { classifyByLlm, MODEL as ANTHROPIC_MODEL } from './llm'
import { classifyByOpenAi, OPENAI_MODEL } from './openai'
import type { ClassifyByLlmInput, ClassifyByLlmSuccess } from './schema'

export const DEFAULT_LLM_PROVIDER: LlmProvider = env.CLASSIFIER_LLM_PROVIDER

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
}

export function getModelForProvider(provider: LlmProvider): string {
  switch (provider) {
    case 'anthropic':
      return ANTHROPIC_MODEL
    case 'openai':
      return OPENAI_MODEL
  }
}

export async function classifyBySelectedLlm(
  input: ClassifyByLlmInput,
  provider: LlmProvider = DEFAULT_LLM_PROVIDER,
): Promise<Result<ClassifyByLlmSuccess, AppError>> {
  switch (provider) {
    case 'anthropic':
      return classifyByLlm(input)
    case 'openai':
      return classifyByOpenAi(input)
  }
}
