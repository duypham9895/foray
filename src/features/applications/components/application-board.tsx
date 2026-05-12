// Application board (kanban) view — sister to ApplicationList. Same input
// data, different presentation. Server Component. Used by /applications when
// ?view=board is set.
//
// Per DESIGN.md: cards on warm parchment, status colors only on the column
// header dot (not the card chrome itself), generous whitespace, stale
// signals woven into card body.

import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { StaleBadge } from '@/components/stale-badge'
import { cn } from '@/lib/utils'
import type { CanonicalStatus } from '@/generated/prisma/client'

import type { ApplicationListItem } from '../queries'

const COLUMN_ORDER: CanonicalStatus[] = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
]

const dotByStatus: Record<CanonicalStatus, string> = {
  applied: 'bg-status-applied',
  screening: 'bg-status-screening',
  interviewing: 'bg-status-interviewing',
  offer: 'bg-status-offer',
  rejected: 'bg-status-closed',
  withdrawn: 'bg-status-closed',
}

const MS_PER_DAY = 1000 * 60 * 60 * 24
const STALE_THRESHOLD_DAYS = 7

export function ApplicationBoard({ items }: { items: ApplicationListItem[] }) {
  const t = useTranslations('forays')
  const tStatus = useTranslations('status')

  const grouped: Record<CanonicalStatus, ApplicationListItem[]> = {
    applied: [],
    screening: [],
    interviewing: [],
    offer: [],
    rejected: [],
    withdrawn: [],
  }
  for (const item of items) grouped[item.canonicalStatus].push(item)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {COLUMN_ORDER.map((status) => {
        const colItems = grouped[status]
        return (
          <div
            key={status}
            className="flex min-h-[120px] flex-col gap-3 rounded-lg border border-border bg-card/40 p-3"
          >
            <header className="flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span
                  className={cn('size-1.5 rounded-full', dotByStatus[status])}
                  aria-hidden="true"
                />
                {tStatus(status)}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {colItems.length}
              </span>
            </header>

            {colItems.length === 0 ? (
              <p className="flex-1 px-2 py-6 text-center text-xs text-muted-foreground">
                {t('boardEmpty')}
              </p>
            ) : (
              <ul className="space-y-2">
                {colItems.map((item) => {
                  const daysQuiet = Math.floor(
                    (Date.now() - item.lastActivityAt.getTime()) / MS_PER_DAY,
                  )
                  const isStale =
                    daysQuiet >= STALE_THRESHOLD_DAYS &&
                    (status === 'applied' ||
                      status === 'screening' ||
                      status === 'interviewing' ||
                      status === 'offer')
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/applications/${item.id}`}
                        className="block rounded-md border border-border bg-card p-3 transition hover:border-foreground/20 hover:shadow-sm"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.roleTitle}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.companyName}
                        </p>
                        {item.currentStage ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {item.currentStage}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {isStale ? (
                            <StaleBadge daysQuiet={daysQuiet} />
                          ) : (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {formatDistanceToNow(item.lastActivityAt, { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
