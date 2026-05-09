import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'
import { DegradationBanner } from '@/features/inbox/components/degradation-banner'
import { InboxList } from '@/features/inbox/components/inbox-list'
import { findApplicationsForLink, findEmailsForReview } from '@/features/inbox/queries'

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
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-10">
          <h1 className="text-3xl font-medium tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {emails.length === 0
              ? 'Classified emails the matcher was confident about have already been routed.'
              : `${emails.length} email${emails.length === 1 ? '' : 's'} the classifier wasn't confident about. Confirm or override.`}
          </p>
        </header>

        <div className="space-y-6">
          <DegradationBanner gmailConnected={gmailConnected} lastSyncAt={lastSyncAt} />
          <InboxList items={emails} applications={applications} />
        </div>
      </div>
    </AppShell>
  )
}
