'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/core/auth/session'
import { withRls } from '@/core/db/with-rls'
import { logger } from '@/core/logger'
import { UserId } from '@/core/types/ids'

import { syncCalendarEvents } from './service'

export async function syncCalendarNow(): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await syncCalendarEvents(userId)
  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.syncCalendarNow' })
    return { ok: false, error: 'Calendar sync failed - check logs' }
  }

  revalidatePath('/settings')
  revalidatePath('/today')
  return { ok: true }
}

export async function disconnectCalendar(): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await withRls(userId, async (tx) => {
    await tx.calendarEvent.deleteMany({ where: { userId: Number(userId) } })
    await tx.user.update({
      where: { id: Number(userId) },
      data: {
        calendarRefreshTokenEncrypted: null,
        calendarLastSyncAt: null,
      },
    })
  })

  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.disconnectCalendar' })
    return { ok: false, error: 'Failed to disconnect calendar' }
  }

  logger.info({ op: 'actions.disconnectCalendar', userId })
  revalidatePath('/settings')
  revalidatePath('/today')
  return { ok: true }
}
