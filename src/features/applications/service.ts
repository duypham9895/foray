// Application slice — business logic.
//
// Four mutation functions, all atomic via withRls (one Postgres transaction
// each), all returning Result<T, AppError>:
//
//   createApplication        — CAPT-03 contract (1 Application + 1 Event(created))
//   applyManualStatusChange  — APP-03 contract (status dropdown)
//   applyAutoStatusChange    — Phase 4 contract (with status-regression block)
//   undoStatusChange         — Phase 4 contract (restores status, marks email reviewed)
//
// All Event.data writes go through eventDataSchemas[type].parse() so the
// Phase 4 strict() shape (including emailId on auto_status_changed) is the
// single source of truth.
//
// Throw-bridge pattern: inside withRls we throw `Error('TAG:...')` to abort
// the transaction (Prisma rolls back). On the way out, we string-parse the
// caught Db error message and translate to errors.notFound / errors.conflict.
// See PRINCIPLES.md §"Error handling — Result<T, AppError>" + this plan's
// threat-model entry T-02-02-09 for the small known prefix-collision risk.

import 'server-only'
import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, EventId, UserId } from '@/core/types/ids'
import type {
  CanonicalStatus,
  ClassifiedBy,
  Event,
  EventSource,
} from '@/generated/prisma/client'

import {
  createApplicationSchema,
  eventDataSchemas,
} from './schema'
import { isStatusRegression } from './status-transitions'

export type AutoStatusChange = {
  newStatus: CanonicalStatus
  source: EventSource
  emailId?: number
  classifierConfidence?: number
  classifiedBy?: ClassifiedBy
}

// ---------------------------------------------------------------------------
// createApplication
// ---------------------------------------------------------------------------

export async function createApplication(
  userId: UserId,
  rawInput: unknown,
): Promise<Result<{ applicationId: ApplicationId; eventId: EventId }, AppError>> {
  const parsed = createApplicationSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))
  const input = parsed.data

  const result = await withRls(userId, async (tx) => {
    const numericUserId = Number(userId)
    const trimmedName = input.companyName.trim()

    // 1. Find or create Company by (userId, name) — case-insensitive.
    let company = await tx.company.findFirst({
      where: { userId: numericUserId, name: { equals: trimmedName, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!company) {
      company = await tx.company.create({
        data: {
          userId: numericUserId,
          name: trimmedName,
          domain: input.companyDomain ? input.companyDomain : null,
        },
        select: { id: true },
      })
    }

    // 2. Insert Application row.
    const application = await tx.application.create({
      data: {
        userId: numericUserId,
        companyId: company.id,
        roleTitle: input.roleTitle,
        roleUrl: input.roleUrl ? input.roleUrl : null,
        jobDescription: input.jobDescription ? input.jobDescription : null,
        location: input.location ? input.location : null,
        salaryMin: input.salaryMin ?? null,
        salaryMax: input.salaryMax ?? null,
        salaryCurrency: input.salaryCurrency ? input.salaryCurrency : null,
        source: input.source,
        appliedAt: input.appliedAt,
        lastActivityAt: input.appliedAt,
        notes: input.notes ? input.notes : null,
      },
      select: { id: true },
    })

    // 3. Insert created Event.
    const eventData = eventDataSchemas.created.parse({ source: 'manual' })
    const event = await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: application.id,
        type: 'created',
        source: 'manual',
        data: eventData,
        undoable: false,
      },
      select: { id: true },
    })

    return {
      applicationId: String(application.id) as ApplicationId,
      eventId: String(event.id) as EventId,
    }
  })

  return result
}

// ---------------------------------------------------------------------------
// applyManualStatusChange
// ---------------------------------------------------------------------------

export async function applyManualStatusChange(
  userId: UserId,
  applicationId: ApplicationId,
  newStatus: CanonicalStatus,
): Promise<Result<{ event: Event | null }, AppError>> {
  const numericUserId = Number(userId)
  const numericAppId = Number(applicationId)

  const result = await withRls(userId, async (tx): Promise<{ event: Event | null }> => {
    const app = await tx.application.findUnique({
      where: { id: numericAppId },
      select: { canonicalStatus: true, userId: true },
    })
    if (!app || app.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }
    if (app.canonicalStatus === newStatus) {
      return { event: null }
    }
    const previousStatus = app.canonicalStatus
    await tx.application.update({
      where: { id: numericAppId },
      data: { canonicalStatus: newStatus, lastActivityAt: new Date() },
    })
    const eventData = eventDataSchemas.status_changed.parse({ previousStatus, newStatus })
    const event = await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: numericAppId,
        type: 'status_changed',
        source: 'manual',
        data: eventData,
        undoable: false,
      },
    })
    return { event }
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// applyAutoStatusChange
// ---------------------------------------------------------------------------

