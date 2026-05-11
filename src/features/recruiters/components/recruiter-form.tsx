'use client'

import { useActionState } from 'react'

import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

import {
  createRecruiterAction,
  updateRecruiterAction,
  type RecruiterActionState,
} from '../actions'

type RecruiterFormValue = {
  id?: number
  name?: string
  email?: string | null
  linkedinUrl?: string | null
  phone?: string | null
  notes?: string | null
}

const initialState: RecruiterActionState = { ok: true }

export function RecruiterForm({
  recruiter,
  mode,
}: {
  recruiter?: RecruiterFormValue
  mode: 'create' | 'edit'
}) {
  const action = mode === 'edit' && recruiter?.id
    ? updateRecruiterAction.bind(null, recruiter.id)
    : createRecruiterAction
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${mode}-${recruiter?.id ?? 'new'}-name`}
          name="name"
          label="Name"
          defaultValue={recruiter?.name ?? ''}
          error={!state.ok ? state.errors.name?.[0] : undefined}
          required
        />
        <Field
          id={`${mode}-${recruiter?.id ?? 'new'}-email`}
          name="email"
          label="Email"
          type="email"
          defaultValue={recruiter?.email ?? ''}
          error={!state.ok ? state.errors.email?.[0] : undefined}
        />
        <Field
          id={`${mode}-${recruiter?.id ?? 'new'}-linkedin`}
          name="linkedinUrl"
          label="LinkedIn URL"
          type="url"
          defaultValue={recruiter?.linkedinUrl ?? ''}
          error={!state.ok ? state.errors.linkedinUrl?.[0] : undefined}
        />
        <Field
          id={`${mode}-${recruiter?.id ?? 'new'}-phone`}
          name="phone"
          label="Phone"
          defaultValue={recruiter?.phone ?? ''}
          error={!state.ok ? state.errors.phone?.[0] : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${mode}-${recruiter?.id ?? 'new'}-notes`}>Notes</Label>
        <textarea
          id={`${mode}-${recruiter?.id ?? 'new'}-notes`}
          name="notes"
          defaultValue={recruiter?.notes ?? ''}
          className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {!state.ok && state.errors.notes?.[0] ? (
          <p className="text-sm text-destructive">{state.errors.notes[0]}</p>
        ) : null}
      </div>

      {!state.ok && state.formError ? (
        <p role="alert" className="text-sm text-destructive">{state.formError}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : mode === 'create' ? 'Create recruiter' : 'Save recruiter'}
      </Button>
    </form>
  )
}

function Field({
  id,
  name,
  label,
  type = 'text',
  defaultValue,
  error,
  required = false,
}: {
  id: string
  name: string
  label: string
  type?: string
  defaultValue: string
  error?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={!!error}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
