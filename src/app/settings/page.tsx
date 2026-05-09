import fs from 'node:fs'
import path from 'node:path'
import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'
import { ConnectGmailButton } from '@/features/inbox/components/connect-gmail-button'
import { DisconnectGmailButton } from '@/features/inbox/components/disconnect-gmail-button'
import { SyncNowButton } from '@/features/inbox/components/sync-now-button'
import { TokenHealthBanner } from '@/features/inbox/components/token-health-banner'

function getBookmarkletUrl(): string | null {
  try {
    const filePath = path.join(process.cwd(), 'public', 'foray-bookmarklet-url.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    return (JSON.parse(raw) as { url: string }).url
  } catch {
    return null
  }
}

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
  const bookmarkletUrl = getBookmarkletUrl()

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

      <section className="mt-8 border-t border-stone-200 dark:border-stone-700 pt-8">
        <h2 className="text-lg font-semibold">Bookmarklet: One-Click Capture</h2>

        <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
          Install this bookmarklet to capture jobs from any website with one click.
        </p>

        <div className="mt-4 rounded border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 p-4">
          {bookmarkletUrl ? (
            <a
              href={bookmarkletUrl}
              className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-move"
              title="Drag this to your bookmark bar"
            >
              Add to Foray
            </a>
          ) : (
            <p className="text-sm text-stone-500">
              Run <code className="rounded bg-stone-200 dark:bg-stone-800 px-1">pnpm build:bookmarklet</code> to generate the bookmarklet.
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm text-stone-700 dark:text-stone-300">
          <h3 className="font-semibold">Installation</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <strong>Drag:</strong> Drag the button above to your browser bookmark bar
            </li>
            <li>
              <strong>Right-click:</strong> Bookmark This Link, then choose your folder
            </li>
          </ol>
        </div>

        <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
          <strong>Usage:</strong> Click the bookmark while on any job posting page.
          Page title, URL, and selected text will be captured and pre-filled in a new foray.
        </p>
      </section>
    </div>
  )
}
