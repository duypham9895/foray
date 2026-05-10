import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import type { OverdueFollowUp } from '../queries'

export async function FollowUpsCard({
  followUps,
}: {
  followUps: OverdueFollowUp[]
}) {
  const t = await getTranslations('today')

  if (followUps.length === 0) return null

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-medium">{t('followUpsTitle')}</h2>
        <span className="text-xs text-muted-foreground">
          {t('followUpsSubtitle', { n: followUps.length })}
        </span>
      </header>

      <ul className="divide-y divide-border">
        {followUps.map((foray) => (
          <li
            key={foray.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">
                {foray.roleTitle} — {foray.companyName}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('daysOverdue', { n: foray.daysOverdue })}
              </p>
            </div>
            <Link
              href={`/applications/${foray.id}`}
              className="shrink-0 text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
