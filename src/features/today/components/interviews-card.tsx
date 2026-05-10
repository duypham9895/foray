import { format } from 'date-fns'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import type { TodaysInterview } from '../queries'

export async function InterviewsCard({
  interviews,
}: {
  interviews: TodaysInterview[]
}) {
  const t = await getTranslations('today')

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="mb-4">
        <h2 className="text-xl font-medium">{t('interviewsTitle')}</h2>
      </header>

      {interviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('interviewsEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {interviews.map((iv) => (
            <li key={iv.stageId}>
              <Link
                href={`/applications/${iv.applicationId}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-md p-2 -mx-2 transition hover:bg-accent/50"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {iv.roleTitle} — {iv.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground">{iv.stageName}</p>
                </div>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {format(iv.scheduledAt, 'HH:mm')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
