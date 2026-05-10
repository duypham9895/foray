import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { fullTextSearch } from '@/core/queries/search'
import { UserId } from '@/core/types/ids'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = UserId(userResult.value.id)

  const params = await searchParams
  const query = params.q?.trim() ?? ''

  const results = query
    ? await fullTextSearch(userId, query)
    : null

  const hasResults =
    results &&
    results.isOk() &&
    (results.value.applications.length > 0 ||
      results.value.emails.length > 0 ||
      results.value.stages.length > 0)

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight">Search</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find forays, emails, and stages across your campaign
          </p>
        </header>

        <form method="get" action="/search" className="mb-8">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search applications, companies, emails..."
            autoFocus
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>

        {results?.isOk() && query && (
          <div className="space-y-8">
            {/* Applications */}
            {results.value.applications.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">
                  Applications
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({results.value.applications.length})
                  </span>
                </h2>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {results.value.applications.map((app) => (
                    <li key={app.id}>
                      <a
                        href={`/applications/${app.id}`}
                        className="flex items-center justify-between px-4 py-3 transition hover:bg-accent"
                      >
                        <div>
                          <span className="font-medium">{app.roleTitle}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            at {app.companyName}
                          </span>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs capitalize">
                          {app.canonicalStatus}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Emails */}
            {results.value.emails.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">
                  Emails
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({results.value.emails.length})
                  </span>
                </h2>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {results.value.emails.map((email) => (
                    <li key={email.id}>
                      <a
                        href={
                          email.applicationId
                            ? `/applications/${email.applicationId}`
                            : '#'
                        }
                        className="flex items-center justify-between px-4 py-3 transition hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{email.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            from {email.from}
                          </p>
                        </div>
                        <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                          {new Date(email.receivedAt).toLocaleDateString()}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Stages */}
            {results.value.stages.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">
                  Stages
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({results.value.stages.length})
                  </span>
                </h2>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {results.value.stages.map((stage) => (
                    <li key={stage.id}>
                      <a
                        href={`/applications/${stage.applicationId}`}
                        className="flex items-center justify-between px-4 py-3 transition hover:bg-accent"
                      >
                        <div>
                          <span className="font-medium">{stage.name}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            in {stage.applicationRoleTitle}
                          </span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* No results */}
            {!hasResults && (
              <p className="text-center text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!query && (
          <p className="text-center text-muted-foreground">
            Type to search across your forays, emails, and stages
          </p>
        )}
      </div>
    </AppShell>
  )
}
