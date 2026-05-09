import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { createOAuth2Client } from '@/features/inbox/gmail-client'
import { logger } from '@/core/logger'

export async function GET() {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return new Response('Unauthorized', { status: 401 })
  }

  const oauth2Client = createOAuth2Client()
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',   // required for refresh_token
    prompt: 'consent',        // force consent to get refresh_token every time
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  })

  logger.info({ op: 'gmail.auth.redirect', userId: userResult.value.id })
  redirect(url)
}
