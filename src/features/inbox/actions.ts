'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { logger } from '@/core/logger'
import { UserId } from '@/core/types/ids'

import { pollOnce } from './service'

export async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await pollOnce(userId)

  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.syncNow' })
    return { ok: false, error: 'Sync failed — check logs' }
  }

  revalidatePath('/settings')
  return { ok: true }
}

export async function disconnectGmail(): Promise<{
  ok: boolean
  error?: string
}> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)

  await tenantDb(userId).user.update({
    where: { id: Number(userId) },
    data: {
      gmailRefreshTokenEncrypted: null,
      gmailLastSyncAt: null,
      gmailHistoryId: null,
    },
  })

  logger.info({ op: 'actions.disconnectGmail', userId })
  revalidatePath('/settings')
  return { ok: true }
}
