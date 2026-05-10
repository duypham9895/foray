'use client'

import { useTransition } from 'react'

import { syncNow } from '@/features/inbox/actions'

export function SyncNowButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => { void syncNow() })}
      disabled={isPending}
      className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? 'Syncing…' : 'Sync now'}
    </button>
  )
}
