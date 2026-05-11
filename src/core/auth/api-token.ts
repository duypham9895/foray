import 'server-only'

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import {
  getExtensionApiTokenHash,
  listUsersWithExtensionApiTokenHashes,
  updateExtensionApiTokenHash,
} from '@/core/db/api-token-store'
import { UserId, type UserId as UserIdType } from '@/core/types/ids'

const scrypt = promisify(scryptCallback)
const TOKEN_BYTES = 32
const SALT_BYTES = 16
const KEY_BYTES = 64
const HASH_PREFIX = 'scrypt'

export function generateApiToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

export async function hashToken(token: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const key = (await scrypt(token, salt, KEY_BYTES)) as Buffer
  return `${HASH_PREFIX}:${salt}:${key.toString('hex')}`
}

async function verifyTokenHash(token: string, storedHash: string): Promise<boolean> {
  const [prefix, salt, expectedHex] = storedHash.split(':')
  if (prefix !== HASH_PREFIX || !salt || !expectedHex) return false

  const expected = Buffer.from(expectedHex, 'hex')
  if (expected.length !== KEY_BYTES) return false

  const actual = (await scrypt(token, salt, KEY_BYTES)) as Buffer
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function verifyApiToken(
  userId: UserIdType,
  token: string,
): Promise<boolean> {
  const storedHash = await getExtensionApiTokenHash(userId)
  if (!storedHash) return false
  return verifyTokenHash(token, storedHash)
}

export async function findUserByApiToken(
  token: string,
): Promise<{ id: UserIdType } | null> {
  if (!token.trim()) return null

  const users = await listUsersWithExtensionApiTokenHashes()
  for (const user of users) {
    if (await verifyTokenHash(token, user.extensionApiTokenHash)) {
      return { id: UserId(user.id) }
    }
  }
  return null
}

export async function storeApiTokenHash(
  userId: UserIdType,
  hash: string,
): Promise<void> {
  await updateExtensionApiTokenHash(userId, hash)
}

export async function revokeApiToken(userId: UserIdType): Promise<void> {
  await updateExtensionApiTokenHash(userId, null)
}
