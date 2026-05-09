import { NextRequest } from 'next/server'

import { requireUser } from '@/core/auth/session'
import { encryptToken } from '@/core/crypto/encryption'
import { tenantDb } from '@/core/db/tenant'
import { createOAuth2Client } from '@/features/inbox/gmail-client'
import { logger } from '@/core/logger'

export async function GET(request: NextRequest) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return new Response('Unauthorized', { status: 401 })
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return new Response('Missing authorization code', { status: 400 })
  }

  const userId = userResult.value.id

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      logger.error({ op: 'gmail.callback.no_refresh_token' })
      return new Response('No refresh token received — try disconnecting and reconnecting', { status: 400 })
    }

    const encrypted = encryptToken(tokens.refresh_token)

    await tenantDb(userId).user.update({
      where: { id: Number(userId) },
      data: {
        gmailRefreshTokenEncrypted: encrypted,
        gmailLastSyncAt: null,      // reset so first poll does a full sync
        gmailHistoryId: null,       // reset watermark
      },
    })

    logger.info({ op: 'gmail.callback.success', userId })
    // Redirect to settings with success indicator
    return Response.redirect(new URL('/settings?gmail=connected', request.nextUrl.origin))
  } catch (error) {
    logger.error({ op: 'gmail.callback.error', error })
    return new Response('Failed to exchange authorization code', { status: 500 })
  }
}
