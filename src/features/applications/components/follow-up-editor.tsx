'use client'

// Follow-up editor island (REMIND-01). Three states:
//   1. Display (no follow-up): shows "No follow-up set" + "Set follow-up" button
//   2. Display (follow-up set): shows "Follow-up: {MMM d}" + Edit / Clear buttons
//   3. Editing: quick-set buttons (Tomorrow, Next week, Next month) + date picker + Save/Cancel
//
// Quick-set buttons call setFollowUpAction immediately (no separate save step).
// Uses useActionState with .bind(null, applicationId) pattern, same as StageEditor.

import { useActionState, useState } from 'react'
import { format, addDays, addMonths } from 'date-fns'

import { Button } from '@/ui/button'

import {
  setFollowUpAction,
  clearFollowUpAction,
  type ActionState,
} from '../actions'

const initial: ActionState = { ok: true }

export function FollowUpEditor({
  applicationId,
  followUpAt,
}: {
  applicationId: number
  followUpAt: Date | null
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <EditingState
        applicationId={applicationId}
        initialDate={followUpAt}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    )
  }

  if (followUpAt) {
    return (
      <DisplayStateSet
        applicationId={applicationId}
        followUpAt={followUpAt}
        onEdit={() => setEditing(true)}
      />
    )
  }

  return (
    <DisplayStateEmpty onSet={() => setEditing(true)} />
  )
}

// ---------------------------------------------------------------------------
// Display state — no follow-up set
// ---------------------------------------------------------------------------

function DisplayStateEmpty({ onSet }: { onSet: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-500">No follow-up set</p>
      <button
        type="button"
        onClick={onSet}
        className="text-sm underline text-stone-500 hover:text-stone-700"
      >
        Set follow-up
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Display state — follow-up set
// ---------------------------------------------------------------------------

function DisplayStateSet({
  applicationId,
  followUpAt,
  onEdit,
}: {
  applicationId: number
  followUpAt: Date
  onEdit: () => void
}) {
  const [clearState, clearAction] = useActionState(
    clearFollowUpAction.bind(null, applicationId),
    initial,
  )

  const clearError = !clearState.ok ? clearState.formError : undefined

  return (
    <div className="space-y-2">
      <p className="text-base">
        Follow-up: {format(followUpAt, 'MMM d')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm underline text-stone-500 hover:text-stone-700"
        >
          Edit
        </button>
        <form action={clearAction}>
          <button
            type="submit"
            aria-label="Clear follow-up date"
            className="text-sm underline text-stone-500 hover:text-stone-700"
          >
            Clear
          </button>
        </form>
      </div>
      {clearError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {clearError}
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editing state — quick-set buttons + date picker
// ---------------------------------------------------------------------------

function EditingState({
  applicationId,
  initialDate,
  onCancel,
  onSaved,
}: {
  applicationId: number
  initialDate: Date | null
  onCancel: () => void
  onSaved: () => void
}) {
  const now = new Date()
  const quickSets = [
    { label: 'Tomorrow', date: addDays(now, 1) },
    { label: 'Next week', date: addDays(now, 7) },
    { label: 'Next month', date: addMonths(now, 1) },
  ]

  const [setState, setAction, setPending] = useActionState(
    async (_prev: ActionState, formData: FormData) => {
      const result = await setFollowUpAction(applicationId, _prev, formData)
      if (result.ok) onSaved()
      return result
    },
    initial,
  )

  const setError = !setState.ok ? setState.formError : undefined

  const handleQuickSet = (date: Date) => {
    const fd = new FormData()
    fd.set('followUpAt', date.toISOString())
    setAction(fd)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {quickSets.map((qs) => (
          <button
            key={qs.label}
            type="button"
            aria-label={`Set follow-up to ${format(qs.date, 'MMMM d, yyyy')}`}
            onClick={() => handleQuickSet(qs.date)}
            disabled={setPending}
            className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-900 disabled:opacity-50"
          >
            {qs.label}
          </button>
        ))}
      </div>

      <form action={setAction} className="space-y-2">
        <div className="space-y-1">
          <label htmlFor="follow-up-date" className="block text-sm">
            Pick a date
          </label>
          <input
            id="follow-up-date"
            name="followUpAt"
            type="date"
            defaultValue={
              initialDate
                ? format(initialDate, 'yyyy-MM-dd')
                : undefined
            }
            className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-base"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={setPending}>
            {setPending ? 'Saving...' : 'Save'}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-stone-500 hover:text-stone-700 underline"
          >
            Cancel
          </button>
        </div>
      </form>

      {setError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {setError}
        </p>
      ) : null}
    </div>
  )
}
