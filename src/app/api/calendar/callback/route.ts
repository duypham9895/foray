import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

import { requireUser } from '@/core/auth/session'
import { encryptToken } from '@/core/crypto/encryption'
import { tenantDb } from '@/core/db/tenant'
import { getPublicOrigin } from '@/core/http/public-origin'
import { logger } from '@/core/logger'
import { createCalendarOAuth2Client } from '@/features/calendar/client'

const STATE_COOKIE = 'calendar_oauth_state'

export async function GET(request: NextRequest) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return new Response('Unauthorized', { status: 401 })
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return new Response('Missing authorization code', { status: 400 })
  }

  const state = request.nextUrl.searchParams.get('state')
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)
  if (!state || !expectedState || state !== expectedState) {
    return new Response('Invalid OAuth state', { status: 403 })
  }

  const userId = userResult.value.id

  try {
    const oauth2Client = createCalendarOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      logger.error({ op: 'calendar.callback.no_refresh_token' })
      return new Response('No refresh token received - try disconnecting and reconnecting', { status: 400 })
    }

    const encrypted = encryptToken(tokens.refresh_token)

    await tenantDb(userId).user.update({
      where: { id: Number(userId) },
      data: {
        calendarRefreshTokenEncrypted: encrypted,
        calendarLastSyncAt: null,
      },
    })

    logger.info({ op: 'calendar.callback.success', userId })
    return Response.redirect(new URL('/settings?calendar=connected', getPublicOrigin(request)))
  } catch (error) {
    logger.error({ op: 'calendar.callback.error', error })
    return new Response('Failed to exchange authorization code', { status: 500 })
  }
}
