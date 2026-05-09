'use client'

// Status dropdown island (APP-03). Wraps shadcn DropdownMenu and submits via a
// hidden form per status to keep progressive enhancement (no onClick, no
// fetch — formData is the wire format).
//
// Each menu item is itself a tiny <form action={updateStatusAction}> with two
// hidden inputs (applicationId, newStatus). Clicking the item triggers form
// submission natively. useTransition + useActionState would also work, but the
// hidden-form pattern keeps the action graph stupid-simple.

import { useActionState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import type { CanonicalStatus } from '@/generated/prisma/client'

import { updateStatusAction, type ActionState } from '../actions'

const STATUS_LABELS: Record<CanonicalStatus, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const STATUS_DOT_COLOR: Record<CanonicalStatus, string> = {
  applied: 'bg-stone-500',
  screening: 'bg-cyan-600',
  interviewing: 'bg-amber-600',
  offer: 'bg-green-600',
  rejected: 'bg-stone-400',
  withdrawn: 'bg-stone-400',
}

const ALL_STATUSES: CanonicalStatus[] = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

const initial: ActionState = { ok: true }

export function StatusDropdown({
  applicationId,
  currentStatus,
}: {
  applicationId: number
  currentStatus: CanonicalStatus
}) {
  const [state, formAction] = useActionState(updateStatusAction, initial)
  const formError = !state.ok ? state.formError : undefined

  return (
    <div className="space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-900">
          <span className={`inline-block size-2 rounded-full ${STATUS_DOT_COLOR[currentStatus]}`} />
          Change status
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ALL_STATUSES.map((status) => (
            <DropdownMenuItem key={status} asChild disabled={status === currentStatus}>
              <form action={formAction}>
                <input type="hidden" name="applicationId" value={applicationId} />
                <input type="hidden" name="newStatus" value={status} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className={`inline-block size-2 rounded-full ${STATUS_DOT_COLOR[status]}`} />
                  {STATUS_LABELS[status]}
                </button>
              </form>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {formError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </p>
      ) : null}
    </div>
  )
}
