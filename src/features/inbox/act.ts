// Inbox slice — Stage 4: Act on classified emails.
//
// actOnEmail implements all five gates before auto-updating an Application's
// canonical status:
//
//   1. pg_try_advisory_lock per email — serializes concurrent act-stage runs
//   2. reviewedByUser check — undo idempotency (AUTO-04)
//   3. First-50 grace — new Gmail connections go to review queue (AUTO-03)
//   4. Per-label threshold — meetsThreshold gate (AUTO-01)
//   5. Status regression — blocks dangerous transitions (AUTO-01)
//
// When all gates pass, applyAutoStatusChange writes an undoable Event.
// When any gate fails, the email is routed to needs_review.
//
// See 04-RESEARCH.md §"Pattern 5" for the full gate logic.

import 'server-only'

import { withRls } from '@/core/db/with-rls'
import { prisma } from '@/core/db/client'
import { ok, type Result, type AppError } from '@/core/errors'
import { logger } from '@/core/logger'
import type { UserId } from '@/core/types/ids'
import type { CanonicalStatus, EmailClassification } from '@/generated/prisma/client'
import { applyAutoStatusChange } from '@/features/applications/service'
import { isStatusRegression } from '@/features/applications/status-transitions'
import { meetsThreshold } from '@/features/classifier/thresholds'

import { shouldAutoClearClassification } from './application-importer'
import type { ParsedEmail } from './gmail-client'
import type { ClassifyEmailOutput } from '@/features/classifier/service'
import type { MatchEmailOutput } from '@/features/matcher/schema'

// --- Map classification label to canonical status ---

function labelToStatus(label: EmailClassification): CanonicalStatus | null {
  switch (label) {
    case 'rejection':          return 'rejected'
    case 'interview_invite':   return 'interviewing'
    case 'recruiter_outreach': return null  // no auto-status for outreach
    case 'noise':              return null
    case 'unmatched':          return null
  }
}

// --- Act on a single email ---

export type ActResult = {
  action: 'auto_updated' | 'auto_cleared' | 'needs_review' | 'skipped'
  emailId: number
}

export async function actOnEmail(
  userId: UserId,
  emailId: number,
  parsed: ParsedEmail,
  match: MatchEmailOutput,
  classification: ClassifyEmailOutput,
): Promise<Result<ActResult, AppError>> {
  const log = logger.child({ op: 'inbox.act', emailId, userId })

  // Per-email advisory lock for race prevention (T-04-03-01)
  const lockResult = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${`act:${emailId}`})) AS locked`
  if (!lockResult[0]?.locked) {
    log.debug('advisory lock held by another process — skipping')
    return ok({ action: 'skipped', emailId })
  }

  try {
    // Gate reads must use withRls so RLS policies fire (tenantDb alone
    // does not set the app.user_id GUC, causing RLS to deny all rows).
    const gateResult = await withRls(userId, async (tx) => {
      // First-50 grace (AUTO-03): count emails for this user
      const emailCount = await tx.email.count({ where: { userId: Number(userId) } })
      const isFirst50 = emailCount < 50

      // Check reviewedByUser — undo idempotency (AUTO-04)
      const email = await tx.email.findUnique({
        where: { id: emailId },
        select: { reviewedByUser: true },
      })

      // Auto-update gate: confidence >= threshold AND matched AND not regression AND not first-50
      const newStatus = labelToStatus(classification.label)
      const canAutoUpdate =
        !isFirst50 &&
        match.applicationId !== null &&
        newStatus !== null &&
        meetsThreshold(classification.label, classification.confidence)

      let appCanonicalStatus: CanonicalStatus | null = null
      if (canAutoUpdate && match.applicationId && newStatus) {
        const app = await tx.application.findUnique({
          where: { id: Number(match.applicationId) },
          select: { canonicalStatus: true },
        })
        appCanonicalStatus = app?.canonicalStatus ?? null
      }

      return { isFirst50, email, canAutoUpdate, newStatus, appCanonicalStatus }
    })

    if (gateResult.isErr()) {
      log.error({ err: gateResult.error }, 'gate read failed')
      return ok({ action: 'needs_review', emailId })
    }

    const { isFirst50, email, canAutoUpdate, newStatus, appCanonicalStatus } = gateResult.value

    if (email?.reviewedByUser) {
      log.debug('email already reviewed by user (undo) — skipping act')
      return ok({ action: 'skipped', emailId })
    }

    if (shouldAutoClearClassification(classification, match)) {
      await withRls(userId, async (tx) => {
        await tx.email.update({
          where: { id: emailId },
          data: {
            classification: classification.label,
            confidence: classification.confidence,
            classifiedBy: classification.classifiedBy,
            applicationId: match.applicationId ? Number(match.applicationId) : null,
            reviewedByUser: true,
            processingStatus: 'acted',
          },
        })
      })

      log.info({ label: classification.label, confidence: classification.confidence }, 'auto-cleared low-risk email')
      return ok({ action: 'auto_cleared', emailId })
    }

    if (canAutoUpdate && match.applicationId && newStatus) {
      // Check for status regression (e.g., interviewing -> rejected needs human)
      if (appCanonicalStatus && isStatusRegression(appCanonicalStatus, newStatus)) {
        log.info({ from: appCanonicalStatus, to: newStatus }, 'status regression detected — routing to review')
        await updateProcessingStatus(userId, emailId, 'needs_review')
        return ok({ action: 'needs_review', emailId })
      }

      // Apply auto-update (AUTO-01)
      const result = await applyAutoStatusChange(userId, match.applicationId, {
        newStatus,
        source: 'cron',
        emailId,
        classifierConfidence: classification.confidence,
        classifiedBy: classification.classifiedBy,
      })

      if (result.isErr()) {
        log.warn({ err: result.error }, 'auto-update failed — routing to review')
        await updateProcessingStatus(userId, emailId, 'needs_review')
        return ok({ action: 'needs_review', emailId })
      }

      // Update email with classification + link to application
      await withRls(userId, async (tx) => {
        await tx.email.update({
          where: { id: emailId },
          data: {
            classification: classification.label,
            confidence: classification.confidence,
            classifiedBy: classification.classifiedBy,
            applicationId: Number(match.applicationId),
            processingStatus: 'acted',
          },
        })
      })

      log.info({ label: classification.label, confidence: classification.confidence }, 'auto-updated')
      return ok({ action: 'auto_updated', emailId })
    }

    // Route to review queue (AUTO-02)
    await withRls(userId, async (tx) => {
      await tx.email.update({
        where: { id: emailId },
        data: {
          classification: classification.label,
          confidence: classification.confidence,
          classifiedBy: classification.classifiedBy,
          applicationId: match.applicationId ? Number(match.applicationId) : null,
          processingStatus: 'needs_review',
        },
      })
    })

    log.info({ label: classification.label, confidence: classification.confidence, isFirst50, matched: !!match.applicationId }, 'routed to review')
    return ok({ action: 'needs_review', emailId })
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${`act:${emailId}`}))`
  }
}

// --- Helper: update processing status ---

async function updateProcessingStatus(
  userId: UserId,
  emailId: number,
  status: 'needs_review' | 'failed' | 'acted',
): Promise<void> {
  await withRls(userId, async (tx) => {
    await tx.email.update({
      where: { id: emailId },
      data: { processingStatus: status },
    })
  })
}
