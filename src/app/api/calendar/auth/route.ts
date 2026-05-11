import { randomBytes } from 'node:crypto'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { logger } from '@/core/logger'
import { CALENDAR_SCOPE, createCalendarOAuth2Client } from '@/features/calendar/client'

const STATE_COOKIE = 'calendar_oauth_state'

export async function GET() {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return new Response('Unauthorized', { status: 401 })
  }

  const state = randomBytes(24).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  })

  const oauth2Client = createCalendarOAuth2Client()
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [CALENDAR_SCOPE],
    state,
  })

  logger.info({ op: 'calendar.auth.redirect', userId: userResult.value.id })
  redirect(url)
}
