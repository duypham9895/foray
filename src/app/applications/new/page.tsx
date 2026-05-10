import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { withRls } from '@/core/db/with-rls'
import { NewApplicationForm } from '@/features/applications/components/new-application-form'

export default async function NewApplicationPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = userResult.value.id

  const t = await getTranslations('newForay')
  const tForays = await getTranslations('forays')

  const companiesResult = await withRls(userId, async (tx) =>
    tx.company.findMany({
      where: { userId: Number(userId) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  )
  const companies = companiesResult.isOk() ? companiesResult.value : []

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-10 lg:px-10 lg:py-14">
        <Link
          href="/applications"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {tForays('back')}
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>
        <NewApplicationForm companies={companies} />
      </div>
    </AppShell>
  )
}
