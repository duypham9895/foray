'use client'

import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/ui/button'

import { createApplicationAction, type ActionState } from '../actions'

interface PrefillData {
  companyName?: string
  companyDomain?: string
  roleTitle?: string
  roleUrl?: string
  notes?: string
}

function decodePrefill(searchParams: URLSearchParams): PrefillData {
  const encoded = searchParams.get('prefilled')
  if (!encoded) return {}
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64)
    return JSON.parse(json) as PrefillData
  } catch {
    return {}
  }
}

const initial: ActionState = { ok: true }
const today = () => new Date().toISOString().slice(0, 10)

function fieldError(state: ActionState, name: string): string | undefined {
  if (state.ok) return undefined
  return state.errors[name]?.[0]
}

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20'

const labelClass = 'block text-sm text-muted-foreground'
const optionalClass = 'text-muted-foreground/60'
const errorClass = 'text-xs text-destructive mt-1'

export function NewApplicationForm({
  companies,
}: {
  companies: ReadonlyArray<{ id: number; name: string }>
}) {
  const searchParams = useSearchParams()
  const prefill = decodePrefill(searchParams)
  const [state, formAction, pending] = useActionState(createApplicationAction, initial)
  const [showSalary, setShowSalary] = useState(false)

  const formError = !state.ok ? state.formError : undefined

  return (
    <form action={formAction} className="space-y-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="companyName" className={labelClass}>
          Company
        </label>
        <input
          id="companyName"
          name="companyName"
          list="company-names"
          required
          autoComplete="off"
          defaultValue={prefill.companyName ?? ''}
          aria-invalid={!!fieldError(state, 'companyName')}
          className={inputClass}
        />
        <datalist id="company-names">
          {companies.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {fieldError(state, 'companyName') ? (
          <p role="alert" className={errorClass}>
            {fieldError(state, 'companyName')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="companyDomain" className={labelClass}>
          Company domain <span className={optionalClass}>(optional)</span>
        </label>
        <input
          id="companyDomain"
          name="companyDomain"
          placeholder="stripe.com"
          defaultValue={prefill.companyDomain ?? ''}
          aria-invalid={!!fieldError(state, 'companyDomain')}
          className={inputClass}
        />
        {fieldError(state, 'companyDomain') ? (
          <p role="alert" className={errorClass}>
            {fieldError(state, 'companyDomain')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="roleTitle" className={labelClass}>
          Role title
        </label>
        <input
          id="roleTitle"
          name="roleTitle"
          required
          maxLength={160}
          defaultValue={prefill.roleTitle ?? ''}
          aria-invalid={!!fieldError(state, 'roleTitle')}
          className={inputClass}
        />
        {fieldError(state, 'roleTitle') ? (
          <p role="alert" className={errorClass}>
            {fieldError(state, 'roleTitle')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="roleUrl" className={labelClass}>
          Role URL <span className={optionalClass}>(optional)</span>
        </label>
        <input
          id="roleUrl"
          name="roleUrl"
          type="url"
          defaultValue={prefill.roleUrl ?? ''}
          aria-invalid={!!fieldError(state, 'roleUrl')}
          className={inputClass}
        />
        {fieldError(state, 'roleUrl') ? (
          <p role="alert" className={errorClass}>
            {fieldError(state, 'roleUrl')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="jobDescription" className={labelClass}>
          Job description <span className={optionalClass}>(optional)</span>
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={4}
          className={inputClass}
        />
        {fieldError(state, 'jobDescription') ? (
          <p role="alert" className={errorClass}>
            {fieldError(state, 'jobDescription')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="location" className={labelClass}>
          Location <span className={optionalClass}>(optional)</span>
        </label>
        <input
          id="location"
          name="location"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="source" className={labelClass}>
          Source
        </label>
        <select
          id="source"
          name="source"
          defaultValue="other"
          className={inputClass}
        >
          <option value="linkedin">LinkedIn</option>
          <option value="company">Company website</option>
          <option value="direct">Direct</option>
          <option value="referral">Referral</option>
          <option value="recruiter">Recruiter</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="appliedAt" className={labelClass}>
          Applied date
        </label>
        <input
          id="appliedAt"
          name="appliedAt"
          type="date"
          defaultValue={today()}
          className={inputClass}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowSalary((v) => !v)}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition"
        >
          {showSalary ? 'Hide salary' : 'Show salary'}
        </button>
      </div>

      {showSalary ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="salaryMin" className={labelClass}>
              Min
            </label>
            <input
              id="salaryMin"
              name="salaryMin"
              type="number"
              min={0}
              className={inputClass}
            />
            {fieldError(state, 'salaryMin') ? (
              <p role="alert" className={errorClass}>
                {fieldError(state, 'salaryMin')}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="salaryMax" className={labelClass}>
              Max
            </label>
            <input
              id="salaryMax"
              name="salaryMax"
              type="number"
              min={0}
              className={inputClass}
            />
            {fieldError(state, 'salaryMax') ? (
              <p role="alert" className={errorClass}>
                {fieldError(state, 'salaryMax')}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="salaryCurrency" className={labelClass}>
              Currency
            </label>
            <input
              id="salaryCurrency"
              name="salaryCurrency"
              maxLength={8}
              placeholder="USD"
              className={inputClass}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="notes" className={labelClass}>
          Notes <span className={optionalClass}>(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Add a note about this foray…"
          defaultValue={prefill.notes ?? ''}
          className={inputClass}
        />
        {fieldError(state, 'notes') ? (
          <p role="alert" className={errorClass}>
            {fieldError(state, 'notes')}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save foray'}
      </Button>
    </form>
  )
}
