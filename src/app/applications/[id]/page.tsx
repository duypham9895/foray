import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'
import { ApplicationId } from '@/core/types/ids'
import { ApplicationDetail } from '@/features/applications/components/application-detail'
import { findApplicationDetail } from '@/features/applications/queries'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = userResult.value.id

  const t = await getTranslations('forayDetail')
  const tForays = await getTranslations('forays')

  const { id } = await params
  const result = await findApplicationDetail(userId, ApplicationId(id))

  if (result.isErr()) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 lg:px-10 lg:py-14">
          <Link
            href="/applications"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            {tForays('back')}
          </Link>
          <p className="text-muted-foreground">{t('loadError')}</p>
        </div>
      </AppShell>
    )
  }
  if (!result.value) notFound()

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-10 lg:py-14">
        <Link
          href="/applications"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {tForays('back')}
        </Link>
        <ApplicationDetail detail={result.value} />
      </div>
    </AppShell>
  )
}
