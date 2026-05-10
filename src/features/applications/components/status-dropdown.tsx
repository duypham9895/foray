'use client'

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
  applied: 'bg-status-applied',
  screening: 'bg-status-screening',
  interviewing: 'bg-status-interviewing',
  offer: 'bg-status-offer',
  rejected: 'bg-status-closed',
  withdrawn: 'bg-status-closed',
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
        <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">
          <span className={`inline-block size-2 rounded-full ${STATUS_DOT_COLOR[currentStatus]}`} />
          Change status
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ALL_STATUSES.map((status) => (
            <DropdownMenuItem key={status} asChild disabled={status === currentStatus}>
              <form action={formAction}>
                <input type="hidden" name="applicationId" value={applicationId} />
                <input type="hidden" name="newStatus" value={status} />
                <button type="submit" className="flex w-full items-center gap-2 text-left">
                  <span
                    className={`inline-block size-2 rounded-full ${STATUS_DOT_COLOR[status]}`}
                  />
                  {STATUS_LABELS[status]}
                </button>
              </form>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}
    </div>
  )
}
