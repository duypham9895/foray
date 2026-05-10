'use client'

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
  const [savedOnce, setSavedOnce] = useState(false)

  const error = !state.ok ? state.formError : undefined

  const handleBlur = () => {
    if (!touched) return
    formRef.current?.requestSubmit()
    setTouched(false)
    setSavedOnce(true)
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
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/50"
      />
      {(pending || savedOnce) ? (
        <p className="text-xs text-muted-foreground/60">
          {pending ? 'Saving…' : 'Saved'}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
