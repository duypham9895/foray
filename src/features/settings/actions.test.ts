import { beforeEach, describe, expect, it, vi } from 'vitest'
import { err, ok } from 'neverthrow'

import { errors } from '@/core/errors'

const { mockRevalidatePath, mockRequireUser, mockWithRls, mockUserUpdate } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockRequireUser: vi.fn(),
  mockWithRls: vi.fn(),
  mockUserUpdate: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/core/auth/session', () => ({
  requireUser: mockRequireUser,
}))

vi.mock('@/core/auth/api-token', () => ({
  generateApiToken: vi.fn(() => 'token'),
  hashToken: vi.fn(async () => 'hash'),
  revokeApiToken: vi.fn(),
  storeApiTokenHash: vi.fn(),
}))

vi.mock('@/core/db/with-rls', () => ({
  withRls: mockWithRls,
}))

import { updateLlmProviderAction, type LlmProviderState } from './actions'

const initialState: LlmProviderState = { ok: true, provider: 'anthropic' }

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireUser.mockResolvedValue(ok({ id: '1' }))
  mockUserUpdate.mockResolvedValue({ id: 1, classifierLlmProvider: 'openai' })
  mockWithRls.mockImplementation(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) =>
    ok(await fn({ user: { update: mockUserUpdate } })),
  )
})

describe('updateLlmProviderAction', () => {
  it('updates the user classifier provider inside RLS and revalidates settings', async () => {
    const formData = new FormData()
    formData.set('provider', 'openai')

    const result = await updateLlmProviderAction(initialState, formData)

    expect(result).toEqual({ ok: true, provider: 'openai' })
    expect(mockWithRls).toHaveBeenCalledTimes(1)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { classifierLlmProvider: 'openai' },
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('rejects unsupported provider values without touching the database', async () => {
    const formData = new FormData()
    formData.set('provider', 'local')

    const result = await updateLlmProviderAction(initialState, formData)

    expect(result).toEqual({
      ok: false,
      provider: 'anthropic',
      formError: 'Choose a supported provider.',
    })
    expect(mockWithRls).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns unauthorized when there is no signed-in user', async () => {
    mockRequireUser.mockResolvedValue(err(errors.unauthorized()))
    const formData = new FormData()
    formData.set('provider', 'openai')

    const result = await updateLlmProviderAction(initialState, formData)

    expect(result).toEqual({
      ok: false,
      provider: 'anthropic',
      formError: 'Unauthorized. Please sign in again.',
    })
    expect(mockWithRls).not.toHaveBeenCalled()
  })

  it('keeps the previous provider when the database update fails', async () => {
    mockWithRls.mockResolvedValue(err(errors.db(new Error('write failed'))))
    const formData = new FormData()
    formData.set('provider', 'openai')

    const result = await updateLlmProviderAction(initialState, formData)

    expect(result).toEqual({
      ok: false,
      provider: 'anthropic',
      formError: 'Could not update provider.',
    })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
