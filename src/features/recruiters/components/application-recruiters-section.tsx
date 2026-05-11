'use client'

import { useActionState } from 'react'

import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

import {
  linkRecruiterAction,
  unlinkRecruiterAction,
  type RecruiterActionState,
} from '../actions'

type LinkedRecruiter = {
  id: number
  name: string
  email: string | null
  linkedinUrl: string | null
  phone: string | null
  role: string | null
  companyName: string | null
}

type RecruiterOption = {
  id: number
  name: string
  email: string | null
  companyName: string | null
}

const initialState: RecruiterActionState = { ok: true }

export function ApplicationRecruitersSection({
  applicationId,
  recruiters,
  recruiterOptions,
}: {
  applicationId: number
  recruiters: LinkedRecruiter[]
  recruiterOptions: RecruiterOption[]
}) {
  const [state, formAction, pending] = useActionState(
    linkRecruiterAction.bind(null, applicationId),
    initialState,
  )

  return (
    <div className="space-y-4">
      {recruiters.length > 0 ? (
        <ul className="space-y-2">
          {recruiters.map((recruiter) => (
            <li
              key={recruiter.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{recruiter.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recruiter.role ?? 'Recruiter'}
                    {recruiter.companyName ? ` · ${recruiter.companyName}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {recruiter.email ? <a href={`mailto:${recruiter.email}`}>{recruiter.email}</a> : null}
                    {recruiter.phone ? <span>{recruiter.phone}</span> : null}
                    {recruiter.linkedinUrl ? (
                      <a href={recruiter.linkedinUrl} target="_blank" rel="noreferrer">
                        LinkedIn
                      </a>
                    ) : null}
                  </div>
                </div>

                <form action={unlinkRecruiterAction.bind(null, applicationId, recruiter.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Unlink
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No recruiters linked yet.
        </p>
      )}

      <form action={formAction} className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`recruiter-${applicationId}`}>Existing recruiter</Label>
            <select
              id={`recruiter-${applicationId}`}
              name="recruiterId"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              defaultValue=""
            >
              <option value="">Create or match by email</option>
              {recruiterOptions.map((recruiter) => (
                <option key={recruiter.id} value={recruiter.id}>
                  {recruiter.name}
                  {recruiter.email ? ` · ${recruiter.email}` : ''}
                </option>
              ))}
            </select>
          </div>

          <Field
            id={`recruiter-role-${applicationId}`}
            name="role"
            label="Role"
            placeholder="Recruiter, Hiring Manager, Founder"
            error={!state.ok ? state.errors.role?.[0] : undefined}
          />
          <Field
            id={`recruiter-name-${applicationId}`}
            name="name"
            label="Name"
            error={!state.ok ? state.errors.name?.[0] : undefined}
          />
          <Field
            id={`recruiter-email-${applicationId}`}
            name="email"
            label="Email"
            type="email"
            list={`recruiter-email-options-${applicationId}`}
            error={!state.ok ? state.errors.email?.[0] : undefined}
          />
          <Field
            id={`recruiter-linkedin-${applicationId}`}
            name="linkedinUrl"
            label="LinkedIn URL"
            type="url"
            error={!state.ok ? state.errors.linkedinUrl?.[0] : undefined}
          />
        </div>

        <datalist id={`recruiter-email-options-${applicationId}`}>
          {recruiterOptions
            .filter((recruiter) => recruiter.email)
            .map((recruiter) => (
              <option key={recruiter.id} value={recruiter.email ?? ''}>
                {recruiter.name}
              </option>
            ))}
        </datalist>

        {!state.ok && state.formError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {state.formError}
          </p>
        ) : null}

        <Button type="submit" className="mt-4" disabled={pending}>
          {pending ? 'Linking...' : 'Link recruiter'}
        </Button>
      </form>
    </div>
  )
}

function Field({
  id,
  name,
  label,
  type = 'text',
  list,
  placeholder,
  error,
}: {
  id: string
  name: string
  label: string
  type?: string
  list?: string
  placeholder?: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        list={list}
        placeholder={placeholder}
        aria-invalid={!!error}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
