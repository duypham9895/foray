'use client'

import { useTranslations } from 'next-intl'

export function ConnectGmailButton() {
  const t = useTranslations('settings.gmail')
  return (
    <a
      href="/api/gmail/auth"
      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
    >
      {t('connect')}
    </a>
  )
}
