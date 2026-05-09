// Inbox slice — pollOnce orchestrator.
//
// Composes the four-stage pipeline: ingest -> match -> classify -> act.
// Each email is processed independently — per-email failure never aborts
// the batch. Watermark (gmailHistoryId) and gmailLastSyncAt are updated
// after the loop completes.
//
// Sequential processing (not parallel) respects Gmail quota
// (250 units/user/sec) and simplifies error handling.
//
// See 04-RESEARCH.md §"Pattern 4" for the orchestrator design.

import 'server-only'

import { withRls } from '@/core/db/with-rls'
import { tenantDb } from '@/core/db/tenant'
import { ok, err, type Result, type AppError, errors } from '@/core/errors'
import { logger } from '@/core/logger'
import type { UserId } from '@/core/types/ids'
import { classifyEmail } from '@/features/classifier/service'
import { matchEmail } from '@/features/matcher/service'

import { getGmailClient, extractEmailMetadata } from './gmail-client'
import { ingestSinceWatermark, persistEmail } from './ingest'
import { actOnEmail } from './act'

// --- Poll summary ---

export type PollSummary = {
  processed: number
  autoUpdated: number
  needsReview: number
  failed: number
}

// --- pollOnce orchestrator ---

export async function pollOnce(userId: UserId): Promise<Result<PollSummary, AppError>> {
  const log = logger.child({ op: 'inbox.pollOnce', userId })
  log.info('starting poll cycle')

  // Get Gmail client (decrypts refresh token)
  const gmailResult = await getGmailClient(userId)
  if (gmailResult.isErr()) return err(gmailResult.error)
  const gmail = gmailResult.value

  // Get current watermark
  const user = await tenantDb(userId).user.findUnique({
    where: { id: Number(userId) },
    select: { gmailHistoryId: true },
  })

  // Stage 1: Ingest
  let ingestResult
  try {
    ingestResult = await ingestSinceWatermark(gmail, user?.gmailHistoryId ?? null)
  } catch (error) {
    log.error({ err: error }, 'ingest failed')
    return err(errors.externalApi('gmail', error))
  }

  const { messages: messageRefs, newHistoryId } = ingestResult
  log.info({ messageCount: messageRefs.length, newHistoryId }, 'ingest complete')

  let processed = 0
  let autoUpdated = 0
  let needsReview = 0
  let failed = 0

  // Process each email independently
  for (const msgRef of messageRefs) {
    try {
      // Fetch full message (needed for body + headers)
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msgRef.id,
        format: 'full',
      })
      const parsed = extractEmailMetadata(full.data)

      // Idempotency: persist email (skip if already ingested)
      const persistResult = await persistEmail(userId, parsed)
      if (persistResult.isErr()) {
        log.error({ err: persistResult.error, messageId: msgRef.id }, 'persist failed')
        failed++
        continue
      }

      if (!persistResult.value.isNew) {
        processed++
        continue  // already ingested — skip
      }

      const emailId = persistResult.value.emailId

      // Stage 2: Match
      const matchResult = await matchEmail({
        userId: String(userId),
        gmailThreadId: parsed.gmailThreadId,
        fromDomain: parsed.fromDomain,
      })
      if (matchResult.isErr()) {
        log.error({ err: matchResult.error, messageId: msgRef.id }, 'match failed')
        await markFailed(userId, emailId)
        failed++
        continue
      }

      // Update processing status to matched
      await updateStatus(userId, emailId, 'matched')

      // Stage 3: Classify
      const classifyResult = await classifyEmail({
        subject: parsed.subject,
        bodyExcerpt: parsed.bodyExcerpt,
      })
      if (classifyResult.isErr()) {
        log.error({ err: classifyResult.error, messageId: msgRef.id }, 'classify failed')
        await markFailed(userId, emailId)
        failed++
        continue
      }

      // Update processing status to classified
      await updateStatus(userId, emailId, 'classified')

      // Stage 4: Act
      const actResult = await actOnEmail(
        userId,
        emailId,
        parsed,
        matchResult.value,
        classifyResult.value,
      )
      if (actResult.isErr()) {
        log.error({ err: actResult.error, messageId: msgRef.id }, 'act failed')
        await markFailed(userId, emailId)
        failed++
        continue
      }

      if (actResult.value.action === 'auto_updated') autoUpdated++
      else if (actResult.value.action === 'needs_review') needsReview++
      processed++
    } catch (error) {
      log.error({ err: error, messageId: msgRef.id }, 'unhandled error processing email')
      failed++
    }
  }

  // Update watermark
  await withRls(userId, async (tx) => {
    await tx.user.update({
      where: { id: Number(userId) },
      data: {
        gmailHistoryId: newHistoryId,
        gmailLastSyncAt: new Date(),
      },
    })
  })

  log.info({ processed, autoUpdated, needsReview, failed }, 'poll cycle complete')
  return ok({ processed, autoUpdated, needsReview, failed })
}

// --- Helpers ---

async function updateStatus(
  userId: UserId,
  emailId: number,
  status: 'matched' | 'classified',
): Promise<void> {
  await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: { processingStatus: status },
    })
  })
}

async function markFailed(userId: UserId, emailId: number): Promise<void> {
  await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: { processingStatus: 'failed' },
    })
  })
}
