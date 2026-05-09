import 'server-only'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { ok, err, type Result } from 'neverthrow'

import { errors, type AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import { sessionOptions, type SessionData } from './session-config'

export async function requireUser(): Promise<Result<{ id: UserId }, AppError>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return err(errors.unauthorized())
  return ok({ id: session.userId })
}

export async function verifySession(): Promise<{ id: UserId } | null> {
  const result = await requireUser()
  return result.isOk() ? result.value : null
}
