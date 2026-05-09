import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { ApplicationList } from '@/features/applications/components/application-list'
import { countApplicationsByStatus, findApplicationsForList, type ListSort } from '@/features/applications/queries'
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

  const params = await searchParams
  const fromUrl = params.status?.split(',').filter(isCanonicalStatus) ?? []
  const activeStatuses: CanonicalStatus[] =
    fromUrl.length > 0 ? fromUrl : DEFAULT_STATUSES
  const activeSort: ListSort = (params.sort as ListSort) ?? 'lastActivityAt:desc'

  const currentParams = new URLSearchParams()
  if (params.status) currentParams.set('status', params.status)
  if (params.sort) currentParams.set('sort', params.sort)

  const [listResult, countsResult] = await Promise.all([
    findApplicationsForList(userId, { statuses: activeStatuses, sort: activeSort }),
    countApplicationsByStatus(userId),
  ])
  if (listResult.isErr() || countsResult.isErr()) {
    return (
      <main className="p-6">
        <p>Could not load forays. Try refreshing.</p>
      </main>
    )
  }

  return (
    <main className="p-6">
      <h1 className="text-3xl mb-6">Forays</h1>
      <ApplicationList
        items={listResult.value}
        counts={countsResult.value}
        activeStatuses={activeStatuses}
        activeSort={activeSort}
        currentParams={currentParams}
      />
    </main>
  )
}
