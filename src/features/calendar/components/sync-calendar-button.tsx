'use client'

import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { syncCalendarNow } from '@/features/calendar/actions'

export function SyncCalendarButton() {
  const t = useTranslations('settings.calendar')
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => { void syncCalendarNow() })}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={isPending ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
      {isPending ? t('syncing') : t('syncNow')}
    </button>
  )
}
