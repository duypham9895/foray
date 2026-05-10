import fs from 'node:fs'
import path from 'node:path'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { LanguagePicker } from '@/components/language-picker'
import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'
import { ConnectGmailButton } from '@/features/inbox/components/connect-gmail-button'
import { DisconnectGmailButton } from '@/features/inbox/components/disconnect-gmail-button'
import { SyncNowButton } from '@/features/inbox/components/sync-now-button'
import { TokenHealthBanner } from '@/features/inbox/components/token-health-banner'
import { KeyboardShortcutsSection } from '@/features/shortcuts/keyboard-shortcuts-section'

const MS_PER_DAY = 1000 * 60 * 60 * 24

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
  const t = await getTranslations('settings')

  const user = await tenantDb(userId).user.findUnique({
    where: { id: Number(userId) },
    select: {
      gmailRefreshTokenEncrypted: true,
      gmailLastSyncAt: true,
    },
  })

  const isConnected = !!user?.gmailRefreshTokenEncrypted
  const bookmarkletUrl = getBookmarkletUrl()
  const daysSinceSync = user?.gmailLastSyncAt
    ? Math.floor((new Date().getTime() - user.gmailLastSyncAt.getTime()) / MS_PER_DAY)
    : null

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-10">
          <h1 className="text-3xl font-medium tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        <div className="space-y-6">
          {/* Gmail */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-medium">{t('gmail.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('gmail.intro')}</p>
            </div>

            <div className="mt-4">
              <TokenHealthBanner daysSinceSync={daysSinceSync} />
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
                {isConnected ? t('gmail.connected') : t('gmail.disconnected')}
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
                {t('gmail.lastSynced', { date: user.gmailLastSyncAt.toLocaleString() })}
              </p>
            )}
          </section>

          {/* Bookmarklet */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-medium">{t('bookmarklet.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('bookmarklet.intro')}</p>
            </div>

            <div className="mt-6 rounded-md border border-border bg-background p-5">
              {bookmarkletUrl ? (
                <a
                  href={bookmarkletUrl}
                  className="inline-flex cursor-move items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  title="Drag this to your bookmark bar"
                >
                  {t('bookmarklet.addButton')}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.rich('bookmarklet.notBuilt', {
                    code: (chunks) => (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {chunks}
                      </code>
                    ),
                  })}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t('bookmarklet.installation')}</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>{t('bookmarklet.step1')}</li>
                <li>
                  {t.rich('bookmarklet.step2', {
                    em: (chunks) => (
                      <em className="not-italic text-foreground">{chunks}</em>
                    ),
                  })}
                </li>
              </ol>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{t('bookmarklet.usage')}</p>
          </section>

          {/* Language */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-medium">{t('language.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('language.intro')}</p>
            </div>
            <div className="mt-6">
              <LanguagePicker />
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <KeyboardShortcutsSection />
        </div>
      </div>
    </AppShell>
  )
}
