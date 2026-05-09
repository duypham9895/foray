// Integration tests for inbox/actions.ts — review Server Actions.
//
// Runs against Testcontainers Postgres seeded by tests/integration/setup.ts
// (alice = UserId(1)).
//
// Tests:
//   T1  confirmClassification sets reviewedByUser=true and processingStatus='acted'
//   T2  overrideClassification updates classification and marks reviewed
//   T3  ignoreEmail sets reviewedByUser=true without changing classification
//   T4  linkToApplication sets applicationId and marks reviewed
//   T5  all actions return { ok: false, error: 'Unauthorized' } when requireUser() fails

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ok, err } from '@/core/errors'
import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

import {
  confirmClassification,
  overrideClassification,
  linkToApplication,
  ignoreEmail,
} from './actions'

// --- Mocks ---

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/core/auth/session', () => ({
  requireUser: vi.fn(),
}))

import { requireUser } from '@/core/auth/session'
const mockRequireUser = vi.mocked(requireUser)

// --- Constants ---

const ALICE = UserId(1)
const SEED_ROLE_TITLE = 'Alice Test Role'

// --- Fixture management ---

async function resetInboxActionsState(): Promise<void> {
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
}

async function createNeedsReviewEmail(): Promise<number> {
  const setup = await withRls(ALICE, async (tx) => {
    const company = await tx.company.create({
      data: { userId: Number(ALICE), name: 'ActionTestCorp', domain: 'actiontest.com' },
      select: { id: true },
    })
    const app = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Action Test Role',
        canonicalStatus: 'applied',
        appliedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: { id: true },
    })
    const email = await tx.email.create({
      data: {
        userId: Number(ALICE),
        gmailMessageId: `msg-action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        gmailThreadId: 'thread-action',
        from: 'recruiter@actiontest.com',
        fromDomain: 'actiontest.com',
        subject: 'Needs Review Email',
        bodyExcerpt: 'This email needs review',
        processingStatus: 'needs_review',
        classification: 'interview_invite',
        confidence: 0.5,
        classifiedBy: 'rules',
        applicationId: app.id,
        receivedAt: new Date(),
      },
      select: { id: true },
    })
    return { companyId: company.id, appId: app.id, emailId: email.id }
  })
  expect(setup.isOk()).toBe(true)
  if (setup.isOk()) {
    return setup.value.emailId
  }
  throw new Error('Failed to create test email')
}

async function getEmailState(emailId: number) {
  return withRls(ALICE, async (tx) => {
    return tx.email.findUnique({
      where: { id: emailId },
      select: {
        reviewedByUser: true,
        processingStatus: true,
        classification: true,
        applicationId: true,
      },
    })
  })
}

beforeEach(async () => {
  await resetInboxActionsState()
  mockRequireUser.mockResolvedValue(ok({ id: ALICE }))
})

afterEach(async () => {
  await resetInboxActionsState()
  vi.restoreAllMocks()
})

// --- Tests ---

describe('confirmClassification', () => {
  it('sets reviewedByUser=true and processingStatus=acted', async () => {
    const emailId = await createNeedsReviewEmail()

    const result = await confirmClassification(emailId)
    expect(result).toEqual({ ok: true })

    const state = await getEmailState(emailId)
    expect(state.isOk()).toBe(true)
    if (state.isErr()) throw state.error
    expect(state.value?.reviewedByUser).toBe(true)
    expect(state.value?.processingStatus).toBe('acted')
    // Classification should remain unchanged
    expect(state.value?.classification).toBe('interview_invite')
  })
})

describe('overrideClassification', () => {
  it('updates classification and marks reviewed', async () => {
    const emailId = await createNeedsReviewEmail()

    const result = await overrideClassification(emailId, 'rejection')
    expect(result).toEqual({ ok: true })

    const state = await getEmailState(emailId)
    expect(state.isOk()).toBe(true)
    if (state.isErr()) throw state.error
    expect(state.value?.reviewedByUser).toBe(true)
    expect(state.value?.processingStatus).toBe('acted')
    expect(state.value?.classification).toBe('rejection')
  })
})

describe('ignoreEmail', () => {
  it('sets reviewedByUser=true without changing classification', async () => {
    const emailId = await createNeedsReviewEmail()

    const result = await ignoreEmail(emailId)
    expect(result).toEqual({ ok: true })

    const state = await getEmailState(emailId)
    expect(state.isOk()).toBe(true)
    if (state.isErr()) throw state.error
    expect(state.value?.reviewedByUser).toBe(true)
    expect(state.value?.processingStatus).toBe('acted')
    // Classification should remain unchanged
    expect(state.value?.classification).toBe('interview_invite')
  })
})

describe('linkToApplication', () => {
  it('sets applicationId and marks reviewed', async () => {
    const emailId = await createNeedsReviewEmail()

    // Create a second application to link to
    const newApp = await withRls(ALICE, async (tx) => {
      const company = await tx.company.create({
        data: { userId: Number(ALICE), name: 'LinkTargetCorp', domain: 'linktarget.com' },
        select: { id: true },
      })
      return tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: company.id,
          roleTitle: 'Link Target Role',
          canonicalStatus: 'applied',
          appliedAt: new Date(),
          lastActivityAt: new Date(),
        },
        select: { id: true },
      })
    })
    expect(newApp.isOk()).toBe(true)
    if (newApp.isErr()) throw newApp.error

    const result = await linkToApplication(emailId, newApp.value.id)
    expect(result).toEqual({ ok: true })

    const state = await getEmailState(emailId)
    expect(state.isOk()).toBe(true)
    if (state.isErr()) throw state.error
    expect(state.value?.reviewedByUser).toBe(true)
    expect(state.value?.processingStatus).toBe('acted')
    expect(state.value?.applicationId).toBe(newApp.value.id)
  })
})

describe('auth error handling', () => {
  it('confirmClassification returns unauthorized when requireUser fails', async () => {
    mockRequireUser.mockResolvedValue(err({ _tag: 'Unauthorized' }))

    const result = await confirmClassification(999)
    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
  })

  it('overrideClassification returns unauthorized when requireUser fails', async () => {
    mockRequireUser.mockResolvedValue(err({ _tag: 'Unauthorized' }))

    const result = await overrideClassification(999, 'rejection')
    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
  })

  it('ignoreEmail returns unauthorized when requireUser fails', async () => {
    mockRequireUser.mockResolvedValue(err({ _tag: 'Unauthorized' }))

    const result = await ignoreEmail(999)
    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
  })

  it('linkToApplication returns unauthorized when requireUser fails', async () => {
    mockRequireUser.mockResolvedValue(err({ _tag: 'Unauthorized' }))

    const result = await linkToApplication(999, 1)
    expect(result).toEqual({ ok: false, error: 'Unauthorized' })
  })
})
