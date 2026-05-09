'use client'

// Stage editor island (APP-04). Per CONTEXT §"Specifics" — inline-edit on
// stage name (click to edit, blur saves), three small "Mark passed/failed/no
// response" buttons that submit completeStageAction, and an "Add stage"
// affordance that toggles a small inline form.
//
// Each sub-form gets its own useActionState wrapper for independent submission
// state. Per CLAUDE.md §1.2 the per-row sub-forms intentionally duplicate the
// useActionState scaffolding — extraction would obscure the contract.

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
        <p className="text-sm text-stone-500">No stages yet.</p>
      ) : (
        <ul className="space-y-2">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="rounded border border-stone-200 dark:border-stone-800 px-4 py-3"
            >
              <StageRow applicationId={applicationId} stage={stage} />
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <AddStageForm
          applicationId={applicationId}
          onDone={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm underline text-stone-500 hover:text-stone-700"
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
          // Inline edit per CONTEXT §"Specifics" → "Inline stage edit": blur or
          // Enter saves; Escape cancels without writing. Mirrors the
          // notes-editor.tsx requestSubmit() pattern.
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
              className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-base"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-base text-left flex-1 hover:underline"
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

      <div className="text-xs text-stone-500">
        {stage.scheduledAt
          ? `Scheduled ${format(stage.scheduledAt, 'MMM d, yyyy')}`
          : null}
        {stage.scheduledAt && stage.completedAt ? ' · ' : ''}
        {stage.completedAt
          ? `Completed ${format(stage.completedAt, 'MMM d, yyyy')}`
          : null}
      </div>

      {!stage.completedAt ? (
        <div className="flex flex-wrap gap-2">
          <CompleteButton
            label="Mark passed"
            outcome="passed"
            formAction={completeFormAction}
          />
          <CompleteButton
            label="Mark failed"
            outcome="failed"
            formAction={completeFormAction}
          />
          <CompleteButton
            label="Mark no response"
            outcome="no_response"
            formAction={completeFormAction}
          />
        </div>
      ) : null}

      {updateError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {updateError}
        </p>
      ) : null}
      {completeError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
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
        className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-900"
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
      className="rounded border border-stone-200 dark:border-stone-800 px-4 py-3 space-y-2"
    >
      <div className="space-y-1">
        <label htmlFor="stage-name" className="block text-sm">
          Stage name
        </label>
        <input
          id="stage-name"
          name="name"
          required
          autoFocus
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-base"
        />
        {nameFieldError ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {nameFieldError}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="stage-scheduled" className="block text-sm">
          Scheduled <span className="text-stone-500">(optional)</span>
        </label>
        <input
          id="stage-scheduled"
          name="scheduledAt"
          type="date"
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-base"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-stone-500 hover:text-stone-700 underline"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
