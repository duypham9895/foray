import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { RecruiterForm } from '@/features/recruiters/components/recruiter-form'
import { RecruiterList } from '@/features/recruiters/components/recruiter-list'
import { findRecruitersForList } from '@/features/recruiters/queries'

export default async function RecruitersPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const recruitersResult = await findRecruitersForList(userResult.value.id)

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight">Recruiters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People attached to your forays, from recruiters to hiring managers.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            {recruitersResult.isErr() ? (
              <p className="text-sm text-muted-foreground">
                Could not load recruiters. Try refreshing.
              </p>
            ) : (
              <RecruiterList recruiters={recruitersResult.value} />
            )}
          </section>

          <aside className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-8 lg:self-start">
            <h2 className="text-xl font-medium">Add recruiter</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a contact once, then link them to any foray.
            </p>
            <div className="mt-5">
              <RecruiterForm mode="create" />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
