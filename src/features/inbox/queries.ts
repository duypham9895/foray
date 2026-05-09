import 'server-only'

import { type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import type { EmailClassification } from '@/generated/prisma/client'

export type InboxItem = {
  id: number
  subject: string
  from: string
  bodyExcerpt: string
  classification: EmailClassification | null
  confidence: number | null
  classifiedBy: string | null
  applicationId: number | null
  applicationRoleTitle: string | null
  companyName: string | null
  receivedAt: Date
}

/**
 * Fetches all emails with processing_status='needs_review' for the given user.
 * Returns InboxItem with joined application + company data.
 */
export async function findEmailsForReview(
  userId: UserId,
): Promise<Result<InboxItem[], AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.email.findMany({
      where: {
        userId: Number(userId),
        processingStatus: 'needs_review',
      },
      orderBy: { receivedAt: 'desc' },
      include: {
        application: {
          select: {
            id: true,
            roleTitle: true,
            company: { select: { name: true } },
          },
        },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      from: r.from,
      bodyExcerpt: r.bodyExcerpt,
      classification: r.classification,
      confidence: r.confidence,
      classifiedBy: r.classifiedBy,
      applicationId: r.applicationId,
      applicationRoleTitle: r.application?.roleTitle ?? null,
      companyName: r.application?.company.name ?? null,
      receivedAt: r.receivedAt,
    }))
  })
}

/**
 * Fetches non-archived applications with company names.
 * Used by the "link to application" dialog dropdown.
 */
export async function findApplicationsForLink(
  userId: UserId,
): Promise<Result<Array<{ id: number; roleTitle: string; companyName: string }>, AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.application.findMany({
      where: {
        userId: Number(userId),
        archivedAt: null,
      },
      orderBy: { lastActivityAt: 'desc' },
      include: { company: { select: { name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      roleTitle: r.roleTitle,
      companyName: r.company.name,
    }))
  })
}
