// Integration tests for inbox/act.ts — the act-stage gate logic.
//
// Covers AUTO-01..04 requirements. Runs against Testcontainers Postgres
// seeded by tests/integration/setup.ts (alice = UserId(1)).
//
// Gate coverage:
//   T1  confidence below threshold -> needs_review (AUTO-01, AUTO-02)
//   T2  no application matched -> needs_review (AUTO-02)
//   T3  status regression (interviewing -> rejected) -> needs_review (AUTO-01)
//   T4  reviewedByUser = true -> skipped (undo idempotency, AUTO-04)
//   T5  recruiter_outreach label -> needs_review (no auto-status mapping)
//   T6  first-50 emails -> needs_review regardless of confidence (AUTO-03)
//   T7  high confidence + matched + forward status -> auto_updated (AUTO-01)

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId, ApplicationId } from '@/core/types/ids'

import { actOnEmail } from '@/features/inbox/act'
import type { ParsedEmail } from '@/features/inbox/gmail-client'
import type { ClassifyEmailOutput } from '@/features/classifier/service'
import type { MatchEmailOutput } from '@/features/matcher/schema'

// --- Constants ---

const ALICE = UserId(1)
const SEED_ROLE_TITLE = 'Alice Test Role'

// --- Test helpers ---

function makeParsedEmail(overrides: Partial<ParsedEmail> = {}): ParsedEmail {
  return {
    gmailMessageId: `msg-act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    gmailThreadId: `thread-act-${Date.now()}`,
    from: 'recruiter@techcorp.com',
    fromDomain: 'techcorp.com',
    subject: 'Interview Invitation',
    bodyExcerpt: 'We would like to invite you to the next round...',
    receivedAt: new Date(),
    ...overrides,
  }
}

function makeClassification(overrides: Partial<ClassifyEmailOutput> = {}): ClassifyEmailOutput {
  return {
    label: 'interview_invite',
    confidence: 0.9,
    classifiedBy: 'rules',
    ...overrides,
  }
}

function makeMatch(applicationId: number | null): MatchEmailOutput {
  return { applicationId: applicationId ? ApplicationId(applicationId) : null }
}

// --- Fixture management ---

async function resetAliceActState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
    await tx.event.deleteMany({ where: { userId: Number(ALICE) } })
    // Keep seed application, remove test-created ones
    await tx.application.deleteMany({
      where: { userId: Number(ALICE), roleTitle: { not: SEED_ROLE_TITLE } },
    })
    await tx.company.deleteMany({
      where: { userId: Number(ALICE), name: { not: 'Alice Corp' } },
    })
  })
}

let testApplicationId: number

beforeEach(async () => {
  await resetAliceActState()

  // Create a test company + application for act-stage tests
  const setup = await withRls(ALICE, async (tx) => {
    const company = await tx.company.create({
      data: { userId: Number(ALICE), name: 'TechCorp', domain: 'techcorp.com' },
      select: { id: true },
    })
    const app = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Act Test Role',
        canonicalStatus: 'applied',
        appliedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { id: true },
    })
    return { appId: app.id }
  })
  expect(setup.isOk()).toBe(true)
  if (!setup.isOk()) return
  testApplicationId = setup.value.appId
})

afterEach(async () => {
  await resetAliceActState()
})

// --- Tests ---

describe('actOnEmail', () => {
  // -----------------------------------------------------------------------
  // T1: confidence below threshold -> needs_review
  // -----------------------------------------------------------------------
  it('T1: routes to review when confidence below threshold', async () => {
    const parsed = makeParsedEmail()
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: parsed.from,
          fromDomain: parsed.fromDomain,
          subject: parsed.subject,
          bodyExcerpt: parsed.bodyExcerpt,
          receivedAt: parsed.receivedAt,
          processingStatus: 'classified',
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(testApplicationId),
      makeClassification({ confidence: 0.5 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.action).toBe('needs_review')
    }

    // Verify email status updated
    const updated = await withRls(ALICE, async (tx) =>
      tx.email.findUnique({ where: { id: email.value.id }, select: { processingStatus: true } }),
    )
    expect(updated.isOk()).toBe(true)
    if (updated.isOk()) {
      expect(updated.value?.processingStatus).toBe('needs_review')
    }
  })

  // -----------------------------------------------------------------------
  // T2: no application matched -> needs_review
  // -----------------------------------------------------------------------
  it('T2: routes to review when no application matched', async () => {
    const parsed = makeParsedEmail({
      gmailMessageId: `msg-nomatch-${Date.now()}`,
      gmailThreadId: 'thread-nomatch',
    })
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: 'unknown@example.com',
          fromDomain: 'example.com',
          subject: 'Unmatched email',
          bodyExcerpt: 'No matching application',
          receivedAt: new Date(),
          processingStatus: 'classified',
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(null),
      makeClassification({ confidence: 0.95 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.action).toBe('needs_review')
    }
  })

  // -----------------------------------------------------------------------
  // T3: status regression -> needs_review
  // -----------------------------------------------------------------------
  it('T3: routes to review on status regression (interviewing -> rejected)', async () => {
    // Set application to interviewing
    await withRls(ALICE, async (tx) =>
      tx.application.update({
        where: { id: testApplicationId },
        data: { canonicalStatus: 'interviewing' },
      }),
    )

    const parsed = makeParsedEmail({
      gmailMessageId: `msg-regression-${Date.now()}`,
      gmailThreadId: 'thread-regression',
    })
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: 'noreply@techcorp.com',
          fromDomain: 'techcorp.com',
          subject: 'Rejection after interview',
          bodyExcerpt: 'We regret to inform you...',
          receivedAt: new Date(),
          processingStatus: 'classified',
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(testApplicationId),
      makeClassification({ label: 'rejection', confidence: 0.95 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.action).toBe('needs_review')
    }
  })

  // -----------------------------------------------------------------------
  // T4: reviewedByUser = true -> skipped (undo idempotency)
  // -----------------------------------------------------------------------
  it('T4: skips email when reviewedByUser is true (undo idempotency)', async () => {
    const parsed = makeParsedEmail({
      gmailMessageId: `msg-reviewed-${Date.now()}`,
      gmailThreadId: 'thread-reviewed',
    })
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: 'recruiter@techcorp.com',
          fromDomain: 'techcorp.com',
          subject: 'Already reviewed',
          bodyExcerpt: 'User undid this',
          receivedAt: new Date(),
          processingStatus: 'acted',
          reviewedByUser: true,
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(testApplicationId),
      makeClassification({ confidence: 0.95 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.action).toBe('skipped')
    }
  })

  // -----------------------------------------------------------------------
  // T5: recruiter_outreach -> needs_review (no auto-status mapping)
  // -----------------------------------------------------------------------
  it('T5: routes recruiter_outreach to review (no auto-status mapping)', async () => {
    const parsed = makeParsedEmail({
      gmailMessageId: `msg-outreach-${Date.now()}`,
      gmailThreadId: 'thread-outreach',
      from: 'recruiter@agency.com',
      fromDomain: 'agency.com',
    })
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: parsed.from,
          fromDomain: parsed.fromDomain,
          subject: 'Exciting opportunity',
          bodyExcerpt: 'We have a role for you...',
          receivedAt: new Date(),
          processingStatus: 'classified',
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(testApplicationId),
      makeClassification({ label: 'recruiter_outreach', confidence: 0.9 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.action).toBe('needs_review')
    }
  })

  // -----------------------------------------------------------------------
  // T6: first-50 emails -> needs_review regardless of confidence (AUTO-03)
  // -----------------------------------------------------------------------
  it('T6: routes to review when user has fewer than 50 emails (first-50 grace)', async () => {
    // With only the seed data, alice has <50 emails -> isFirst50 = true
    const parsed = makeParsedEmail({
      gmailMessageId: `msg-first50-${Date.now()}`,
      gmailThreadId: 'thread-first50',
    })
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: 'hr@techcorp.com',
          fromDomain: 'techcorp.com',
          subject: 'Offer letter',
          bodyExcerpt: 'We are pleased to extend an offer...',
          receivedAt: new Date(),
          processingStatus: 'classified',
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(testApplicationId),
      makeClassification({ label: 'interview_invite', confidence: 0.99 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      // Even with 0.99 confidence + match, first-50 forces review
      expect(result.value.action).toBe('needs_review')
    }
  })

  // -----------------------------------------------------------------------
  // T7: high confidence + matched + forward status -> auto_updated (AUTO-01)
  //        NOTE: This test only passes when emailCount >= 50, which requires
  //        seeding many emails. We test the gate LOGIC by checking that when
  //        the first-50 gate is skipped (≥50 emails), auto-update fires.
  // -----------------------------------------------------------------------
  it('T7: auto-updates when all gates pass (≥50 emails, matched, above threshold, forward status)', async () => {
    // Seed 50+ dummy emails to bypass first-50 gate
    await withRls(ALICE, async (tx) => {
      const emails = Array.from({ length: 51 }, (_, i) => ({
        userId: Number(ALICE),
        gmailMessageId: `bulk-${Date.now()}-${i}`,
        gmailThreadId: `bulk-thread-${i}`,
        from: 'bulk@test.com',
        fromDomain: 'test.com',
        subject: `Bulk email ${i}`,
        bodyExcerpt: 'Bulk body',
        receivedAt: new Date(Date.now() - 86400000), // 1 day ago
        processingStatus: 'acted' as const,
      }))
      await tx.email.createMany({ data: emails })
    })

    const parsed = makeParsedEmail({
      gmailMessageId: `msg-auto-${Date.now()}`,
      gmailThreadId: 'thread-auto',
    })
    const email = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          from: 'hr@techcorp.com',
          fromDomain: 'techcorp.com',
          subject: 'Interview confirmed',
          bodyExcerpt: 'Your interview is confirmed for next week.',
          receivedAt: new Date(),
          processingStatus: 'classified',
        },
        select: { id: true },
      }),
    )
    expect(email.isOk()).toBe(true)
    if (!email.isOk()) return

    const result = await actOnEmail(
      ALICE,
      email.value.id,
      parsed,
      makeMatch(testApplicationId),
      makeClassification({ label: 'interview_invite', confidence: 0.9 }),
    )

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.action).toBe('auto_updated')
    }

    // Verify email updated with classification + linked to application
    const updated = await withRls(ALICE, async (tx) =>
      tx.email.findUnique({
        where: { id: email.value.id },
        select: { processingStatus: true, classification: true, applicationId: true },
      }),
    )
    expect(updated.isOk()).toBe(true)
    if (updated.isOk()) {
      expect(updated.value?.processingStatus).toBe('acted')
      expect(updated.value?.classification).toBe('interview_invite')
      expect(updated.value?.applicationId).toBe(testApplicationId)
    }

    // Verify undoable event was written
    const events = await withRls(ALICE, async (tx) =>
      tx.event.findMany({
        where: { userId: Number(ALICE), type: 'auto_status_changed' },
        select: { id: true, undoable: true },
      }),
    )
    expect(events.isOk()).toBe(true)
    if (events.isOk()) {
      expect(events.value.length).toBeGreaterThanOrEqual(1)
      expect(events.value[0]?.undoable).toBe(true)
    }
  })
})
