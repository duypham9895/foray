'use client'

import { Unlink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { disconnectCalendar } from '@/features/calendar/actions'

export function DisconnectCalendarButton() {
  const t = useTranslations('settings.calendar')
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => { void disconnectCalendar() })}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Unlink className="size-4" aria-hidden="true" />
      {isPending ? t('disconnecting') : t('disconnect')}
    </button>
  )
}
