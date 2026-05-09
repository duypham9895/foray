import type { CanonicalStatus } from '@/generated/prisma/client'

import { cn } from '@/lib/utils'

const palette: Record<CanonicalStatus, { dot: string; label: string }> = {
  applied: { dot: 'bg-status-applied', label: 'Applied' },
  screening: { dot: 'bg-status-screening', label: 'Screening' },
  interviewing: { dot: 'bg-status-interviewing', label: 'Interviewing' },
  offer: { dot: 'bg-status-offer', label: 'Offer' },
  rejected: { dot: 'bg-status-closed', label: 'Rejected' },
  withdrawn: { dot: 'bg-status-closed', label: 'Withdrawn' },
}

export function StatusBadge({
  status,
  className,
}: {
  status: CanonicalStatus
  className?: string
}) {
  const { dot, label } = palette[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  )
}
