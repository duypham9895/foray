'use client'

import { CalendarPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function ConnectCalendarButton() {
  const t = useTranslations('settings.calendar')
  return (
    <a
      href="/api/calendar/auth"
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
    >
      <CalendarPlus className="size-4" aria-hidden="true" />
      {t('connect')}
    </a>
  )
}
