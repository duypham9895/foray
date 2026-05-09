import { notFound, redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { ApplicationId } from '@/core/types/ids'
import { ApplicationDetail } from '@/features/applications/components/application-detail'
import { findApplicationDetail } from '@/features/applications/queries'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = userResult.value.id

  const { id } = await params
  const result = await findApplicationDetail(userId, ApplicationId(id))
  if (result.isErr()) {
    return (
      <main className="p-6">
        <p>Could not load this foray.</p>
      </main>
    )
  }
  if (!result.value) notFound()

  return (
    <main className="p-6 max-w-3xl">
      <ApplicationDetail detail={result.value} />
    </main>
  )
}
