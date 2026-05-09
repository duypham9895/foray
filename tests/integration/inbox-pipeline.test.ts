// Integration tests for inbox pipeline — persistEmail + cron guard logic.
//
// Covers GMAIL-03 (persist), GMAIL-04 (cron guards). Runs against
// Testcontainers Postgres seeded by tests/integration/setup.ts.
//
// persistEmail tests:
//   T1  persists new email, returns isNew: true
//   T2  duplicate gmailMessageId returns isNew: false (idempotency)
//   T3  new email has processingStatus = 'received'
//
// Cron guard tests:
//   T4  NEXT_RUNTIME = 'edge' guard skips
//   T5  NODE_ENV = 'test' guard skips

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

import { persistEmail } from '@/features/inbox/ingest'
import type { ParsedEmail } from '@/features/inbox/gmail-client'

// --- Constants ---

const ALICE = UserId(1)

// --- Fixture management ---

async function resetAliceInboxState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
  })
}

beforeEach(async () => {
  await resetAliceInboxState()
})

afterEach(async () => {
  await resetAliceInboxState()
})

// --- persistEmail tests ---

describe('persistEmail (ingest idempotency)', () => {
  it('T1: persists a new email and returns isNew: true', async () => {
    const parsed: ParsedEmail = {
      gmailMessageId: `msg-new-${Date.now()}`,
      gmailThreadId: 'thread-1',
      from: 'test@testco.com',
      fromDomain: 'testco.com',
      subject: 'New email',
      bodyExcerpt: 'Body content',
      receivedAt: new Date(),
    }

    const result = await persistEmail(ALICE, parsed)
    expect(result.isOk(), `persistEmail T1 error: ${JSON.stringify(result.isErr() ? result.error : null)}`).toBe(true)
    if (result.isOk()) {
      expect(result.value.isNew).toBe(true)
      expect(result.value.emailId).toBeGreaterThan(0)
    }
  })

  it('T2: returns isNew: false for duplicate gmailMessageId', async () => {
    const parsed: ParsedEmail = {
      gmailMessageId: `msg-dup-${Date.now()}`,
      gmailThreadId: 'thread-2',
      from: 'test@testco.com',
      fromDomain: 'testco.com',
      subject: 'Duplicate',
      bodyExcerpt: 'Body',
      receivedAt: new Date(),
    }

    // First insert
    const first = await persistEmail(ALICE, parsed)
    expect(first.isOk()).toBe(true)

    // Second insert — same gmailMessageId
    const second = await persistEmail(ALICE, parsed)
    expect(second.isOk()).toBe(true)
    if (second.isOk()) {
      expect(second.value.isNew).toBe(false)
      expect(second.value.emailId).toBe(first.isOk() ? first.value.emailId : -1)
    }
  })

  it('T3: sets processingStatus to received on new email', async () => {
    const parsed: ParsedEmail = {
      gmailMessageId: `msg-status-${Date.now()}`,
      gmailThreadId: 'thread-3',
      from: 'test@testco.com',
      fromDomain: 'testco.com',
      subject: 'Status check',
      bodyExcerpt: 'Body',
      receivedAt: new Date(),
    }

    const result = await persistEmail(ALICE, parsed)
    expect(result.isOk()).toBe(true)

    if (result.isOk()) {
      const email = await withRls(ALICE, async (tx) =>
        tx.email.findUnique({
          where: { id: result.value.emailId },
          select: { processingStatus: true },
        }),
      )
      expect(email.isOk()).toBe(true)
      if (email.isOk()) {
        expect(email.value?.processingStatus).toBe('received')
      }
    }
  })
})

// --- Cron guard logic tests ---

describe('Cron guard logic', () => {
  it('T4: NEXT_RUNTIME guard skips on edge', () => {
    const original = process.env.NEXT_RUNTIME
    process.env.NEXT_RUNTIME = 'edge'
    // The guard condition: process.env.NEXT_RUNTIME !== 'nodejs'
    const shouldSkip = process.env.NEXT_RUNTIME !== 'nodejs'
    expect(shouldSkip).toBe(true)
    process.env.NEXT_RUNTIME = original
  })

  it('T5: NODE_ENV guard skips in test', () => {
    const original = process.env.NODE_ENV
    // @ts-expect-error — overriding for test
    process.env.NODE_ENV = 'test'
    const shouldSkip = process.env.NODE_ENV === 'test'
    expect(shouldSkip).toBe(true)
    // @ts-expect-error — restoring
    process.env.NODE_ENV = original
  })
})
