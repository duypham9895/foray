import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { StatusBadge } from '@/components/status-badge'

import type { OfferForay, ReviewQueueItem } from '../queries'
import { ConfirmClassificationButton } from './confirm-classification-button'

type Props = {
  offers: OfferForay[]
  reviewQueue: ReviewQueueItem[]
}

export async function DecisionsCard({ offers, reviewQueue }: Props) {
  const t = await getTranslations('today')
  const tActions = await getTranslations('actions')
  const tInboxClassification = await getTranslations('inbox.classification')

  const total = offers.length + reviewQueue.length

  return (
    <section className="rounded-lg border border-border bg-accent/40 p-6">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-medium">{t('decisionsTitle')}</h2>
        {total > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('decisionsSubtitle', { n: total })}
          </span>
        ) : null}
      </header>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{t('decisionsEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {offers.map((offer) => (
            <li
              key={`offer-${offer.id}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {offer.roleTitle} — {offer.companyName}
                  </p>
                  <StatusBadge status="offer" />
                </div>
                {offer.currentStage ? (
                  <p className="text-xs text-muted-foreground">{offer.currentStage}</p>
                ) : null}
              </div>
              <Link
                href={`/applications/${offer.id}`}
                className="shrink-0 text-sm text-foreground underline-offset-4 transition hover:underline"
              >
                {tActions('openForay')} →
              </Link>
            </li>
          ))}

          {reviewQueue.map((email) => {
            const classification = email.classification
              ? tInboxClassification(email.classification)
              : null
            const percent = email.confidence
              ? Math.round(email.confidence * 100)
              : null
            return (
              <li
                key={`email-${email.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {email.from} · {email.subject}
                  </p>
                  {classification && percent !== null ? (
                    <p className="text-xs text-muted-foreground">
                      {t('decisionsClassifier', { label: classification, percent })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ConfirmClassificationButton emailId={email.id} />
                  <Link
                    href="/inbox"
                    className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
                    aria-label={tActions('openInbox')}
                  >
                    →
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
