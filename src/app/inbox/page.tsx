import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'
import { findEmailsForReview, findApplicationsForLink } from '@/features/inbox/queries'
import { InboxList } from '@/features/inbox/components/inbox-list'
import { DegradationBanner } from '@/features/inbox/components/degradation-banner'

export default async function InboxPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const userId = UserId(userResult.value.id)

  const user = await tenantDb(userId).user.findUnique({
    where: { id: Number(userId) },
    select: {
      gmailRefreshTokenEncrypted: true,
      gmailLastSyncAt: true,
    },
  })

  const gmailConnected = !!user?.gmailRefreshTokenEncrypted
  const lastSyncAt = user?.gmailLastSyncAt ?? null

  const emailsResult = await findEmailsForReview(userId)
  const appsResult = await findApplicationsForLink(userId)

  const emails = emailsResult.isOk() ? emailsResult.value : []
  const applications = appsResult.isOk() ? appsResult.value : []

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold">
        Inbox{' '}
        <span className="ml-2 text-base font-normal text-muted-foreground">
          {emails.length} to review
        </span>
      </h1>

      <div className="mt-6">
        <DegradationBanner gmailConnected={gmailConnected} lastSyncAt={lastSyncAt} />
      </div>

      <div className="mt-6">
        <InboxList items={emails} applications={applications} />
      </div>
    </div>
  )
}
