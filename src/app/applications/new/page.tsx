import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { withRls } from '@/core/db/with-rls'
import { NewApplicationForm } from '@/features/applications/components/new-application-form'

export default async function NewApplicationPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')
  const userId = userResult.value.id

  const companiesResult = await withRls(userId, async (tx) =>
    tx.company.findMany({
      where: { userId: Number(userId) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  )
  const companies = companiesResult.isOk() ? companiesResult.value : []

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-3xl mb-6">Capture a foray</h1>
      <NewApplicationForm companies={companies} />
    </main>
  )
}
