import Link from 'next/link'

import type { RecruiterListItem } from '../queries'
import { RecruiterForm } from './recruiter-form'

export function RecruiterList({ recruiters }: { recruiters: RecruiterListItem[] }) {
  if (recruiters.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          No recruiters yet. Add one when a person enters a foray.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {recruiters.map((recruiter) => (
        <article
          key={recruiter.id}
          className="rounded-lg border border-border bg-card p-6"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-medium">{recruiter.name}</h2>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {recruiter.email ? <a href={`mailto:${recruiter.email}`}>{recruiter.email}</a> : null}
                {recruiter.phone ? <span>{recruiter.phone}</span> : null}
                {recruiter.linkedinUrl ? (
                  <a href={recruiter.linkedinUrl} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {recruiter.companyName ?? 'Independent'} · {recruiter.applicationCount}{' '}
                {recruiter.applicationCount === 1 ? 'foray' : 'forays'}
              </p>
              {recruiter.notes ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                  {recruiter.notes}
                </p>
              ) : null}
            </div>

            <Link
              href={`/recruiters/${recruiter.id}`}
              className="text-sm text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
            >
              Details
            </Link>
          </div>

          <RecruiterForm mode="edit" recruiter={recruiter} />
        </article>
      ))}
    </div>
  )
}
