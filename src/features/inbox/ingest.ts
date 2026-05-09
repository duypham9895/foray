// Inbox slice — Stage 1: Ingest emails from Gmail API.
//
// ingestSinceWatermark uses history.list with a messages.list fallback when the
// history has expired (404) or on first sync (no watermark). Returns raw Gmail
// message references (id + threadId) — the orchestrator (service.ts) fetches
// full messages in the processing loop.
//
// persistEmail writes an Email row inside an RLS-scoped transaction. The
// UNIQUE(gmail_message_id) constraint provides DB-level idempotency.
//
// See 04-RESEARCH.md §"Pattern 2" for history.list + messages.list fallback.

import 'server-only'

import type { gmail_v1 } from 'googleapis'

import { withRls } from '@/core/db/with-rls'
import { errors, ok, err, type Result, type AppError } from '@/core/errors'
import { logger } from '@/core/logger'
import type { UserId } from '@/core/types/ids'

import type { ParsedEmail } from './gmail-client'

// --- Message reference (lightweight — full message fetched by orchestrator) ---

export type MessageRef = {
  id: string
  threadId: string
}

// --- Ingest result ---

export type IngestResult = {
  messages: MessageRef[]
  newHistoryId: string
}

// --- Dedupe helper ---

function dedupeById(messages: gmail_v1.Schema$Message[]): gmail_v1.Schema$Message[] {
  const seen = new Set<string>()
  return messages.filter(m => {
    if (!m.id || seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

// --- 404 detection for expired history ---

function isGmail404(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: number }).code === 404
  }
  return false
}

// --- Fallback: messages.list for last 7 days ---

async function fallbackToMessagesList(
  gmail: gmail_v1.Gmail,
): Promise<{ messages: gmail_v1.Schema$Message[]; newHistoryId: string }> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'newer_than:7d',
    maxResults: 100,
  })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return {
    messages: res.data.messages ?? [],
    newHistoryId: profile.data.historyId ?? '',
  }
}

// --- Main ingest function ---

export async function ingestSinceWatermark(
  gmail: gmail_v1.Gmail,
  startHistoryId: string | null,
): Promise<IngestResult> {
  if (!startHistoryId) {
    // First sync — no watermark yet, fall back to messages.list
    const { messages, newHistoryId } = await fallbackToMessagesList(gmail)
    const unique = dedupeById(messages)
    return {
      messages: unique.map(m => ({ id: m.id!, threadId: m.threadId! })),
      newHistoryId,
    }
  }

  try {
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
    })
    const messages = (res.data.history ?? []).flatMap(h => h.messages ?? [])
    const unique = dedupeById(messages)
    return {
      messages: unique.map(m => ({ id: m.id!, threadId: m.threadId! })),
      newHistoryId: res.data.historyId ?? startHistoryId,
    }
  } catch (error: unknown) {
    if (isGmail404(error)) {
      logger.warn({ op: 'ingest.history_expired', startHistoryId }, 'history.list 404 — falling back to messages.list')
      const { messages, newHistoryId } = await fallbackToMessagesList(gmail)
      const unique = dedupeById(messages)
      return {
        messages: unique.map(m => ({ id: m.id!, threadId: m.threadId! })),
        newHistoryId,
      }
    }
    throw error
  }
}

// --- Persist email (idempotent via UNIQUE(gmail_message_id)) ---

export async function persistEmail(
  userId: UserId,
  parsed: ParsedEmail,
): Promise<Result<{ emailId: number; isNew: boolean }, AppError>> {
  return withRls(userId, async (tx) => {
    // Idempotency: skip if already ingested
    const existing = await tx.email.findUnique({
      where: { gmailMessageId: parsed.gmailMessageId },
      select: { id: true },
    })
    if (existing) {
      return { emailId: existing.id, isNew: false }
    }

    const created = await tx.email.create({
      data: {
        userId: Number(userId),
        gmailMessageId: parsed.gmailMessageId,
        gmailThreadId: parsed.gmailThreadId,
        from: parsed.from,
        fromDomain: parsed.fromDomain,
        subject: parsed.subject,
        bodyExcerpt: parsed.bodyExcerpt,
        receivedAt: parsed.receivedAt,
        processingStatus: 'received',
      },
    })
    return { emailId: created.id, isNew: true }
  })
}
