import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { ApplicationBoard } from '@/features/applications/components/application-board'
import { ApplicationList } from '@/features/applications/components/application-list'
import { TagCloud } from '@/features/applications/components/tag-cloud'
import {
  countApplicationsByStatus,
  findApplicationsForList,
  listSortSchema,
  type ListSort,
} from '@/features/applications/queries'
import { findAllTags } from '@/features/applications/tags-service'
import type { CanonicalStatus } from '@/generated/prisma/client'
import { cn } from '@/lib/utils'

const ALL_STATUSES: CanonicalStatus[] = ['applied','screening','interviewing','offer','rejected','withdrawn']
const DEFAULT_STATUSES: CanonicalStatus[] = ['applied','screening','interviewing','offer']
const isCanonicalStatus = (s: string): s is CanonicalStatus => (ALL_STATUSES as string[]).includes(s)

type View = 'board' | 'list'
const DEFAULT_VIEW: View = 'board'
function isView(v: string | undefined): v is View {
  return v === 'board' || v === 'list'
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = userResult.value.id

  const t = await getTranslations('forays')
  const tActions = await getTranslations('actions')

  const params = await searchParams
  const fromUrl = params.status?.split(',').filter(isCanonicalStatus) ?? []
  const activeStatuses: CanonicalStatus[] =
    fromUrl.length > 0 ? fromUrl : DEFAULT_STATUSES
  const sortParse = listSortSchema.safeParse(params.sort)
  const activeSort: ListSort = sortParse.success ? sortParse.data : 'lastActivityAt:desc'
  const view: View = isView(params.view) ? params.view : DEFAULT_VIEW
  const activeTag = params.tag?.trim() || undefined

  // Board mode shows ALL active statuses (the columns themselves are the
  // filter); list mode honors the chip selection.
  const queryStatuses: CanonicalStatus[] =
    view === 'board' ? DEFAULT_STATUSES : activeStatuses

  const currentParams = new URLSearchParams()
  if (params.status) currentParams.set('status', params.status)
  if (sortParse.success) currentParams.set('sort', activeSort)
  if (activeTag) currentParams.set('tag', activeTag)

  const [listResult, countsResult, tagsResult] = await Promise.all([
    findApplicationsForList(userId, { statuses: queryStatuses, sort: activeSort, tag: activeTag }),
    countApplicationsByStatus(userId),
    findAllTags(userId),
  ])

  const toggleHref = (target: View) => {
    const out = new URLSearchParams(currentParams)
    if (target === 'list') out.set('view', 'list')
    else out.delete('view')
    const s = out.toString()
    return s ? `/applications?${s}` : '/applications'
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
              <Link
                href={toggleHref('board')}
                className={cn(
                  'rounded px-2.5 py-1 transition',
                  view === 'board'
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('viewBoard')}
              </Link>
              <Link
                href={toggleHref('list')}
                className={cn(
                  'rounded px-2.5 py-1 transition',
                  view === 'list'
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('viewList')}
              </Link>
            </div>
            <Link
              href="/applications/new"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {tActions('captureForay')}
            </Link>
          </div>
        </header>

        {/* Tag cloud + active tag indicator */}
        {tagsResult.isOk() && tagsResult.value.length > 0 && (
          <div className="mb-6">
            {activeTag && (
              <p className="mb-2 text-sm text-muted-foreground">
                Filtering by tag: <span className="font-medium text-foreground">{activeTag}</span>{' '}
                <Link href="/applications" className="text-primary hover:underline">
                  Clear
                </Link>
              </p>
            )}
            <TagCloud tags={tagsResult.value} activeTag={activeTag} />
          </div>
        )}

        {listResult.isErr() || countsResult.isErr() ? (
          <p className="text-muted-foreground">{t('loadError')}</p>
        ) : view === 'board' ? (
          <ApplicationBoard items={listResult.value} />
        ) : (
          <ApplicationList
            items={listResult.value}
            counts={countsResult.value}
            activeStatuses={activeStatuses}
            activeSort={activeSort}
            currentParams={currentParams}
          />
        )}
      </div>
    </AppShell>
  )
}
