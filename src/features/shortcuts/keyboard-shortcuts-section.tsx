'use client'

import { useTranslations } from 'next-intl'

import { SHORTCUTS } from './shortcuts'

/** Keyboard shortcuts documentation for the Settings page. */
export function KeyboardShortcutsSection() {
  const t = useTranslations('settings.shortcuts')

  const singleKeyShortcuts = [
    { id: 'newForay', ...SHORTCUTS.newApp },
    { id: 'search', ...SHORTCUTS.search },
  ]

  const comboShortcuts = [
    { id: 'goForays', ...SHORTCUTS.goApps },
    { id: 'goInbox', ...SHORTCUTS.goInbox },
    { id: 'goSettings', ...SHORTCUTS.goSettings },
  ]

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </div>

      <div className="mt-6 space-y-5">
        {/* Single-key shortcuts */}
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('singleKey')}
          </h3>
          <div className="space-y-1.5">
            {singleKeyShortcuts.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs text-foreground">
                  {s.key}
                </kbd>
                <span>{t(s.id as 'newForay' | 'search')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Combo shortcuts */}
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('combo')}
          </h3>
          <div className="space-y-1.5">
            {comboShortcuts.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 text-sm">
                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs text-foreground">
                  {s.key}
                </kbd>
                <span className="text-muted-foreground">+</span>
                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs text-foreground">
                  {s.secondKey}
                </kbd>
                <span className="ml-1.5">
                  {t(s.id as 'goForays' | 'goInbox' | 'goSettings')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
