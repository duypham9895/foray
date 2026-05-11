import Link from 'next/link'
import { format } from 'date-fns'

import type { AnalyticsDashboard as AnalyticsDashboardData } from '../queries'

const statusLabels = {
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
} as const

const sourceLabels = {
  linkedin: 'LinkedIn',
  direct: 'Direct',
  referral: 'Referral',
  recruiter: 'Recruiter',
  other: 'Other',
} as const

export function AnalyticsDashboard({
  data,
}: {
  data: AnalyticsDashboardData
}) {
  const maxFunnel = Math.max(...data.funnel.map((row) => row.count), 1)
  const maxWeekly = Math.max(...data.weeklyActivity.map((row) => row.count), 1)

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Response rate"
          value={formatPercent(data.response.responseRate)}
          detail={`${data.response.respondedApplications} of ${data.response.totalApplications} forays`}
        />
        <MetricCard
          label="Median response"
          value={
            data.response.medianDaysToResponse === null
              ? '-'
              : `${formatNumber(data.response.medianDaysToResponse)}d`
          }
          detail="First linked email after applying"
        />
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Stale forays</p>
          <p className="mt-2 text-3xl font-medium tracking-tight">{data.staleCount}</p>
          <Link
            href="/applications?sort=lastActivityAt%3Adesc"
            className="mt-2 inline-block text-sm text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
          >
            Review pipeline
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-xl font-medium">Funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current count at each lifecycle status.
          </p>
        </div>
        <div className="space-y-3">
          {data.funnel.map((row) => (
            <div key={row.status} className="grid grid-cols-[110px_1fr_44px] items-center gap-3">
              <span className="text-sm text-muted-foreground">{statusLabels[row.status]}</span>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.max((row.count / maxFunnel) * 100, row.count ? 8 : 0)}%` }}
                />
              </div>
              <span className="text-right font-mono text-sm">{row.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-xl font-medium">Weekly activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Forays captured by week.
          </p>
        </div>
        <div className="flex h-48 items-end gap-3">
          {data.weeklyActivity.map((row) => (
            <div key={row.weekStart.toISOString()} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end rounded bg-muted">
                <div
                  className="w-full rounded bg-primary"
                  style={{ height: `${Math.max((row.count / maxWeekly) * 100, row.count ? 8 : 0)}%` }}
                  aria-label={`${row.count} forays`}
                />
              </div>
              <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground">
                {format(row.weekStart, 'MMM d')}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-xl font-medium">Source effectiveness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Response and conversion rates by source.
          </p>
        </div>
        {data.sourceEffectiveness.length === 0 ? (
          <p className="text-sm text-muted-foreground">No source data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 text-right font-medium">Forays</th>
                  <th className="py-2 pr-4 text-right font-medium">Response</th>
                  <th className="py-2 text-right font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceEffectiveness.map((row) => (
                  <tr key={row.source} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium">{sourceLabels[row.source]}</td>
                    <td className="py-3 pr-4 text-right font-mono">{row.total}</td>
                    <td className="py-3 pr-4 text-right">
                      {formatPercent(row.responseRate)}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {row.responded}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {formatPercent(row.conversionRate)}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {row.converted}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-medium tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
}
