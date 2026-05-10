import { requireUser } from '@/core/auth/session'
import { findOverdueFollowUps } from '@/features/today/queries'

import { NavLinks } from './nav-links'

export async function NavLinksWrapper() {
  let overdueCount = 0

  const userResult = await requireUser()
  if (userResult.isOk()) {
    const result = await findOverdueFollowUps(userResult.value.id)
    if (result.isOk()) {
      overdueCount = result.value.length
    }
  }

  return <NavLinks overdueCount={overdueCount} />
}
