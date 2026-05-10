// Application slice — follow-up service.
//
// Two mutation functions for managing follow-up dates on forays:
//   - setFollowUp(userId, applicationId, date) → sets followUpAt
//   - clearFollowUp(userId, applicationId)      → sets followUpAt to null
//
// Both check application ownership before updating (cross-tenant safety).
// Uses withRls for tenant-scoped transactions.
//
// Same throw-bridge pattern as notes-service.ts: ownership check throws
// a sentinel Error inside the callback; the translator at the bottom
// converts it to errors.notFound() in the outer Result.

import 'server-only'

import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, UserId } from '@/core/types/ids'

export async function setFollowUp(
  userId: UserId,
  applicationId: ApplicationId,
  followUpAt: Date,
): Promise<Result<{ id: number; followUpAt: Date }, AppError>> {
  const result = await withRls(userId, async (tx) => {
    const appId = Number(applicationId)
    const app = await tx.application.findUnique({
      where: { id: appId },
      select: { id: true, userId: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    const updated = await tx.application.update({
      where: { id: appId },
      data: { followUpAt },
      select: { id: true, followUpAt: true },
    })
    if (!updated.followUpAt) {
      throw new Error('followUpAt was not set')
    }
    return { id: updated.id, followUpAt: updated.followUpAt }
  })

  if (result.isErr() && result.error._tag === 'Db') {
    const cause = result.error.cause
    if (cause instanceof Error && cause.message.startsWith('NOT_FOUND:')) {
      const [, resource, id] = cause.message.split(':')
      return err(errors.notFound(resource ?? 'Unknown', id ?? ''))
    }
  }
  return result
}

export async function clearFollowUp(
  userId: UserId,
  applicationId: ApplicationId,
): Promise<Result<{ id: number }, AppError>> {
  const result = await withRls(userId, async (tx) => {
    const appId = Number(applicationId)
    const app = await tx.application.findUnique({
      where: { id: appId },
      select: { id: true, userId: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    await tx.application.update({
      where: { id: appId },
      data: { followUpAt: null },
    })
    return { id: appId }
  })

  if (result.isErr() && result.error._tag === 'Db') {
    const cause = result.error.cause
    if (cause instanceof Error && cause.message.startsWith('NOT_FOUND:')) {
      const [, resource, id] = cause.message.split(':')
      return err(errors.notFound(resource ?? 'Unknown', id ?? ''))
    }
  }
  return result
}
