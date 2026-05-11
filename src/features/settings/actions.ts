'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  generateApiToken,
  hashToken,
  revokeApiToken,
  storeApiTokenHash,
} from '@/core/auth/api-token'
import { requireUser } from '@/core/auth/session'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

const llmProviderSchema = z.enum(['anthropic', 'openai'])

export type ExtensionTokenState =
  | { ok: true; token: string | null; hasToken: boolean }
  | { ok: false; token: null; hasToken: boolean; formError: string }

export async function generateExtensionTokenAction(
  _prev: ExtensionTokenState,
): Promise<ExtensionTokenState> {
  void _prev

  const userResult = await requireUser()
  if (userResult.isErr()) {
    return {
      ok: false,
      token: null,
      hasToken: false,
      formError: 'Unauthorized. Please sign in again.',
    }
  }

  const token = generateApiToken()
  await storeApiTokenHash(userResult.value.id, await hashToken(token))
  revalidatePath('/settings')

  return { ok: true, token, hasToken: true }
}

export async function revokeExtensionTokenAction(
  _prev: ExtensionTokenState,
): Promise<ExtensionTokenState> {
  void _prev

  const userResult = await requireUser()
  if (userResult.isErr()) {
    return {
      ok: false,
      token: null,
      hasToken: true,
      formError: 'Unauthorized. Please sign in again.',
    }
  }

  await revokeApiToken(userResult.value.id)
  revalidatePath('/settings')

  return { ok: true, token: null, hasToken: false }
}

export type LlmProviderState =
  | { ok: true; provider: 'anthropic' | 'openai'; formError?: undefined }
  | { ok: false; provider: 'anthropic' | 'openai'; formError: string }

export async function updateLlmProviderAction(
  _prev: LlmProviderState,
  formData: FormData,
): Promise<LlmProviderState> {
  const previousProvider = _prev.provider
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return {
      ok: false,
      provider: previousProvider,
      formError: 'Unauthorized. Please sign in again.',
    }
  }

  const parsed = llmProviderSchema.safeParse(formData.get('provider'))
  if (!parsed.success) {
    return {
      ok: false,
      provider: previousProvider,
      formError: 'Choose a supported provider.',
    }
  }

  const userId = UserId(userResult.value.id)
  const result = await withRls(userId, async (tx) => {
    await tx.user.update({
      where: { id: Number(userId) },
      data: { classifierLlmProvider: parsed.data },
    })
  })

  if (result.isErr()) {
    return {
      ok: false,
      provider: previousProvider,
      formError: 'Could not update provider.',
    }
  }

  revalidatePath('/settings')
  return { ok: true, provider: parsed.data }
}
