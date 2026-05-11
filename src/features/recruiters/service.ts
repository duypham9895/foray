import 'server-only'

import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, RecruiterId, UserId } from '@/core/types/ids'
import type { Recruiter } from '@/generated/prisma/client'

import {
  linkRecruiterInputSchema,
  recruiterInputSchema,
  type LinkRecruiterInput,
  type RecruiterInput,
} from './schema'

const RECRUITER_LINKED_EVENT = 'recruiter_linked'

export async function createRecruiter(
  userId: UserId,
  rawInput: unknown,
): Promise<Result<{ recruiter: Recruiter }, AppError>> {
  const parsed = recruiterInputSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))

  const input = normalizeRecruiterInput(parsed.data)
  const result = await withRls(userId, async (tx) => {
    if (input.companyId) {
      const company = await tx.company.findUnique({
        where: { id: input.companyId },
        select: { userId: true },
      })
      if (!company || company.userId !== Number(userId)) {
        throw new Error(`NOT_FOUND:Company:${String(input.companyId)}`)
      }
    }

    const existing = input.email
      ? await tx.recruiter.findFirst({
          where: { userId: Number(userId), email: input.email },
        })
      : null

    if (existing) return { recruiter: existing }

    const recruiter = await tx.recruiter.create({
      data: {
        userId: Number(userId),
        companyId: input.companyId ?? null,
        name: input.name,
        email: input.email ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
      },
    })

    return { recruiter }
  })

  return translateBridge(result)
}

export async function updateRecruiter(
  userId: UserId,
  recruiterId: RecruiterId,
  rawInput: unknown,
): Promise<Result<{ recruiter: Recruiter }, AppError>> {
  const parsed = recruiterInputSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))
  const input = normalizeRecruiterInput(parsed.data)

  const result = await withRls(userId, async (tx) => {
    const existing = await tx.recruiter.findUnique({
      where: { id: Number(recruiterId) },
      select: { userId: true },
    })
    if (!existing || existing.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Recruiter:${String(recruiterId)}`)
    }

    if (input.companyId) {
      const company = await tx.company.findUnique({
        where: { id: input.companyId },
        select: { userId: true },
      })
      if (!company || company.userId !== Number(userId)) {
        throw new Error(`NOT_FOUND:Company:${String(input.companyId)}`)
      }
    }

    const recruiter = await tx.recruiter.update({
      where: { id: Number(recruiterId) },
      data: {
        companyId: input.companyId ?? null,
        name: input.name,
        email: input.email ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
      },
    })

    return { recruiter }
  })

  return translateBridge(result)
}

export async function linkRecruiterToApplication(
  userId: UserId,
  applicationId: ApplicationId,
  rawInput: unknown,
): Promise<Result<{ recruiterId: number }, AppError>> {
  const parsed = linkRecruiterInputSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))
  const input = normalizeLinkInput(parsed.data)

  if (!input.recruiterId && !input.email && !input.name) {
    return err(errors.validation([
      {
        code: 'custom',
        path: ['name'],
        message: 'Choose an existing recruiter or enter a name/email.',
      },
    ]))
  }

  const result = await withRls(userId, async (tx) => {
    const app = await tx.application.findUnique({
      where: { id: Number(applicationId) },
      select: { id: true, userId: true, companyId: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    let recruiterId = input.recruiterId ?? null

    if (recruiterId) {
      const recruiter = await tx.recruiter.findUnique({
        where: { id: recruiterId },
        select: { userId: true },
      })
      if (!recruiter || recruiter.userId !== Number(userId)) {
        throw new Error(`NOT_FOUND:Recruiter:${String(recruiterId)}`)
      }
    }

    if (!recruiterId && input.email) {
      const existing = await tx.recruiter.findFirst({
        where: { userId: Number(userId), email: input.email },
        select: { id: true },
      })
      recruiterId = existing?.id ?? null
    }

    if (!recruiterId) {
      const recruiter = await tx.recruiter.create({
        data: {
          userId: Number(userId),
          companyId: app.companyId,
          name: input.name ?? input.email ?? 'Recruiter',
          email: input.email ?? null,
          linkedinUrl: input.linkedinUrl ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        },
      })
      recruiterId = recruiter.id
    }

    await tx.applicationRecruiter.upsert({
      where: {
        applicationId_recruiterId: {
          applicationId: Number(applicationId),
          recruiterId,
        },
      },
      update: { role: input.role ?? null },
      create: {
        applicationId: Number(applicationId),
        recruiterId,
        role: input.role ?? null,
      },
    })

    await tx.event.create({
      data: {
        userId: Number(userId),
        applicationId: Number(applicationId),
        type: RECRUITER_LINKED_EVENT,
        source: 'manual',
        data: {
          recruiterId,
          role: input.role ?? null,
        },
        undoable: false,
      },
    })

    await tx.application.update({
      where: { id: Number(applicationId) },
      data: { lastActivityAt: new Date() },
    })

    return { recruiterId }
  })

  return translateBridge(result)
}

export async function unlinkRecruiterFromApplication(
  userId: UserId,
  applicationId: ApplicationId,
  recruiterId: RecruiterId,
): Promise<Result<{ unlinked: boolean }, AppError>> {
  const result = await withRls(userId, async (tx) => {
    const link = await tx.applicationRecruiter.findUnique({
      where: {
        applicationId_recruiterId: {
          applicationId: Number(applicationId),
          recruiterId: Number(recruiterId),
        },
      },
      select: {
        application: { select: { userId: true } },
        recruiter: { select: { userId: true } },
      },
    })

    if (
      !link ||
      link.application.userId !== Number(userId) ||
      link.recruiter.userId !== Number(userId)
    ) {
      throw new Error(`NOT_FOUND:ApplicationRecruiter:${String(applicationId)}:${String(recruiterId)}`)
    }

    await tx.applicationRecruiter.delete({
      where: {
        applicationId_recruiterId: {
          applicationId: Number(applicationId),
          recruiterId: Number(recruiterId),
        },
      },
    })

    return { unlinked: true }
  })

  return translateBridge(result)
}

function normalizeRecruiterInput(input: RecruiterInput): RecruiterInput {
  return {
    ...input,
    email: input.email?.toLowerCase(),
  }
}

function normalizeLinkInput(input: LinkRecruiterInput): LinkRecruiterInput {
  return {
    ...input,
    email: input.email?.toLowerCase(),
  }
}

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