export async function applyAutoStatusChange(
  userId: UserId,
  applicationId: ApplicationId,
  change: AutoStatusChange,
): Promise<Result<{ event: Event | null }, AppError>> {
  const numericUserId = Number(userId)
  const numericAppId = Number(applicationId)

  const result = await withRls(userId, async (tx): Promise<{ event: Event | null }> => {
    const app = await tx.application.findUnique({
      where: { id: numericAppId },
      select: { canonicalStatus: true, userId: true },
    })
    if (!app || app.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }
    if (app.canonicalStatus === change.newStatus) {
      return { event: null }
    }
    if (isStatusRegression(app.canonicalStatus, change.newStatus)) {
      throw new Error('CONFLICT:STATUS_REGRESSION_REQUIRES_REVIEW')
    }
    const previousStatus = app.canonicalStatus
    await tx.application.update({
      where: { id: numericAppId },
      data: { canonicalStatus: change.newStatus, lastActivityAt: new Date() },
    })
    // Build the full input BEFORE parse — emailId is part of the strict()
    // schema in Plan 02-01, so spreading it after parse would defeat the
    // contract (the schema rejects unknown keys on a re-validate).
    const eventDataInput: Record<string, unknown> = {
      previousStatus,
      newStatus: change.newStatus,
    }
    if (change.classifierConfidence !== undefined) {
      eventDataInput.classifierConfidence = change.classifierConfidence
    }
    if (change.classifiedBy !== undefined) {
      eventDataInput.classifiedBy = change.classifiedBy
    }
    if (change.emailId !== undefined) {
      eventDataInput.emailId = change.emailId
    }
    const eventData = eventDataSchemas.auto_status_changed.parse(eventDataInput)
    const event = await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: numericAppId,
        type: 'auto_status_changed',
        source: change.source,
        data: eventData,
        undoable: true,
      },
    })
    return { event }
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// undoStatusChange
// ---------------------------------------------------------------------------

export async function undoStatusChange(
  userId: UserId,
  eventId: EventId,
): Promise<Result<{ event: Event }, AppError>> {
  const numericUserId = Number(userId)
  const numericEventId = Number(eventId)

  const result = await withRls(userId, async (tx): Promise<{ event: Event }> => {
    const original = await tx.event.findUnique({
      where: { id: numericEventId },
      select: {
        id: true,
        userId: true,
        type: true,
        undoneAt: true,
        applicationId: true,
        data: true,
      },
    })
    if (!original || original.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Event:${String(eventId)}`)
    }
    if (original.type !== 'auto_status_changed') {
      throw new Error('CONFLICT:EVENT_NOT_UNDOABLE')
    }
    if (original.undoneAt) {
      throw new Error('CONFLICT:EVENT_ALREADY_UNDONE')
    }
    const dataParsed = eventDataSchemas.auto_status_changed.safeParse(original.data)
    if (!dataParsed.success) {
      throw new Error('CONFLICT:EVENT_DATA_MALFORMED')
    }
    const previousStatus = dataParsed.data.previousStatus
    const linkedEmailId = dataParsed.data.emailId
    if (!original.applicationId) {
      throw new Error('CONFLICT:EVENT_HAS_NO_APPLICATION')
    }

    // Restore status.
    await tx.application.update({
      where: { id: original.applicationId },
      data: { canonicalStatus: previousStatus, lastActivityAt: new Date() },
    })
    // Mark original event undone.
    await tx.event.update({
      where: { id: numericEventId },
      data: { undoneAt: new Date() },
    })
    // Mark linked email reviewed (Phase 4 idempotency hook).
    if (typeof linkedEmailId === 'number') {
      await tx.email.update({
        where: { id: linkedEmailId },
        data: { reviewedByUser: true },
      })
    }
    // Write status_undone event (audit trail; ADR-0006 — original is preserved).
    const undoneData = eventDataSchemas.status_undone.parse({
      undoneEventId: numericEventId,
      restoredStatus: previousStatus,
    })
    const event = await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: original.applicationId,
        type: 'status_undone',
        source: 'manual',
        data: undoneData,
        undoable: false,
      },
    })
    return { event }
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// Throw-bridge translator
// ---------------------------------------------------------------------------
//
// Inside a withRls transaction we use `throw new Error('TAG:...')` to abort
// (Postgres rolls back via Prisma's $transaction). withRls's fromPromise
// wraps the throw as errors.db(cause). Translate known prefixes back to the
// intended AppError variant.

function translateThrowBridge<T>(result: Result<T, AppError>): Result<T, AppError> {
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
