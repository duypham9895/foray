import fs from 'node:fs'
import path from 'node:path'

import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
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
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-10">
          <h1 className="text-3xl font-medium tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Gmail, install the bookmarklet, manage your local foray instance.
          </p>
        </header>

        <div className="space-y-6">
          {/* Gmail connection */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-medium">Gmail</h2>
              <p className="text-sm text-muted-foreground">
                The classifier reads your inbox to spot replies, interview invites, and
                rejections. Subjects and 500-char excerpts are stored; full bodies are
                fetched on demand.
              </p>
            </div>

            <div className="mt-4">
              <TokenHealthBanner gmailLastSyncAt={user?.gmailLastSyncAt ?? null} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span
                className={
                  isConnected
                    ? 'inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground'
                    : 'inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
                }
              >
                <span
                  className={
                    isConnected
                      ? 'size-1.5 rounded-full bg-status-offer'
                      : 'size-1.5 rounded-full bg-muted-foreground'
                  }
                  aria-hidden="true"
                />
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
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Last synced {user.gmailLastSyncAt.toLocaleString()}
              </p>
            )}
          </section>

          {/* Bookmarklet */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-medium">Bookmarklet</h2>
              <p className="text-sm text-muted-foreground">
                One-click capture from any job posting. Drag the button to your bookmarks
                bar — page title, URL, and any selected text get pre-filled into a new
                foray.
              </p>
            </div>

            <div className="mt-6 rounded-md border border-border bg-background p-5">
              {bookmarkletUrl ? (
                <a
                  href={bookmarkletUrl}
                  className="inline-flex cursor-move items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  title="Drag this to your bookmark bar"
                >
                  Add to Foray
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    pnpm build:bookmarklet
                  </code>{' '}
                  to generate the bookmarklet.
                </p>
              )}
            </div>

            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Installation</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Drag the button above to your browser&apos;s bookmark bar.</li>
                <li>
                  Or right-click → <em className="not-italic text-foreground">Bookmark
                  This Link</em>, then choose your folder.
                </li>
              </ol>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Click the bookmark while on any job posting. You&apos;ll land on the new
              foray form with everything captured.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
