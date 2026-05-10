import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { StaleBadge } from '@/components/stale-badge'
import { StatusBadge } from '@/components/status-badge'

import type { StaleForay } from '../queries'

export async function QuietCard({ forays }: { forays: StaleForay[] }) {
  const t = await getTranslations('today')

  if (forays.length === 0) return null

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-medium">{t('quietTitle')}</h2>
        <span className="text-xs text-muted-foreground">
          {t('quietSubtitle', { n: forays.length })}
        </span>
      </header>

      <ul className="divide-y divide-border">
        {forays.map((foray) => (
          <li
            key={foray.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">
                {foray.roleTitle} — {foray.companyName}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={foray.canonicalStatus} />
                <StaleBadge daysQuiet={foray.daysQuiet} />
                {foray.currentStage ? (
                  <span className="text-xs text-muted-foreground">{foray.currentStage}</span>
                ) : null}
              </div>
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
