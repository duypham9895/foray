// Application slice — stage CRUD service.
//
// Three mutation functions, all atomic via withRls (one Postgres transaction
// each), all returning Result<T, AppError>:
//
//   addStage      — append-event semantics (Event(stage_added))
//   updateStage   — partial patch, NO event written (intentional, avoids
//                   timeline spam from inline edits — see CONTEXT §"Specifics"
//                   → "Inline stage edit" + threat-model T-02-03-07)
//   completeStage — sets completedAt + outcome, writes Event(stage_completed)
//
// Same throw-bridge pattern as service.ts (Plan 02-02): inside withRls we
// throw `Error('TAG:...')` to abort the transaction (Prisma rolls back); a
// small translator on the way out maps tagged Db errors to the intended
// AppError variant. The `translateBridge` helper here is a deliberate
// duplicate of `translateThrowBridge` in service.ts — Sandi Metz says extract
// only on the third caller. notes-service.ts is the second; if a fourth
// service file in this slice ever needs it, extract to a shared helper.

import 'server-only'
import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, StageId, UserId } from '@/core/types/ids'
import type { Stage, StageOutcome } from '@/generated/prisma/client'

import { eventDataSchemas, stageInputSchema, type StageInput } from './schema'

// ---------------------------------------------------------------------------
// addStage
// ---------------------------------------------------------------------------

export async function addStage(
  userId: UserId,
  applicationId: ApplicationId,
  rawInput: unknown,
): Promise<Result<{ stage: Stage }, AppError>> {
  const parsed = stageInputSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))
  const input = parsed.data

  const numericUserId = Number(userId)
  const numericAppId = Number(applicationId)

  const result = await withRls(userId, async (tx): Promise<{ stage: Stage }> => {
    // Pre-flight: verify parent application belongs to this tenant. RLS is
    // the suspenders; this is the belt that produces the cleaner NotFound
    // error (instead of a Prisma FK violation when we'd try to insert).
    const app = await tx.application.findUnique({
      where: { id: numericAppId },
      select: { id: true, userId: true },
    })
    if (!app || app.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    // Compute order = MAX(existing) + 1 inside the same tx. Race accepted
    // for Lean (single user, single tab; threat-model T-02-03-01).
    const maxRow = await tx.stage.findFirst({
      where: { applicationId: numericAppId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const nextOrder = (maxRow?.order ?? 0) + 1

    const stage = await tx.stage.create({
      data: {
        applicationId: numericAppId,
        name: input.name,
        order: nextOrder,
        scheduledAt: input.scheduledAt ?? null,
        completedAt: input.completedAt ?? null,
        outcome: input.outcome ?? null,
        notes: input.notes ? input.notes : null,
      },
    })

    const eventData = eventDataSchemas.stage_added.parse({
      stageId: stage.id,
      stageName: stage.name,
    })
    await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: numericAppId,
        type: 'stage_added',
        source: 'manual',
        data: eventData,
        undoable: false,
      },
    })

    await tx.application.update({
      where: { id: numericAppId },
      data: { lastActivityAt: new Date() },
    })

    return { stage }
  })

  return translateBridge(result)
}

// ---------------------------------------------------------------------------
// updateStage
// ---------------------------------------------------------------------------

export async function updateStage(
  userId: UserId,
  stageId: StageId,
  patch: Partial<StageInput>,
): Promise<Result<{ stage: Stage }, AppError>> {
  // Validate the patch via partial schema. Empty patch is allowed (no-op-ish
  // — still bumps lastActivityAt to reflect "user touched this row").
  const parsed = stageInputSchema.partial().safeParse(patch)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))
  const data = parsed.data

  const numericUserId = Number(userId)
  const numericStageId = Number(stageId)

  const result = await withRls(userId, async (tx): Promise<{ stage: Stage }> => {
    const existing = await tx.stage.findUnique({
      where: { id: numericStageId },
      select: {
        id: true,
        applicationId: true,
        application: { select: { userId: true } },
      },
    })
    if (!existing || existing.application.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Stage:${String(stageId)}`)
    }

    const stage = await tx.stage.update({
      where: { id: numericStageId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(data.outcome !== undefined ? { outcome: data.outcome } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ? data.notes : null } : {}),
      },
    })

    await tx.application.update({
      where: { id: existing.applicationId },
      data: { lastActivityAt: new Date() },
    })

    // Intentionally NO event written here. Partial inline edits would spam
    // the timeline; the audit trade-off is documented in T-02-03-07.
    return { stage }
  })

  return translateBridge(result)
}

// ---------------------------------------------------------------------------
// completeStage
// ---------------------------------------------------------------------------

export async function completeStage(
  userId: UserId,
  stageId: StageId,
  outcome: StageOutcome,
): Promise<Result<{ stage: Stage }, AppError>> {
  const numericUserId = Number(userId)
  const numericStageId = Number(stageId)

  const result = await withRls(userId, async (tx): Promise<{ stage: Stage }> => {
    const existing = await tx.stage.findUnique({
      where: { id: numericStageId },
      select: {
        id: true,
        applicationId: true,
        completedAt: true,
        application: { select: { userId: true } },
      },
    })
    if (!existing || existing.application.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Stage:${String(stageId)}`)
    }
    if (existing.completedAt) {
      throw new Error('CONFLICT:STAGE_ALREADY_COMPLETED')
    }

    const stage = await tx.stage.update({
      where: { id: numericStageId },
      data: { completedAt: new Date(), outcome },
    })

    const eventData = eventDataSchemas.stage_completed.parse({
      stageId: numericStageId,
      outcome,
    })
    await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: existing.applicationId,
        type: 'stage_completed',
        source: 'manual',
        data: eventData,
        undoable: false,
      },
    })

    await tx.application.update({
      where: { id: existing.applicationId },
      data: { lastActivityAt: new Date() },
    })

    return { stage }
  })

  return translateBridge(result)
}

// ---------------------------------------------------------------------------
// Throw-bridge translator (duplicate of service.ts:translateThrowBridge by
// design — see Sandi Metz note in module header).
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
  if (cause.message.startsWith('CONFLICT:')) {
    return err(errors.conflict(cause.message.split(':')[1] ?? 'CONFLICT'))
  }
  return result
}
