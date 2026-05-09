'use client'

import { useTransition } from 'react'

import { syncNow } from '@/features/inbox/actions'

export function SyncNowButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => { void syncNow() })}
      disabled={isPending}
      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? 'Syncing...' : 'Sync now'}
    </button>
  )
}
