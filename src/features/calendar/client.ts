import 'server-only'

import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

import { decryptToken } from '@/core/crypto/encryption'
import { tenantDb } from '@/core/db/tenant'
import { env } from '@/core/env'
import { err, errors, ok, type AppError, type Result } from '@/core/errors'
import type { UserId } from '@/core/types/ids'

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'

export function createCalendarOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALENDAR_REDIRECT_URI,
  )
}

export async function getCalendarClient(
  userId: UserId,
): Promise<Result<calendar_v3.Calendar, AppError>> {
  const user = await tenantDb(userId).user.findUnique({
    where: { id: Number(userId) },
    select: { calendarRefreshTokenEncrypted: true },
  })
  if (!user?.calendarRefreshTokenEncrypted) {
    return err(errors.externalApi('calendar', new Error('No refresh token stored - user must connect Google Calendar first')))
  }

  const tokenResult = decryptToken(user.calendarRefreshTokenEncrypted)
  if (tokenResult.isErr()) return err(tokenResult.error)

  const oauth2Client = createCalendarOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenResult.value })
  return ok(google.calendar({ version: 'v3', auth: oauth2Client }))
}
