import { beforeEach, describe, expect, it, vi } from 'vitest'

const tokenHashes = new Map<number, string | null>()

vi.mock('@/core/db/api-token-store', () => ({
  getExtensionApiTokenHash: vi.fn(async (userId: string) => (
    tokenHashes.get(Number(userId)) ?? null
  )),
  updateExtensionApiTokenHash: vi.fn(async (userId: string, hash: string | null) => {
    tokenHashes.set(Number(userId), hash)
  }),
  listUsersWithExtensionApiTokenHashes: vi.fn(async () => (
    Array.from(tokenHashes.entries())
      .filter((entry): entry is [number, string] => entry[1] !== null)
      .map(([id, extensionApiTokenHash]) => ({ id, extensionApiTokenHash }))
  )),
}))

import {
  findUserByApiToken,
  generateApiToken,
  hashToken,
  revokeApiToken,
  storeApiTokenHash,
  verifyApiToken,
} from './api-token'
import { UserId } from '@/core/types/ids'

describe('api token helpers', () => {
  beforeEach(() => {
    tokenHashes.clear()
  })

  it('generates a 64-character hex token', () => {
    const token = generateApiToken()

    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes a token with a random salt', async () => {
    const first = await hashToken('secret-token')
    const second = await hashToken('secret-token')

    expect(first).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/)
    expect(second).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/)
    expect(first).not.toBe(second)
  })

  it('verifies the correct token and rejects the wrong token', async () => {
    const userId = UserId(1)
    const token = generateApiToken()
    await storeApiTokenHash(userId, await hashToken(token))

    await expect(verifyApiToken(userId, token)).resolves.toBe(true)
    await expect(verifyApiToken(userId, 'wrong-token')).resolves.toBe(false)
  })

  it('returns false when the user has no stored token', async () => {
    await expect(verifyApiToken(UserId(404), generateApiToken())).resolves.toBe(false)
  })

  it('finds the user that owns a valid token', async () => {
    const token = generateApiToken()
    await storeApiTokenHash(UserId(2), await hashToken(token))

    await expect(findUserByApiToken(token)).resolves.toEqual({ id: UserId(2) })
  })

  it('revokes the stored token hash', async () => {
    const userId = UserId(1)
    const token = generateApiToken()
    await storeApiTokenHash(userId, await hashToken(token))

    await revokeApiToken(userId)

    await expect(verifyApiToken(userId, token)).resolves.toBe(false)
  })
})
