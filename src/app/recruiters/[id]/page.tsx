import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { RecruiterId } from '@/core/types/ids'
import { RecruiterForm } from '@/features/recruiters/components/recruiter-form'
import { findRecruiterDetail } from '@/features/recruiters/queries'

export default async function RecruiterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const { id } = await params
  const result = await findRecruiterDetail(userResult.value.id, RecruiterId(id))
  if (result.isErr()) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 lg:px-10 lg:py-14">
          <Link
            href="/recruiters"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Recruiters
          </Link>
          <p className="text-sm text-muted-foreground">Could not load this recruiter.</p>
        </div>
      </AppShell>
    )
  }
  if (!result.value) notFound()

  const recruiter = result.value

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-10 lg:py-14">
        <Link
          href="/recruiters"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Recruiters
        </Link>

        <header>
          <h1 className="text-3xl font-medium tracking-tight">{recruiter.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {recruiter.email ? <a href={`mailto:${recruiter.email}`}>{recruiter.email}</a> : null}
            {recruiter.phone ? <span>{recruiter.phone}</span> : null}
            {recruiter.linkedinUrl ? (
              <a href={recruiter.linkedinUrl} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            ) : null}
          </div>
        </header>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Edit contact</h2>
          <div className="mt-5">
            <RecruiterForm mode="edit" recruiter={recruiter} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-medium">Linked forays</h2>
          {recruiter.applications.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Not linked to a foray yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recruiter.applications.map((link) => (
                <li
                  key={link.applicationId}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <Link
                    href={`/applications/${link.applicationId}`}
                    className="font-medium transition hover:text-muted-foreground"
                  >
                    {link.roleTitle}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {link.companyName}
                    {link.role ? ` · ${link.role}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}
