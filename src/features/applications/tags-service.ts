// Application tags slice — service layer.
//
// Tag CRUD + aggregation, all tenant-scoped via withRls. Follows the same
// Result<T, AppError> pattern as the main application service.

import 'server-only'
import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, UserId } from '@/core/types/ids'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TagWithCount = {
  tag: string
  count: number
}

// ---------------------------------------------------------------------------
// findAllTags — all distinct tags with usage counts for the user
// ---------------------------------------------------------------------------

export async function findAllTags(
  userId: UserId,
): Promise<Result<TagWithCount[], AppError>> {
  return withRls(userId, async (tx) => {
    const apps = await tx.application.findMany({
      where: { userId: Number(userId), archivedAt: null },
      select: { tags: true },
    })

    const counts = new Map<string, number>()
    for (const app of apps) {
      for (const tag of app.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  })
}

// ---------------------------------------------------------------------------
// addTag — add a single tag to an application (idempotent)
// ---------------------------------------------------------------------------

export async function addTag(
  userId: UserId,
  applicationId: ApplicationId,
  tag: string,
): Promise<Result<{ tags: string[] }, AppError>> {
  const cleaned = tag.toLowerCase().trim()
  if (!cleaned) return err(errors.validation([{ code: 'custom', path: ['tag'], message: 'Tag cannot be empty' }]))

  const result = await withRls(userId, async (tx) => {
    const appId = Number(applicationId)
    const app = await tx.application.findUnique({
      where: { id: appId },
      select: { id: true, userId: true, tags: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    if (app.tags.includes(cleaned)) {
      return { tags: app.tags }
    }

    const updated = await tx.application.update({
      where: { id: appId },
      data: {
        tags: { set: [...app.tags, cleaned] },
        lastActivityAt: new Date(),
      },
      select: { tags: true },
    })

    return { tags: updated.tags }
  })

  return translateBridge(result)
}

// ---------------------------------------------------------------------------
// removeTag — remove a single tag from an application
// ---------------------------------------------------------------------------

export async function removeTag(
  userId: UserId,
  applicationId: ApplicationId,
  tag: string,
): Promise<Result<{ tags: string[] }, AppError>> {
  const cleaned = tag.toLowerCase().trim()

  const result = await withRls(userId, async (tx) => {
    const appId = Number(applicationId)
    const app = await tx.application.findUnique({
      where: { id: appId },
      select: { id: true, userId: true, tags: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    const filtered = app.tags.filter((t) => t !== cleaned)
    if (filtered.length === app.tags.length) {
      return { tags: app.tags }
    }

    const updated = await tx.application.update({
      where: { id: appId },
      data: { tags: { set: filtered } },
      select: { tags: true },
    })

    return { tags: updated.tags }
  })

  return translateBridge(result)
}

// ---------------------------------------------------------------------------
// findApplicationsByTag — filtered list query
// ---------------------------------------------------------------------------

import type { ApplicationListItem } from './queries'

export async function findApplicationsByTag(
  userId: UserId,
  tag: string,
): Promise<Result<ApplicationListItem[], AppError>> {
  const cleaned = tag.toLowerCase().trim()
  if (!cleaned) return err(errors.validation([{ code: 'custom', path: ['tag'], message: 'Tag filter required' }]))

  return withRls(userId, async (tx) => {
    const rows = await tx.application.findMany({
      where: {
        userId: Number(userId),
        archivedAt: null,
        tags: { has: cleaned },
      },
      orderBy: { lastActivityAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    })

    return rows.map<ApplicationListItem>((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company.name,
      roleTitle: r.roleTitle,
      canonicalStatus: r.canonicalStatus,
      currentStage: r.currentStage,
      lastActivityAt: r.lastActivityAt,
      appliedAt: r.appliedAt,
      archivedAt: r.archivedAt,
    }))
  })
}

// ---------------------------------------------------------------------------
// Throw-bridge translator (same pattern as stages-service.ts:translateBridge).
// Maps tagged Db errors to the intended AppError variant.
// ---------------------------------------------------------------------------

function translateBridge<T>(result: Result<T, AppError>): Result<T, AppError> {
  if (!result.isErr()) return result
  if (result.error._tag !== 'Db') return result
  const cause = result.error.cause
  if (!(cause instanceof Error)) return result

  if (cause.message.startsWith('NOT_FOUND:')) {
    const [, resource, id] = cause.message.split(':')
    return err(errors.notFound(resource ?? 'Unknown', id ?? ''))
  }
  return result
}
