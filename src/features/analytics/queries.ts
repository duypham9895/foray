import 'server-only'

import type { Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import type { ApplicationSource, CanonicalStatus } from '@/generated/prisma/client'

export type FunnelRow = {
  status: CanonicalStatus
  count: number
}

export type ResponseMetrics = {
  totalApplications: number
  respondedApplications: number
  responseRate: number
  medianDaysToResponse: number | null
}

export type WeeklyActivityRow = {
  weekStart: Date
  count: number
}

export type SourceEffectivenessRow = {
  source: ApplicationSource
  total: number
  responded: number
  responseRate: number
  converted: number
  conversionRate: number
}

export type AnalyticsDashboard = {
  funnel: FunnelRow[]
  response: ResponseMetrics
  weeklyActivity: WeeklyActivityRow[]
  sourceEffectiveness: SourceEffectivenessRow[]
  staleCount: number
}

const STATUSES: CanonicalStatus[] = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

type ResponseMetricsRow = {
  totalApplications: bigint
  respondedApplications: bigint
  medianDaysToResponse: number | null
}

type WeeklyActivitySqlRow = {
  weekStart: Date
  count: bigint
}

type SourceEffectivenessSqlRow = {
  source: ApplicationSource
  total: bigint
  responded: bigint
  converted: bigint
}

export async function getAnalyticsDashboard(
  userId: UserId,
): Promise<Result<AnalyticsDashboard, AppError>> {
  const staleCutoff = new Date(Date.now() - 7 * MS_PER_DAY)

  return withRls(userId, async (tx) => {
    const [groupedFunnel, staleCount, responseRows, weeklyRows, sourceRows] =
      await Promise.all([
        tx.application.groupBy({
          by: ['canonicalStatus'],
          where: { userId: Number(userId), archivedAt: null },
          _count: { _all: true },
        }),
        tx.application.count({
          where: {
            userId: Number(userId),
            archivedAt: null,
            canonicalStatus: { in: ['applied', 'screening', 'interviewing', 'offer'] },
            lastActivityAt: { lt: staleCutoff },
          },
        }),
        tx.$queryRaw<ResponseMetricsRow[]>`
          WITH first_responses AS (
            SELECT
              a.id,
              a.applied_at,
              MIN(e.received_at) AS first_response_at
            FROM applications a
            LEFT JOIN emails e
              ON e.application_id = a.id
             AND e.user_id = a.user_id
            WHERE a.user_id = ${Number(userId)}
              AND a.archived_at IS NULL
            GROUP BY a.id, a.applied_at
          )
          SELECT
            COUNT(*)::bigint AS "totalApplications",
            COUNT(first_response_at)::bigint AS "respondedApplications",
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (first_response_at - applied_at)) / 86400.0
            ) FILTER (
              WHERE first_response_at IS NOT NULL
                AND first_response_at >= applied_at
            )::float8 AS "medianDaysToResponse"
          FROM first_responses
        `,
        tx.$queryRaw<WeeklyActivitySqlRow[]>`
          WITH weeks AS (
            SELECT generate_series(
              date_trunc('week', NOW()) - INTERVAL '7 weeks',
              date_trunc('week', NOW()),
              INTERVAL '1 week'
            ) AS week_start
          )
          SELECT
            weeks.week_start::timestamp AS "weekStart",
            COUNT(applications.id)::bigint AS "count"
          FROM weeks
          LEFT JOIN applications
            ON date_trunc('week', applications.created_at) = weeks.week_start
           AND applications.user_id = ${Number(userId)}
           AND applications.archived_at IS NULL
          GROUP BY weeks.week_start
          ORDER BY weeks.week_start ASC
        `,
        tx.$queryRaw<SourceEffectivenessSqlRow[]>`
          WITH application_responses AS (
            SELECT
              a.id,
              a.source,
              a.canonical_status,
              MIN(e.received_at) AS first_response_at
            FROM applications a
            LEFT JOIN emails e
              ON e.application_id = a.id
             AND e.user_id = a.user_id
            WHERE a.user_id = ${Number(userId)}
              AND a.archived_at IS NULL
            GROUP BY a.id, a.source, a.canonical_status
          )
          SELECT
            source,
            COUNT(*)::bigint AS total,
            COUNT(first_response_at)::bigint AS responded,
            COUNT(*) FILTER (
              WHERE canonical_status IN ('screening', 'interviewing', 'offer')
            )::bigint AS converted
          FROM application_responses
          GROUP BY source
          ORDER BY total DESC, source ASC
        `,
      ])

    const funnelCounts = new Map(
      groupedFunnel.map((row) => [row.canonicalStatus, row._count._all]),
    )
    const response = responseRows[0] ?? {
      totalApplications: 0n,
      respondedApplications: 0n,
      medianDaysToResponse: null,
    }

    return {
      funnel: STATUSES.map((status) => ({
        status,
        count: funnelCounts.get(status) ?? 0,
      })),
      response: {
        totalApplications: Number(response.totalApplications),
        respondedApplications: Number(response.respondedApplications),
        responseRate: ratio(
          Number(response.respondedApplications),
          Number(response.totalApplications),
        ),
        medianDaysToResponse: response.medianDaysToResponse,
      },
      weeklyActivity: weeklyRows.map((row) => ({
        weekStart: row.weekStart,
        count: Number(row.count),
      })),
      sourceEffectiveness: sourceRows.map((row) => {
        const total = Number(row.total)
        const responded = Number(row.responded)
        const converted = Number(row.converted)
        return {
          source: row.source,
          total,
          responded,
          responseRate: ratio(responded, total),
          converted,
          conversionRate: ratio(converted, total),
        }
      }),
      staleCount,
    }
  })
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return numerator / denominator
}
