// Integration tests for inbox/queries.ts — findEmailsForReview + findApplicationsForLink.
//
// Runs against Testcontainers Postgres seeded by tests/integration/setup.ts
// (alice = UserId(1), bob = UserId(2)).
//
// Tests:
//   T1  findEmailsForReview returns emails with processingStatus='needs_review' for the correct user
//   T2  findEmailsForReview excludes emails with other processing statuses
//   T3  findApplicationsForLink returns non-archived applications with company names

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

import { findEmailsForReview, findApplicationsForLink } from './queries'

// --- Constants ---

const ALICE = UserId(1)
const BOB = UserId(2)
const SEED_ROLE_TITLE = 'Alice Test Role'

// --- Fixture management ---

async function resetInboxState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
    // Remove non-seed applications
    await tx.application.deleteMany({
      where: { userId: Number(ALICE), roleTitle: { not: SEED_ROLE_TITLE } },
    })
    await tx.company.deleteMany({
      where: { userId: Number(ALICE), name: { not: 'Alice Corp' } },
    })
  })
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(BOB)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(BOB) } })
  })
}

let testApplicationId: number

beforeEach(async () => {
  await resetInboxState()

  // Create a test company + application for inbox tests
  const setup = await withRls(ALICE, async (tx) => {
    const company = await tx.company.create({
      data: { userId: Number(ALICE), name: 'InboxTestCorp', domain: 'inboxtest.com' },
      select: { id: true },
    })
    const app = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Inbox Test Role',
        canonicalStatus: 'applied',
        appliedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { id: true },
    })
    return { companyId: company.id, appId: app.id }
  })
  expect(setup.isOk()).toBe(true)
  if (setup.isOk()) {
    testApplicationId = setup.value.appId
  }
})

afterEach(resetInboxState)

// --- Tests ---

describe('findEmailsForReview', () => {
  it('returns emails with processingStatus=needs_review for the correct user', async () => {
    // Seed two emails for Alice: one needs_review, one acted
    await withRls(ALICE, async (tx) => {
      await tx.email.createMany({
        data: [
          {
            userId: Number(ALICE),
            gmailMessageId: `msg-review-${Date.now()}`,
            gmailThreadId: 'thread-1',
            from: 'recruiter@test.com',
            fromDomain: 'test.com',
            subject: 'Review Me',
            bodyExcerpt: 'This needs review',
            processingStatus: 'needs_review',
            classification: 'interview_invite',
            confidence: 0.5,
            classifiedBy: 'rules',
            applicationId: testApplicationId,
            receivedAt: new Date(),
          },
          {
            userId: Number(ALICE),
            gmailMessageId: `msg-acted-${Date.now()}`,
            gmailThreadId: 'thread-2',
            from: 'other@test.com',
            fromDomain: 'test.com',
            subject: 'Already Acted',
            bodyExcerpt: 'This was already acted on',
            processingStatus: 'acted',
            classification: 'rejection',
            confidence: 0.95,
            classifiedBy: 'rules',
            receivedAt: new Date(),
          },
        ],
      })
    })

    const result = await findEmailsForReview(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const items = result.value
    expect(items).toHaveLength(1)
    const item = items[0]!
    expect(item.subject).toBe('Review Me')
    expect(item.classification).toBe('interview_invite')
    expect(item.applicationRoleTitle).toBe('Inbox Test Role')
    expect(item.companyName).toBe('InboxTestCorp')
  })

  it('excludes emails with other processing statuses', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.email.createMany({
        data: [
          {
            userId: Number(ALICE),
            gmailMessageId: `msg-recv-${Date.now()}`,
            gmailThreadId: 'thread-1',
            from: 'a@test.com',
            fromDomain: 'test.com',
            subject: 'Received',
            bodyExcerpt: 'received',
            processingStatus: 'received',
            receivedAt: new Date(),
          },
          {
            userId: Number(ALICE),
            gmailMessageId: `msg-class-${Date.now()}`,
            gmailThreadId: 'thread-2',
            from: 'b@test.com',
            fromDomain: 'test.com',
            subject: 'Classified',
            bodyExcerpt: 'classified',
            processingStatus: 'classified',
            receivedAt: new Date(),
          },
          {
            userId: Number(ALICE),
            gmailMessageId: `msg-failed-${Date.now()}`,
            gmailThreadId: 'thread-3',
            from: 'c@test.com',
            fromDomain: 'test.com',
            subject: 'Failed',
            bodyExcerpt: 'failed',
            processingStatus: 'failed',
            receivedAt: new Date(),
          },
        ],
      })
    })

    const result = await findEmailsForReview(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })

  it('returns empty array for user with no emails', async () => {
    const result = await findEmailsForReview(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })
})

describe('findApplicationsForLink', () => {
  it('returns non-archived applications with company names', async () => {
    const result = await findApplicationsForLink(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const apps = result.value
    // Should have at least the seeded application and the test application
    expect(apps.length).toBeGreaterThanOrEqual(2)

    const testApp = apps.find((a) => a.roleTitle === 'Inbox Test Role')
    expect(testApp).toBeDefined()
    expect(testApp!.companyName).toBe('InboxTestCorp')
  })

  it('excludes archived applications', async () => {
    // Archive the test application
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { archivedAt: new Date() },
      })
    })

    const result = await findApplicationsForLink(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const archivedApp = result.value.find((a) => a.id === testApplicationId)
    expect(archivedApp).toBeUndefined()
  })
})
