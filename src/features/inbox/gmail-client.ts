import 'server-only'

import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

import type { Result } from 'neverthrow'

import { decryptToken } from '@/core/crypto/encryption'
import { errors, ok, err, type AppError } from '@/core/errors'
import { env } from '@/core/env'
import { logger } from '@/core/logger'
import type { UserId } from '@/core/types/ids'
import { tenantDb } from '@/core/db/tenant'

// --- OAuth2 client factory ---

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  )
}

// --- Gmail client from stored refresh token ---

export async function getGmailClient(
  userId: UserId,
): Promise<Result<gmail_v1.Gmail, AppError>> {
  const user = await tenantDb(userId).user.findUnique({
    where: { id: Number(userId) },
    select: { gmailRefreshTokenEncrypted: true },
  })
  if (!user?.gmailRefreshTokenEncrypted) {
    return err(errors.externalApi('gmail', new Error('No refresh token stored — user must connect Gmail first')))
  }

  const tokenResult = decryptToken(user.gmailRefreshTokenEncrypted)
  if (tokenResult.isErr()) return err(tokenResult.error)

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenResult.value })
  return ok(google.gmail({ version: 'v1', auth: oauth2Client }))
}

// --- Email metadata extraction ---

export type ParsedEmail = {
  gmailMessageId: string
  gmailThreadId: string
  from: string
  fromDomain: string
  subject: string
  bodyExcerpt: string
  receivedAt: Date
}

function findHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | undefined {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
}

function extractDomain(fromHeader: string): string {
  // Parse "Name <email@domain>" or "email@domain" -> "domain"
  const match = fromHeader.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  return match?.[1]?.toLowerCase() ?? ''
}

function extractPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8')
  }
  for (const child of part.parts ?? []) {
    const found = extractPlainTextBody(child)
    if (found) return found
  }
  return ''
}

export function extractEmailMetadata(msg: gmail_v1.Schema$Message): ParsedEmail {
  const headers = msg.payload?.headers ?? []
  const from = findHeader(headers, 'From') ?? ''
  const subject = findHeader(headers, 'Subject') ?? ''
  const fromDomain = extractDomain(from)
  const bodyExcerpt = extractPlainTextBody(msg.payload).slice(0, 500)
  const receivedAt = new Date(Number(msg.internalDate))

  return {
    gmailMessageId: msg.id!,
    gmailThreadId: msg.threadId!,
    from,
    fromDomain,
    subject,
    bodyExcerpt,
    receivedAt,
  }
}
