'use client'

import { useActionState, useRef, useState } from 'react'
import { format } from 'date-fns'

import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import type { Stage } from '@/generated/prisma/client'

import {
  addStageAction,
  completeStageAction,
  updateStageAction,
  type ActionState,
} from '../actions'

const initial: ActionState = { ok: true }

const inputClass =
  'w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20'

export function StageEditor({
  applicationId,
  stages,
}: {
  applicationId: number
  stages: Stage[]
}) {
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-3">
      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stages yet.</p>
      ) : (
        <ul className="space-y-2">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="rounded-md border border-border bg-card/40 px-4 py-3"
            >
              <StageRow applicationId={applicationId} stage={stage} />
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <AddStageForm applicationId={applicationId} onDone={() => setShowAdd(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition"
        >
          Add stage
        </button>
      )}
    </div>
  )
}

function StageRow({
  applicationId,
  stage,
}: {
  applicationId: number
  stage: Stage
}) {
  const [editing, setEditing] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [updateState, updateFormAction] = useActionState(
    updateStageAction.bind(null, stage.id, applicationId),
    initial,
  )
  const [completeState, completeFormAction] = useActionState(
    completeStageAction.bind(null, stage.id, applicationId),
    initial,
  )

  const updateError = !updateState.ok ? updateState.formError : undefined
  const completeError = !completeState.ok ? completeState.formError : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <form
            ref={formRef}
            action={(fd: FormData) => {
              updateFormAction(fd)
              setEditing(false)
            }}
            className="flex-1"
          >
            <input
              name="name"
              defaultValue={stage.name}
              autoFocus
              required
              onBlur={() => formRef.current?.requestSubmit()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false)
              }}
              className={inputClass}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-sm text-foreground hover:underline underline-offset-4"
          >
            {stage.name}
          </button>
        )}
        {stage.outcome ? (
          <Badge variant="secondary">
            {stage.outcome === 'no_response' ? 'no response' : stage.outcome}
          </Badge>
        ) : null}
      </div>

      <div className="text-xs text-muted-foreground">
        {stage.scheduledAt ? `Scheduled ${format(stage.scheduledAt, 'MMM d, yyyy')}` : null}
        {stage.scheduledAt && stage.completedAt ? ' · ' : ''}
        {stage.completedAt ? `Completed ${format(stage.completedAt, 'MMM d, yyyy')}` : null}
      </div>

      {!stage.completedAt ? (
        <div className="flex flex-wrap gap-2">
          <CompleteButton label="Mark passed" outcome="passed" formAction={completeFormAction} />
          <CompleteButton label="Mark failed" outcome="failed" formAction={completeFormAction} />
          <CompleteButton
            label="Mark no response"
            outcome="no_response"
            formAction={completeFormAction}
          />
        </div>
      ) : null}

      {updateError ? (
        <p role="alert" className="text-xs text-destructive">
          {updateError}
        </p>
      ) : null}
      {completeError ? (
        <p role="alert" className="text-xs text-destructive">
          {completeError}
        </p>
      ) : null}
    </div>
  )
}

function CompleteButton({
  label,
  outcome,
  formAction,
}: {
  label: string
  outcome: 'passed' | 'failed' | 'no_response'
  formAction: (formData: FormData) => void
}) {
  return (
    <form action={formAction}>
      <input type="hidden" name="outcome" value={outcome} />
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        {label}
      </button>
    </form>
  )
}

function AddStageForm({
  applicationId,
  onDone,
}: {
  applicationId: number
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(
    addStageAction.bind(null, applicationId),
    initial,
  )
  const error = !state.ok ? state.formError : undefined
  const nameFieldError = !state.ok ? state.errors.name?.[0] : undefined

  return (
    <form
      action={(fd: FormData) => {
        formAction(fd)
        onDone()
      }}
      className="space-y-3 rounded-md border border-border bg-card/40 px-4 py-3"
    >
      <div className="space-y-1.5">
        <label htmlFor="stage-name" className="block text-sm text-muted-foreground">
          Stage name
        </label>
        <input
          id="stage-name"
          name="name"
          required
          autoFocus
          className={inputClass}
        />
        {nameFieldError ? (
          <p role="alert" className="text-xs text-destructive">
            {nameFieldError}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="stage-scheduled" className="block text-sm text-muted-foreground">
          Scheduled{' '}
          <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <input
          id="stage-scheduled"
          name="scheduledAt"
          type="date"
          className={inputClass}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Adding…' : 'Add'}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
