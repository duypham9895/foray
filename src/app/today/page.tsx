import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { PipelineStrip } from '@/components/pipeline-strip'
import { requireUser } from '@/core/auth/session'
import { DecisionsCard } from '@/features/today/components/decisions-card'
import { InterviewsCard } from '@/features/today/components/interviews-card'
import { QuietCard } from '@/features/today/components/quiet-card'
import {
  findOfferForays,
  findRecent24hActivity,
  findReviewQueueTopN,
  findStaleForays,
  findThisWeekCounts,
  findTodaysInterviews,
  getPipelineCounts,
} from '@/features/today/queries'

const localeMap: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  id: 'id-ID',
}

export default async function TodayPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = userResult.value.id
  const locale = await getLocale()

  const [staleResult, offerResult, reviewResult, interviewsResult, countsResult, recentResult, weekResult] =
    await Promise.all([
      findStaleForays(userId),
      findOfferForays(userId),
      findReviewQueueTopN(userId, 3),
      findTodaysInterviews(userId),
      getPipelineCounts(userId),
      findRecent24hActivity(userId),
      findThisWeekCounts(userId),
    ])

  const stale = staleResult.isOk() ? staleResult.value : []
  const offers = offerResult.isOk() ? offerResult.value : []
  const review = reviewResult.isOk() ? reviewResult.value : []
  const interviews = interviewsResult.isOk() ? interviewsResult.value : []
  const counts = countsResult.isOk() ? countsResult.value : null
  const recent = recentResult.isOk() ? recentResult.value : { emails: [], activeApplications: [] }
  const weekCounts = weekResult.isOk() ? weekResult.value : null
  const t = await getTranslations('today')

  const totalForays = counts
    ? Object.values(counts).reduce((sum, n) => sum + n, 0)
    : null

  const dateLabel = new Intl.DateTimeFormat(localeMap[locale] ?? 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date())

  return (
    <AppShell aside={counts ? <PipelineStrip counts={counts} /> : null}>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {dateLabel}
          </p>
        </header>

        <div className="space-y-6">
          <DecisionsCard offers={offers} reviewQueue={review} />
          <InterviewsCard interviews={interviews} />
          <QuietCard forays={stale} />

          {(recent.emails.length > 0 || recent.activeApplications.length > 0) && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {t('recentActivity', { defaultValue: 'Last 24 hours' })}
              </h2>
              <ul className="space-y-2 text-sm">
                {recent.emails.map((email) => (
                  <li key={`email-${email.id}`} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">{email.from}</span>
                    <span className="truncate">{email.subject}</span>
                  </li>
                ))}
                {recent.activeApplications.map((app) => (
                  <li key={`app-${app.id}`} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="font-medium capitalize">{app.canonicalStatus}</span>
                    <span className="text-muted-foreground">updated</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weekCounts && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {t('thisWeek', { defaultValue: 'This week' })}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(weekCounts.thisWeek).map(([status, count]) => {
                  const delta = count - (weekCounts.lastWeek[status as keyof typeof weekCounts.lastWeek] ?? 0)
                  return (
                    <div key={status} className="text-center">
                      <p className="text-2xl font-semibold tabular-nums">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{status}</p>
                      {delta !== 0 && (
                        <p className={`text-xs ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {delta > 0 ? '+' : ''}{delta} vs last week
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {totalForays === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground/60">
            {t('globalEmptyBody')}{' '}
            <Link href="/guide" className="underline underline-offset-4 hover:text-muted-foreground">
              {t('readGuide')}
            </Link>
          </p>
        ) : null}
      </div>
    </AppShell>
  )
}
