import { getTranslations } from 'next-intl/server'

import type { PipelineCounts } from '@/features/today/queries'
import type { CanonicalStatus } from '@/generated/prisma/client'
import { cn } from '@/lib/utils'

const ACTIVE_ORDER: CanonicalStatus[] = ['applied', 'screening', 'interviewing', 'offer']

const dotByStatus: Record<CanonicalStatus, string> = {
  applied: 'bg-status-applied',
  screening: 'bg-status-screening',
  interviewing: 'bg-status-interviewing',
  offer: 'bg-status-offer',
  rejected: 'bg-status-closed',
  withdrawn: 'bg-status-closed',
}

export async function PipelineStrip({
  counts,
  className,
}: {
  counts: PipelineCounts
  className?: string
}) {
  const t = await getTranslations('today')
  const tStatus = await getTranslations('status')
  const closedTotal = counts.rejected + counts.withdrawn

  return (
    <div className={cn('space-y-3 text-sm', className)}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {t('pipelineTitle')}
      </p>
      <ul className="space-y-1.5">
        {ACTIVE_ORDER.map((status) => (
          <li key={status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className={cn('size-1.5 rounded-full', dotByStatus[status])}
                aria-hidden="true"
              />
              {tStatus(status)}
            </span>
            <span className="font-mono text-xs tabular-nums text-foreground">
              {counts[status]}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-status-closed opacity-60"
              aria-hidden="true"
            />
            {t('pipelineClosed')}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {closedTotal}
          </span>
        </li>
      </ul>
    </div>
  )
}
