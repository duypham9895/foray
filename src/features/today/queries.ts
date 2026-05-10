// Today landing — read queries for the campaign-room dashboard.
//
// Five buckets feed Today:
//   1. Stale forays (lastActivityAt < now - daysQuiet, active statuses only)
//   2. Today's interviews (Stage.scheduledAt within today's wall-clock day)
//   3. Offer forays (canonical_status = 'offer' — implicit decision pressure)
//   4. Review queue top-N (emails with processingStatus = needs_review)
//   5. Pipeline counts by canonical_status
//
// All queries run inside withRls because the runtime DATABASE_URL is the
// foray_app non-superuser role; without the GUC set RLS denies every row.

import 'server-only'
import { type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import type { CanonicalStatus, EmailClassification } from '@/generated/prisma/client'

export type StaleForay = {
  id: number
  roleTitle: string
  companyName: string
  canonicalStatus: CanonicalStatus
  currentStage: string | null
  lastActivityAt: Date
  daysQuiet: number
}

export type OfferForay = {
  id: number
  roleTitle: string
  companyName: string
  currentStage: string | null
  appliedAt: Date
}

export type ReviewQueueItem = {
  id: number
  subject: string
  from: string
  classification: EmailClassification | null
  confidence: number | null
}

export type TodaysInterview = {
  stageId: number
  applicationId: number
  roleTitle: string
  companyName: string
  stageName: string
  scheduledAt: Date
}

export type PipelineCounts = Record<CanonicalStatus, number>

const ACTIVE_STATUSES: ReadonlyArray<CanonicalStatus> = [
  'applied',
  'screening',
  'interviewing',
  'offer',
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

export async function findStaleForays(
  userId: UserId,
  opts: { daysQuiet?: number; limit?: number } = {},
): Promise<Result<StaleForay[], AppError>> {
  const daysQuiet = opts.daysQuiet ?? 7
  const limit = opts.limit ?? 5
  const cutoff = new Date(Date.now() - daysQuiet * MS_PER_DAY)

  return withRls(userId, async (tx) => {
    const rows = await tx.application.findMany({
      where: {
        userId: Number(userId),
        archivedAt: null,
        canonicalStatus: { in: [...ACTIVE_STATUSES] },
        lastActivityAt: { lt: cutoff },
      },
      orderBy: { lastActivityAt: 'asc' },
      take: limit,
      include: { company: { select: { name: true } } },
    })
    const now = Date.now()
    return rows.map<StaleForay>((r) => ({
      id: r.id,
      roleTitle: r.roleTitle,
      companyName: r.company.name,
      canonicalStatus: r.canonicalStatus,
      currentStage: r.currentStage,
      lastActivityAt: r.lastActivityAt,
      daysQuiet: Math.floor((now - r.lastActivityAt.getTime()) / MS_PER_DAY),
    }))
  })
}

export async function findOfferForays(
  userId: UserId,
): Promise<Result<OfferForay[], AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.application.findMany({
      where: {
        userId: Number(userId),
        archivedAt: null,
        canonicalStatus: 'offer',
      },
      orderBy: { lastActivityAt: 'desc' },
      include: { company: { select: { name: true } } },
    })
    return rows.map<OfferForay>((r) => ({
      id: r.id,
      roleTitle: r.roleTitle,
      companyName: r.company.name,
      currentStage: r.currentStage,
      appliedAt: r.appliedAt,
    }))
  })
}

export async function findReviewQueueTopN(
  userId: UserId,
  n: number = 3,
): Promise<Result<ReviewQueueItem[], AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.email.findMany({
      where: {
        userId: Number(userId),
        processingStatus: 'needs_review',
        reviewedByUser: false,
      },
      orderBy: [{ confidence: 'desc' }, { receivedAt: 'desc' }],
      take: n,
      select: {
        id: true,
        subject: true,
        from: true,
        classification: true,
        confidence: true,
      },
    })
    return rows
  })
}

export async function findTodaysInterviews(
  userId: UserId,
): Promise<Result<TodaysInterview[], AppError>> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay.getTime() + MS_PER_DAY)

  return withRls(userId, async (tx) => {
    const rows = await tx.stage.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lt: endOfDay },
        completedAt: null,
        application: { userId: Number(userId) },
      },
      orderBy: { scheduledAt: 'asc' },
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
    return rows.map<TodaysInterview>((r) => ({
      stageId: r.id,
      applicationId: r.application.id,
      roleTitle: r.application.roleTitle,
      companyName: r.application.company.name,
      stageName: r.name,
      scheduledAt: r.scheduledAt!,
    }))
  })
}

export async function getPipelineCounts(
  userId: UserId,
): Promise<Result<PipelineCounts, AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.application.groupBy({
      by: ['canonicalStatus'],
      where: { userId: Number(userId), archivedAt: null },
      _count: { _all: true },
    })
    const counts: PipelineCounts = {
      applied: 0,
      screening: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    }
    for (const r of rows) {
      counts[r.canonicalStatus] = r._count._all
    }
    return counts
  })
}

// --- Recent 24h activity ---

export type RecentEmail = {
  id: number
  subject: string
  from: string
  classification: EmailClassification | null
  receivedAt: Date
  applicationId: number | null
}

export type RecentStatusChange = {
  id: number
  canonicalStatus: CanonicalStatus
  updatedAt: Date
}

export type Recent24hActivity = {
  emails: RecentEmail[]
  statusChanges: RecentStatusChange[]
}

export async function findRecent24hActivity(
  userId: UserId,
): Promise<Result<Recent24hActivity, AppError>> {
  const since = new Date(Date.now() - MS_PER_DAY)

  return withRls(userId, async (tx) => {
    const [emails, statusChanges] = await Promise.all([
      tx.email.findMany({
        where: {
          userId: Number(userId),
          receivedAt: { gte: since },
        },
        select: {
          id: true,
          subject: true,
          from: true,
          classification: true,
          receivedAt: true,
          applicationId: true,
        },
        orderBy: { receivedAt: 'desc' },
        take: 10,
      }),
      tx.application.findMany({
        where: {
          userId: Number(userId),
          updatedAt: { gte: since },
        },
        select: {
          id: true,
          canonicalStatus: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ])

    return { emails, statusChanges }
  })
}

// --- Week-over-week counts ---

export type WeekCounts = {
  thisWeek: PipelineCounts
  lastWeek: PipelineCounts
}

export async function findThisWeekCounts(
  userId: UserId,
): Promise<Result<WeekCounts, AppError>> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  return withRls(userId, async (tx) => {
    const [thisWeekRows, lastWeekRows] = await Promise.all([
      tx.application.groupBy({
        by: ['canonicalStatus'],
        where: {
          userId: Number(userId),
          archivedAt: null,
          appliedAt: { gte: weekStart },
        },
        _count: { _all: true },
      }),
      tx.application.groupBy({
        by: ['canonicalStatus'],
        where: {
          userId: Number(userId),
          archivedAt: null,
          appliedAt: { gte: lastWeekStart, lt: weekStart },
        },
        _count: { _all: true },
      }),
    ])

    const emptyCounts: PipelineCounts = {
      applied: 0,
      screening: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    }

    const thisWeek = { ...emptyCounts }
    for (const r of thisWeekRows) {
      thisWeek[r.canonicalStatus] = r._count._all
    }

    const lastWeek = { ...emptyCounts }
    for (const r of lastWeekRows) {
      lastWeek[r.canonicalStatus] = r._count._all
    }

    return { thisWeek, lastWeek }
  })
}
