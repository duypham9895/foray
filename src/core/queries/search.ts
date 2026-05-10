// Global full-text search across applications, companies, emails, and stages.
//
// Uses case-insensitive `contains` queries via Prisma. GIN indexes created in
// migration 20260510150000 support future raw-SQL full-text if needed.
// All queries run inside withRls for tenant isolation.

import 'server-only'

import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import type { CanonicalStatus } from '@/generated/prisma/client'

export type SearchResultApplication = {
  id: number
  roleTitle: string
  companyName: string
  canonicalStatus: CanonicalStatus
}

export type SearchResultEmail = {
  id: number
  subject: string
  from: string
  receivedAt: Date
  applicationId: number | null
}

export type SearchResultStage = {
  id: number
  name: string
  applicationId: number
  applicationRoleTitle: string
}

export type SearchResults = {
  applications: SearchResultApplication[]
  emails: SearchResultEmail[]
  stages: SearchResultStage[]
}

const MAX_RESULTS_PER_ENTITY = 10

/**
 * Full-text search across applications (roleTitle, notes, searchText),
 * emails (subject, bodyExcerpt), and stages (name). Returns grouped results.
 * Returns empty groups for empty/whitespace queries.
 */
export async function fullTextSearch(
  userId: UserId,
  query: string,
): Promise<import('neverthrow').Result<SearchResults, AppError>> {
  const q = query.trim()
  if (!q.length) {
    return (await import('@/core/errors')).ok({
      applications: [],
      emails: [],
      stages: [],
    })
  }

  return withRls(userId, async (tx) => {
    const [applications, emails, stages] = await Promise.all([
      // Applications: match on roleTitle, notes, or searchText
      tx.application.findMany({
        where: {
          userId: Number(userId),
          archivedAt: null,
          OR: [
            { roleTitle: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { searchText: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          roleTitle: true,
          canonicalStatus: true,
          company: { select: { name: true } },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: MAX_RESULTS_PER_ENTITY,
      }),

      // Emails: match on subject or bodyExcerpt
      tx.email.findMany({
        where: {
          userId: Number(userId),
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { bodyExcerpt: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          subject: true,
          from: true,
          receivedAt: true,
          applicationId: true,
        },
        orderBy: { receivedAt: 'desc' },
        take: MAX_RESULTS_PER_ENTITY,
      }),

      // Stages: match on stage name, scoped to user's applications
      tx.stage.findMany({
        where: {
          application: { userId: Number(userId) },
          name: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          applicationId: true,
          application: { select: { roleTitle: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_RESULTS_PER_ENTITY,
      }),
    ])

    return {
      applications: applications.map((a) => ({
        id: a.id,
        roleTitle: a.roleTitle,
        companyName: a.company.name,
        canonicalStatus: a.canonicalStatus,
      })),
      emails: emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        receivedAt: e.receivedAt,
        applicationId: e.applicationId,
      })),
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        applicationId: s.applicationId,
        applicationRoleTitle: s.application.roleTitle,
      })),
    }
  })
}
