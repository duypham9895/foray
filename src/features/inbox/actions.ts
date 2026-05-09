'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/core/auth/session'
import { withRls } from '@/core/db/with-rls'
import { tenantDb } from '@/core/db/tenant'
import { logger } from '@/core/logger'
import { UserId } from '@/core/types/ids'
import type { EmailClassification } from '@/generated/prisma/client'

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

// ---------------------------------------------------------------------------
// Review actions — per-row operations in the /inbox review queue.
// All four follow the requireUser + withRls transaction pattern.
// ---------------------------------------------------------------------------

export async function confirmClassification(
  emailId: number,
): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: {
        reviewedByUser: true,
        processingStatus: 'acted',
      },
    })
  })

  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.confirmClassification', emailId })
    return { ok: false, error: 'Failed to confirm classification' }
  }

  logger.info({ op: 'actions.confirmClassification', emailId })
  revalidatePath('/inbox')
  return { ok: true }
}

export async function overrideClassification(
  emailId: number,
  newClassification: EmailClassification,
): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: {
        classification: newClassification,
        reviewedByUser: true,
        processingStatus: 'acted',
      },
    })
  })

  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.overrideClassification', emailId })
    return { ok: false, error: 'Failed to override classification' }
  }

  logger.info({ op: 'actions.overrideClassification', emailId, newClassification })
  revalidatePath('/inbox')
  return { ok: true }
}

export async function linkToApplication(
  emailId: number,
  applicationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: {
        applicationId,
        reviewedByUser: true,
        processingStatus: 'acted',
      },
    })
  })

  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.linkToApplication', emailId })
    return { ok: false, error: 'Failed to link to application' }
  }

  logger.info({ op: 'actions.linkToApplication', emailId, applicationId })
  revalidatePath('/inbox')
  return { ok: true }
}

export async function ignoreEmail(
  emailId: number,
): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)
  const result = await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: {
        reviewedByUser: true,
        processingStatus: 'acted',
      },
    })
  })

  if (result.isErr()) {
    logger.error({ err: result.error, op: 'actions.ignoreEmail', emailId })
    return { ok: false, error: 'Failed to ignore email' }
  }

  logger.info({ op: 'actions.ignoreEmail', emailId })
  revalidatePath('/inbox')
  return { ok: true }
}
