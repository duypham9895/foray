'use client'

import { useTransition } from 'react'

import { disconnectGmail } from '@/features/inbox/actions'

export function DisconnectGmailButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => { void disconnectGmail() })}
      disabled={isPending}
      className="inline-flex items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? 'Disconnecting...' : 'Disconnect'}
    </button>
  )
}
