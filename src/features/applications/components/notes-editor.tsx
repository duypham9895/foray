'use client'

// Notes editor island (APP-04). Autosave-on-blur via form.requestSubmit() —
// matches CONTEXT §"Specifics" → "Notes field". The service is a no-op on
// blank-to-blank (notes-service.ts), so idle blurs don't write rows.
//
// useActionState gives us the pending flag for the small "Saving…/Saved" hint.

import { useActionState, useRef, useState } from 'react'

import { updateNotesAction, type ActionState } from '../actions'

const initial: ActionState = { ok: true }

export function NotesEditor({
  applicationId,
  initialNotes,
}: {
  applicationId: number
  initialNotes: string
}) {
  const [state, formAction, pending] = useActionState(
    updateNotesAction.bind(null, applicationId),
    initial,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const [touched, setTouched] = useState(false)

  const error = !state.ok ? state.formError : undefined

  const handleBlur = () => {
    if (!touched) return
    formRef.current?.requestSubmit()
    setTouched(false)
  }

  return (
    <form action={formAction} ref={formRef} className="space-y-2">
      <textarea
        name="notes"
        defaultValue={initialNotes}
        rows={4}
        maxLength={10_000}
        placeholder="Add a note about this foray…"
        onChange={() => setTouched(true)}
        onBlur={handleBlur}
        className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
      />
      <div className="text-xs text-stone-500">
        {pending ? 'Saving…' : 'Saved'}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  )
}
