import { useTranslations } from 'next-intl'

import type { CanonicalStatus } from '@/generated/prisma/client'
import { cn } from '@/lib/utils'

const dotByStatus: Record<CanonicalStatus, string> = {
  applied: 'bg-status-applied',
  screening: 'bg-status-screening',
  interviewing: 'bg-status-interviewing',
  offer: 'bg-status-offer',
  rejected: 'bg-status-closed',
  withdrawn: 'bg-status-closed',
}

export function StatusBadge({
  status,
  className,
}: {
  status: CanonicalStatus
  className?: string
}) {
  const t = useTranslations('status')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dotByStatus[status])} aria-hidden="true" />
      {t(status)}
    </span>
  )
}
