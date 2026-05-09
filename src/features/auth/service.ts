import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { ok, err, type Result } from 'neverthrow'

import { env } from '@/core/env'
import { errors, type AppError } from '@/core/errors'
import { UserId } from '@/core/types/ids'
import { sessionOptions, type SessionData } from '@/core/auth/session-config'

const SEEDED_OWNER_USER_ID = UserId(1) // single-user; from seed.ts

export async function verifyPasswordAndIssueSession(
  password: string,
): Promise<Result<{ userId: UserId }, AppError>> {
  // Constant-time compare against APP_PASSWORD env. Buffers must be the same
  // length or timingSafeEqual throws — pad both to a fixed width.
  const provided = Buffer.from(password.padEnd(72, '\0'))
  const expected = Buffer.from(env.APP_PASSWORD.padEnd(72, '\0'))

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return err(errors.unauthorized())
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.userId = SEEDED_OWNER_USER_ID
  session.issuedAt = Date.now()
  await session.save()

  return ok({ userId: SEEDED_OWNER_USER_ID })
}

export async function destroySession(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.destroy()
}
