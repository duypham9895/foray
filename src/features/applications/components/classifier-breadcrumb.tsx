import { useTranslations } from 'next-intl'

import type { Email } from '@/generated/prisma/client'

const MS_PER_DAY = 1000 * 60 * 60 * 24

type Props = {
  emails: Email[]
}

export function ClassifierBreadcrumb({ emails }: Props) {
  const t = useTranslations('forayDetail')

  if (emails.length === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground">{t('noEmails')}</span>
    )
  }

  const unreviewed = emails.filter(
    (e) => e.processingStatus === 'needs_review' && !e.reviewedByUser,
  ).length

  const mostRecent = emails.reduce<Date>(
    (latest, e) => (e.receivedAt > latest ? e.receivedAt : latest),
    emails[0]!.receivedAt,
  )
  const daysAgo = Math.floor((Date.now() - mostRecent.getTime()) / MS_PER_DAY)

  const replyLabel =
    daysAgo <= 0
      ? t('lastReplyToday')
      : daysAgo === 1
        ? t('lastReplyOne')
        : t('lastReply', { n: daysAgo })

  return (
    <span className="font-mono text-xs text-muted-foreground">
      {unreviewed > 0
        ? `${unreviewed === 1 ? t('unreviewedEmailsOne') : t('unreviewedEmails', { n: unreviewed })} · ${replyLabel}`
        : replyLabel}
    </span>
  )
}
