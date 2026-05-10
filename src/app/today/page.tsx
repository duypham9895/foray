import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { PipelineStrip } from '@/components/pipeline-strip'
import { requireUser } from '@/core/auth/session'
import { DecisionsCard } from '@/features/today/components/decisions-card'
import { InterviewsCard } from '@/features/today/components/interviews-card'
import { QuietCard } from '@/features/today/components/quiet-card'
import {
  findOfferForays,
  findReviewQueueTopN,
  findStaleForays,
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

  const [staleResult, offerResult, reviewResult, interviewsResult, countsResult] =
    await Promise.all([
      findStaleForays(userId),
      findOfferForays(userId),
      findReviewQueueTopN(userId, 3),
      findTodaysInterviews(userId),
      getPipelineCounts(userId),
    ])

  const stale = staleResult.isOk() ? staleResult.value : []
  const offers = offerResult.isOk() ? offerResult.value : []
  const review = reviewResult.isOk() ? reviewResult.value : []
  const interviews = interviewsResult.isOk() ? interviewsResult.value : []
  const counts = countsResult.isOk() ? countsResult.value : null

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
        </div>
      </div>
    </AppShell>
  )
}
