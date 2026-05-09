// Application list view (APP-01). Server Component — no 'use client'. Pure
// rendering driven by URL params (?status=...&sort=...) per CONTEXT §"Area 2"
// (locked decision: URL-driven multi-select chip toggle).
//
// Per DESIGN.md: cards over tables for primary lists, generous whitespace,
// rejection rendered in muted gray (NOT red), no decorative icons.

import { formatDistanceToNow } from 'date-fns'

import { Badge } from '@/ui/badge'
import { Card, CardContent } from '@/ui/card'
import type { CanonicalStatus } from '@/generated/prisma/client'

import type { ApplicationListItem, ListSort } from '../queries'

const ALL_STATUSES: CanonicalStatus[] = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

const STATUS_LABELS: Record<CanonicalStatus, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

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
 * Toggle the sort direction-pair on the URL while preserving the current
 * `?status=` filter. Phase 2 ships two sort axes: lastActivityAt and appliedAt.
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
  const usingDefaultFilter = currentParams.get('status') === null
  const isEmpty = items.length === 0
  const nextSort: ListSort =
    activeSort === 'appliedAt:desc' ? 'lastActivityAt:desc' : 'appliedAt:desc'
  const sortLabel =
    activeSort.startsWith('appliedAt') ? 'Sort: applied date' : 'Sort: latest activity'

  return (
    <div className="space-y-6">
      {/* Status filter chip strip — multi-select toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map((status) => {
          const active = activeStatuses.includes(status)
          const count = counts[status]
          const href = `/applications${toggleStatusInUrl(currentParams, status)}`
          const archivedSuffix =
            status === 'rejected' && counts.archived > 0
              ? ` (archived ${counts.archived})`
              : ''
          return (
            <a key={status} href={href} data-active={active}>
              <Badge variant={active ? 'default' : 'secondary'}>
                {STATUS_LABELS[status]} {count}
                {archivedSuffix}
              </Badge>
            </a>
          )
        })}
        <a href="/applications" className="text-sm text-stone-500 hover:text-stone-700">
          Reset
        </a>
      </div>

      {/* Sort toggle */}
      <div className="text-sm text-stone-500">
        <a
          href={`/applications${toggleSortInUrl(currentParams, nextSort)}`}
          className="hover:text-stone-700 underline"
        >
          {sortLabel}
        </a>
      </div>

      {isEmpty ? (
        <div className="rounded border border-stone-200 dark:border-stone-800 px-6 py-10 text-center">
          {usingDefaultFilter ? (
            <p className="text-base">
              No forays yet.{' '}
              <a
                href="/applications/new"
                className="underline hover:text-stone-700"
              >
                Capture your first foray
              </a>
              .
            </p>
          ) : (
            <p className="text-base">No forays match this filter.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`/applications/${item.id}`} className="block">
                <Card>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-base font-medium">{item.roleTitle}</p>
                      <p className="text-sm text-stone-500">{item.companyName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {STATUS_LABELS[item.canonicalStatus]}
                      </Badge>
                      <span className="text-xs text-stone-500">
                        {formatDistanceToNow(item.lastActivityAt, { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
