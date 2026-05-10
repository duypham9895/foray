'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { disconnectGmail } from '@/features/inbox/actions'

export function DisconnectGmailButton() {
  const t = useTranslations('settings.gmail')
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => { void disconnectGmail() })}
      disabled={isPending}
      className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? t('disconnecting') : t('disconnect')}
    </button>
  )
}
