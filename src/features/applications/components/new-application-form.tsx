'use client'

// Capture form (CAPT-01 + CAPT-02). React 19 useActionState pattern, matching
// src/features/auth/components/login-form.tsx. Per-field error rendering reads
// state.errors[fieldName]?.[0] in line with PRINCIPLES.md §"Forms — useActionState
// pattern".
//
// Salary fields collapsed by default behind a "Show salary" toggle to keep the
// form short — supports the <30s capture target (CONTEXT §"Specifics" / CAPT-01).
//
// Company autocomplete uses a native <datalist> populated server-side from the
// page's withRls company.findMany call (CONTEXT §"Claude's Discretion" — datalist
// over combobox for Lean).

import { useActionState, useState } from 'react'

import { Button } from '@/ui/button'

import { createApplicationAction, type ActionState } from '../actions'

const initial: ActionState = { ok: true }

const today = () => new Date().toISOString().slice(0, 10)

function fieldError(state: ActionState, name: string): string | undefined {
  if (state.ok) return undefined
  return state.errors[name]?.[0]
}

export function NewApplicationForm({
  companies,
}: {
  companies: ReadonlyArray<{ id: number; name: string }>
}) {
  const [state, formAction, pending] = useActionState(createApplicationAction, initial)
  const [showSalary, setShowSalary] = useState(false)

  const formError = !state.ok ? state.formError : undefined

  return (
    <form action={formAction} className="space-y-4">
      {formError ? (
        <p
          role="alert"
          className="text-sm text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded px-3 py-2"
        >
          {formError}
        </p>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="companyName" className="block text-sm">
          Company
        </label>
        <input
          id="companyName"
          name="companyName"
          list="company-names"
          required
          autoComplete="off"
          aria-invalid={!!fieldError(state, 'companyName')}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
        <datalist id="company-names">
          {companies.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {fieldError(state, 'companyName') ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
            {fieldError(state, 'companyName')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="companyDomain" className="block text-sm">
          Company domain <span className="text-stone-500">(optional)</span>
        </label>
        <input
          id="companyDomain"
          name="companyDomain"
          placeholder="stripe.com"
          aria-invalid={!!fieldError(state, 'companyDomain')}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
        {fieldError(state, 'companyDomain') ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
            {fieldError(state, 'companyDomain')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="roleTitle" className="block text-sm">
          Role title
        </label>
        <input
          id="roleTitle"
          name="roleTitle"
          required
          maxLength={160}
          aria-invalid={!!fieldError(state, 'roleTitle')}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
        {fieldError(state, 'roleTitle') ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
            {fieldError(state, 'roleTitle')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="roleUrl" className="block text-sm">
          Role URL <span className="text-stone-500">(optional)</span>
        </label>
        <input
          id="roleUrl"
          name="roleUrl"
          type="url"
          aria-invalid={!!fieldError(state, 'roleUrl')}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
        {fieldError(state, 'roleUrl') ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
            {fieldError(state, 'roleUrl')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="jobDescription" className="block text-sm">
          Job description <span className="text-stone-500">(optional)</span>
        </label>
        <textarea
          id="jobDescription"
          name="jobDescription"
          rows={4}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
        {fieldError(state, 'jobDescription') ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
            {fieldError(state, 'jobDescription')}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="location" className="block text-sm">
          Location <span className="text-stone-500">(optional)</span>
        </label>
        <input
          id="location"
          name="location"
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="source" className="block text-sm">
          Source
        </label>
        <select
          id="source"
          name="source"
          defaultValue="other"
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="direct">Direct</option>
          <option value="referral">Referral</option>
          <option value="recruiter">Recruiter</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="appliedAt" className="block text-sm">
          Applied date
        </label>
        <input
          id="appliedAt"
          name="appliedAt"
          type="date"
          defaultValue={today()}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowSalary((v) => !v)}
          className="text-sm text-stone-500 hover:text-stone-700 underline"
        >
          {showSalary ? 'Hide salary' : 'Show salary'}
        </button>
      </div>
      {showSalary ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label htmlFor="salaryMin" className="block text-sm">
              Min
            </label>
            <input
              id="salaryMin"
              name="salaryMin"
              type="number"
              min={0}
              className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
            />
            {fieldError(state, 'salaryMin') ? (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
                {fieldError(state, 'salaryMin')}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="salaryMax" className="block text-sm">
              Max
            </label>
            <input
              id="salaryMax"
              name="salaryMax"
              type="number"
              min={0}
              className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
            />
            {fieldError(state, 'salaryMax') ? (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
                {fieldError(state, 'salaryMax')}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="salaryCurrency" className="block text-sm">
              Currency
            </label>
            <input
              id="salaryCurrency"
              name="salaryCurrency"
              maxLength={8}
              placeholder="USD"
              className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="notes" className="block text-sm">
          Notes <span className="text-stone-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Add a note about this foray…"
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-base"
        />
        {fieldError(state, 'notes') ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 mt-1">
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
