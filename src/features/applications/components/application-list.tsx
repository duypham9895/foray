// Application list view (APP-01). Server Component — no 'use client'. Pure
// rendering driven by URL params (?status=...&sort=...) per CONTEXT §"Area 2"
// (locked decision: URL-driven multi-select chip toggle).
//
// Per DESIGN.md: cards over tables for primary lists, generous whitespace,
// rejection rendered in muted gray (NOT red), no decorative icons.

import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { StatusBadge } from '@/components/status-badge'
import type { CanonicalStatus } from '@/generated/prisma/client'
import { Badge } from '@/ui/badge'
import { Card, CardContent } from '@/ui/card'

import type { ApplicationListItem, ListSort } from '../queries'
import { StaleIndicator } from './stale-indicator'

const ALL_STATUSES: CanonicalStatus[] = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

/**
 * Toggle `target` in `currentParams.status` (comma-separated multi-select).
 * Returns the new query string (including the leading `?`) representing the URL
 * state AFTER clicking. Returns '' when removing the last status (so the URL
 * falls back to the default filter — applied/screening/interviewing/offer).
 *
 * Preserves the `?sort=` param if present.
 */
export function toggleStatusInUrl(
  currentParams: URLSearchParams,
  target: CanonicalStatus,
): string {
  const current = (currentParams.get('status') ?? '')
    .split(',')
    .filter(Boolean) as CanonicalStatus[]
  const next = current.includes(target)
    ? current.filter((s) => s !== target)
    : [...current, target]

  const out = new URLSearchParams()
  if (next.length > 0) out.set('status', next.join(','))
  const sort = currentParams.get('sort')
  if (sort) out.set('sort', sort)
  const s = out.toString()
  return s ? `?${s}` : ''
}

/**
 * Toggle the sort axis on the URL while preserving the current `?status=`
 * filter. Phase 2 (Lean) ships two `:desc` axes only — lastActivityAt and
 * appliedAt. Asc variants are deferred per WR-03; see CONTEXT §"Area 2".
 */
function toggleSortInUrl(currentParams: URLSearchParams, nextSort: ListSort): string {
  const out = new URLSearchParams()
  const status = currentParams.get('status')
  if (status) out.set('status', status)
  out.set('sort', nextSort)
  return `?${out.toString()}`
}

export function ApplicationList({
  items,
  counts,
  activeStatuses,
  activeSort,
  currentParams,
}: {
  items: ApplicationListItem[]
  counts: Record<CanonicalStatus, number> & { archived: number }
  activeStatuses: CanonicalStatus[]
  activeSort: ListSort
  currentParams: URLSearchParams
}) {
  const t = useTranslations('forays')
  const tStatus = useTranslations('status')
  const tActions = useTranslations('actions')

  const usingDefaultFilter = currentParams.get('status') === null
  const isEmpty = items.length === 0
  const nextSort: ListSort =
    activeSort === 'appliedAt:desc' ? 'lastActivityAt:desc' : 'appliedAt:desc'
  const sortLabel =
    activeSort.startsWith('appliedAt') ? t('sortByApplied') : t('sortByActivity')

  return (
    <div className="space-y-6">
      {/* Status filter chip strip — multi-select toggle. */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map((status) => {
          const active = activeStatuses.includes(status)
          const count = counts[status]
          const href = `/applications${toggleStatusInUrl(currentParams, status)}`
          return (
            <Link key={status} href={href} data-active={active}>
              <Badge variant={active ? 'default' : 'outline'}>
                {tStatus(status)}
                <span className="ml-1 opacity-60">{count}</span>
              </Badge>
            </Link>
          )
        })}
        <Link
          href="/applications"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {tActions('reset')}
        </Link>
        {counts.archived > 0 ? (
          <span className="text-sm text-muted-foreground">
            · {t('archivedCount', { n: counts.archived })}
          </span>
        ) : null}
      </div>

      {/* Sort toggle */}
      <div className="text-sm text-muted-foreground">
        <Link
          href={`/applications${toggleSortInUrl(currentParams, nextSort)}`}
          className="underline-offset-4 transition hover:text-foreground hover:underline"
        >
          {sortLabel}
        </Link>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
          {usingDefaultFilter ? (
            <div className="space-y-3">
              <p className="text-base text-foreground">{t('emptyNoForays')}</p>
              <p className="text-sm text-muted-foreground">{t('emptyCaptureFirst')}</p>
              <div className="pt-2">
                <Link
                  href="/applications/new"
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  {tActions('captureForay')}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">{t('emptyNoMatch')}</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/applications/${item.id}`} className="block">
                <Card className="border-border bg-card transition hover:border-foreground/20 hover:shadow-sm">
                  <CardContent className="flex items-center justify-between gap-4 px-6">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-medium">{item.roleTitle}</p>
                      <p className="text-sm text-muted-foreground">{item.companyName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StaleIndicator lastActivityAt={item.lastActivityAt} />
                      <StatusBadge status={item.canonicalStatus} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDistanceToNow(item.lastActivityAt, { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
