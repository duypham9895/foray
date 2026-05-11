import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { AnalyticsDashboard } from '@/features/analytics/components/analytics-dashboard'
import { getAnalyticsDashboard } from '@/features/analytics/queries'

export default async function AnalyticsPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const result = await getAnalyticsDashboard(userResult.value.id)

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Campaign-level readout across pipeline, replies, sources, and weekly activity.
          </p>
        </header>

        {result.isErr() ? (
          <p className="text-sm text-muted-foreground">
            Could not load analytics. Try refreshing.
          </p>
        ) : (
          <AnalyticsDashboard data={result.value} />
        )}
      </div>
    </AppShell>
  )
}
