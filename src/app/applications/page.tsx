import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { ApplicationList } from '@/features/applications/components/application-list'
import {
  countApplicationsByStatus,
  findApplicationsForList,
  listSortSchema,
  type ListSort,
} from '@/features/applications/queries'
import type { CanonicalStatus } from '@/generated/prisma/client'

const ALL_STATUSES: CanonicalStatus[] = ['applied','screening','interviewing','offer','rejected','withdrawn']
const DEFAULT_STATUSES: CanonicalStatus[] = ['applied','screening','interviewing','offer']
const isCanonicalStatus = (s: string): s is CanonicalStatus => (ALL_STATUSES as string[]).includes(s)

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

  const currentParams = new URLSearchParams()
  if (params.status) currentParams.set('status', params.status)
  if (sortParse.success) currentParams.set('sort', activeSort)

  const [listResult, countsResult] = await Promise.all([
    findApplicationsForList(userId, { statuses: activeStatuses, sort: activeSort }),
    countApplicationsByStatus(userId),
  ])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Link
            href="/applications/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {tActions('captureForay')}
          </Link>
        </header>

        {listResult.isErr() || countsResult.isErr() ? (
          <p className="text-muted-foreground">{t('loadError')}</p>
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
