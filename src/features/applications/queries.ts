// Application slice — read queries.
//
// Three URL-driven, server-only read functions used by `/applications`,
// `/applications/[id]` Server Components and the status-badge UI in Plan 04.
// All run inside withRls because the runtime DATABASE_URL is foray_app
// (non-superuser, FORCE RLS active) — without the GUC set, RLS denies all
// rows and the page renders empty.
//
// Pages stay ≤5 lines per VSA contract (PRINCIPLES.md §"Architecture").

import 'server-only'
import { type Result } from 'neverthrow'
import { z } from 'zod'

import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { ApplicationId, UserId } from '@/core/types/ids'
import type {
  Application,
  CanonicalStatus,
  Document,
  Email,
  Event,
  Stage,
} from '@/generated/prisma/client'

export type ApplicationListItem = {
  id: number
  companyId: number
  companyName: string
  roleTitle: string
  canonicalStatus: CanonicalStatus
  currentStage: string | null
  lastActivityAt: Date
  daysQuiet: number
  appliedAt: Date
  archivedAt: Date | null
}

export type ApplicationDetail = {
  application: Application & {
    company: { id: number; name: string; domain: string | null }
  }
  stages: Stage[]
  events: Event[]
  emails: Email[]
  documents: Document[]
}

// URL-driven sort param. Validated at the page boundary via `safeParse` so
// arbitrary `?sort=...` strings cannot reach Prisma's `orderBy` (PRINCIPLES.md
// §"Zod at every boundary"). The union below mirrors the schema literals.
//
// Phase 2 (Lean) ships `:desc` for both axes only — the UI toggle has no
// asc/desc affordance, so exposing `:asc` literals would be dead code per
// CLAUDE.md §1.2. The asc variants are deferred to the Standard milestone
// when bulk filtering becomes a UX need.
export const listSortSchema = z.enum([
  'lastActivityAt:desc',
  'appliedAt:desc',
])
export type ListSort = z.infer<typeof listSortSchema>

const ALL_STATUSES: ReadonlyArray<CanonicalStatus> = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]
const DEFAULT_HIDDEN_STATUSES: ReadonlySet<CanonicalStatus> = new Set([
  'rejected',
  'withdrawn',
])
const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * URL-driven application list. Filters default to excluding rejected +
 * withdrawn unless the caller explicitly passes a `statuses` set. Sort
 * default is lastActivityAt:desc. Always excludes archived applications
 * (archivedAt IS NULL).
 */
export async function findApplicationsForList(
  userId: UserId,
  opts: { statuses?: ReadonlyArray<CanonicalStatus>; sort?: ListSort; tag?: string } = {},
): Promise<Result<ApplicationListItem[], AppError>> {
  const sort = opts.sort ?? 'lastActivityAt:desc'
  const [sortField, sortDir] = sort.split(':') as [
    'lastActivityAt' | 'appliedAt',
    'asc' | 'desc',
  ]
  const statuses =
    opts.statuses ?? ALL_STATUSES.filter((s) => !DEFAULT_HIDDEN_STATUSES.has(s))
  const tag = opts.tag?.toLowerCase().trim()

  return withRls(userId, async (tx) => {
    const now = Date.now()
    const rows = await tx.application.findMany({
      where: {
        userId: Number(userId),
        archivedAt: null,
        canonicalStatus: { in: [...statuses] },
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: { [sortField]: sortDir },
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
      daysQuiet: Math.floor((now - r.lastActivityAt.getTime()) / MS_PER_DAY),
      appliedAt: r.appliedAt,
      archivedAt: r.archivedAt,
    }))
  })
}

/**
 * Detail page data — three Prisma calls in one withRls tx, merged in
 * service-layer. The page renders the timeline by sorting events+stages+
 * emails by occurredAt/createdAt in the component (per CONTEXT.md §
 * "Specifics" → "Server Component data flow"). Returns Result with `null`
 * value when the application is not in the tenant — pages map that to
 * Next's `notFound()`.
 */
export async function findApplicationDetail(
  userId: UserId,
  applicationId: ApplicationId,
): Promise<Result<ApplicationDetail | null, AppError>> {
  return withRls(userId, async (tx): Promise<ApplicationDetail | null> => {
    const numericId = Number(applicationId)
    const application = await tx.application.findUnique({
      where: { id: numericId },
      include: { company: { select: { id: true, name: true, domain: true } } },
    })
    if (!application || application.userId !== Number(userId)) return null

    const [stages, events, emails, documents] = await Promise.all([
      tx.stage.findMany({ where: { applicationId: numericId }, orderBy: { order: 'asc' } }),
      tx.event.findMany({ where: { applicationId: numericId }, orderBy: { occurredAt: 'desc' } }),
      tx.email.findMany({ where: { applicationId: numericId }, orderBy: { receivedAt: 'desc' } }),
      tx.document.findMany({ where: { applicationId: numericId }, orderBy: { createdAt: 'desc' } }),
    ])
    return { application, stages, events, emails, documents }
  })
}

/**
 * Counts per canonical status for badge UI; includes the archived count
 * (which the default list view hides) so the UI can render an "X archived"
 * affordance. Status values not present in groupBy results stay 0.
 */
export async function countApplicationsByStatus(
  userId: UserId,
): Promise<Result<Record<CanonicalStatus, number> & { archived: number }, AppError>> {
  return withRls(userId, async (tx) => {
    const grouped = await tx.application.groupBy({
      by: ['canonicalStatus'],
      where: { userId: Number(userId), archivedAt: null },
      _count: { _all: true },
    })
    const archivedCount = await tx.application.count({
      where: { userId: Number(userId), archivedAt: { not: null } },
    })
    const result: Record<CanonicalStatus, number> & { archived: number } = {
      applied: 0,
      screening: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
      archived: archivedCount,
    }
    for (const row of grouped) {
      result[row.canonicalStatus] = row._count._all
    }
    return result
  })
}
