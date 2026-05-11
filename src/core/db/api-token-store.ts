import 'server-only'

import { UserId, type UserId as UserIdType } from '@/core/types/ids'

import { withRls } from './with-rls'

const SEEDED_OWNER_USER_ID = UserId(1)

export async function getExtensionApiTokenHash(
  userId: UserIdType,
): Promise<string | null> {
  const result = await withRls(userId, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: Number(userId) },
      select: { extensionApiTokenHash: true },
    })
    return user?.extensionApiTokenHash ?? null
  })
  if (result.isErr()) throw new Error('Failed to read extension API token hash')
  return result.value
}

export async function updateExtensionApiTokenHash(
  userId: UserIdType,
  hash: string | null,
): Promise<void> {
  const result = await withRls(userId, async (tx) => {
    await tx.user.update({
      where: { id: Number(userId) },
      data: { extensionApiTokenHash: hash },
    })
  })
  if (result.isErr()) throw new Error('Failed to update extension API token hash')
}

export async function listUsersWithExtensionApiTokenHashes(): Promise<
  Array<{ id: UserIdType; extensionApiTokenHash: string }>
> {
  const result = await withRls(SEEDED_OWNER_USER_ID, async (tx) => {
    const users = await tx.user.findMany({
      where: { extensionApiTokenHash: { not: null } },
      select: { id: true, extensionApiTokenHash: true },
    })
    return users.map((user) => ({
      id: UserId(user.id),
      extensionApiTokenHash: user.extensionApiTokenHash ?? '',
    }))
  })
  if (result.isErr()) throw new Error('Failed to list extension API token hashes')
  return result.value.filter((user) => user.extensionApiTokenHash)
}
