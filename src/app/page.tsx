import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'

export default async function Home() {
  const user = await requireUser()
  redirect(user.isOk() ? '/today' : '/login')
}
