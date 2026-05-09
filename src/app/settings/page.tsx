import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'
import { ConnectGmailButton } from '@/features/inbox/components/connect-gmail-button'
import { DisconnectGmailButton } from '@/features/inbox/components/disconnect-gmail-button'
import { SyncNowButton } from '@/features/inbox/components/sync-now-button'
import { TokenHealthBanner } from '@/features/inbox/components/token-health-banner'

export default async function SettingsPage() {
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

  const isConnected = !!user?.gmailRefreshTokenEncrypted

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Gmail Connection</h2>

        <TokenHealthBanner gmailLastSyncAt={user?.gmailLastSyncAt ?? null} />

        <div className="mt-4 flex items-center gap-4">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>

          {isConnected ? (
            <>
              <SyncNowButton />
              <DisconnectGmailButton />
            </>
          ) : (
            <ConnectGmailButton />
          )}
        </div>

        {user?.gmailLastSyncAt && (
          <p className="mt-2 text-sm text-gray-500">
            Last synced: {user.gmailLastSyncAt.toLocaleString()}
          </p>
        )}
      </section>
    </div>
  )
}
