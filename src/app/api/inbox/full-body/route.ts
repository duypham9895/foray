import { NextRequest, NextResponse } from 'next/server'
import type { gmail_v1 } from 'googleapis'

import { requireUser } from '@/core/auth/session'
import { UserId } from '@/core/types/ids'
import { getGmailClient } from '@/features/inbox/gmail-client'

// --- In-memory token bucket rate limiter ---
// Single-user sufficient. 5 tokens max, refills at 5 tokens/sec.

const buckets = new Map<string, { tokens: number; lastRefill: number }>()
const MAX_TOKENS = 5
const REFILL_RATE = 5

function consumeToken(userId: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(userId) ?? { tokens: MAX_TOKENS, lastRefill: now }
  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + elapsed * REFILL_RATE)
  bucket.lastRefill = now
  if (bucket.tokens < 1) {
    buckets.set(userId, bucket)
    return false
  }
  bucket.tokens -= 1
  buckets.set(userId, bucket)
  return true
}

// --- Plain text body extraction (inlined from gmail-client.ts) ---

function extractPlainTextBody(
  part: gmail_v1.Schema$MessagePart | undefined,
): string {
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

// --- GET handler ---

export async function GET(request: NextRequest) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = userResult.value.id
  if (!consumeToken(userId)) {
    return NextResponse.json(
      { error: 'Rate limited' },
      { status: 429, headers: { 'Retry-After': '1' } },
    )
  }

  const gmailMessageId = request.nextUrl.searchParams.get('messageId')
  if (!gmailMessageId) {
    return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
  }

  const gmailResult = await getGmailClient(UserId(userId))
  if (gmailResult.isErr()) {
    return NextResponse.json(
      { error: 'Gmail disconnected — full bodies unavailable' },
      { status: 503 },
    )
  }

  const gmail = gmailResult.value
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'full',
  })

  const body = extractPlainTextBody(msg.data.payload)

  return NextResponse.json({ body })
}
