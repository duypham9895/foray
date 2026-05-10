// Integration tests for core/queries/search.ts.
//
// Runs against the Testcontainers Postgres seeded by tests/integration/setup.ts:
//   alice = UserId(1), bob = UserId(2)
//   one Company + one Application per user
//
// Uses withRls(ALICE) for seeding and assertion reads.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { UserId } from '@/core/types/ids'

import { fullTextSearch } from './search'

const ALICE = UserId(1)
const SEED_ROLE_TITLE = 'Alice Test Role'
const SEED_COMPANY_NAME = 'Alice Corp'

async function resetAliceState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
    await tx.event.deleteMany({ where: { userId: Number(ALICE) } })
    await tx.application.deleteMany({
      where: { userId: Number(ALICE), roleTitle: { not: SEED_ROLE_TITLE } },
    })
    await tx.company.deleteMany({
      where: { userId: Number(ALICE), name: { not: SEED_COMPANY_NAME } },
    })
  })
}

beforeEach(async () => {
  await resetAliceState()
})

afterEach(async () => {
  await resetAliceState()
})

describe('fullTextSearch', () => {
  it('finds applications by role title', async () => {
    const result = await fullTextSearch(ALICE, 'Test Role')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.applications.length).toBeGreaterThanOrEqual(1)
      const app = result.value.applications[0]!
      expect(app.roleTitle).toContain('Test Role')
    }
  })

  it('finds applications by case-insensitive match', async () => {
    const result = await fullTextSearch(ALICE, 'test role')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.applications.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('finds emails by subject', async () => {
    // Seed an email with a distinctive subject
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
      const app = await tx.application.findFirst({
        where: { userId: Number(ALICE), roleTitle: SEED_ROLE_TITLE },
      })
      if (!app) throw new Error('Seed application not found')
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          applicationId: app.id,
          gmailMessageId: `test-search-${Date.now()}`,
          gmailThreadId: 'test-thread',
          from: 'recruiter@example.com',
          fromDomain: 'example.com',
          subject: 'Interview invitation for Senior Engineer',
          bodyExcerpt: 'We would like to invite you for an interview',
          receivedAt: new Date(),
        },
      })
    })

    const result = await fullTextSearch(ALICE, 'Interview invitation')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.emails.length).toBeGreaterThanOrEqual(1)
      const email = result.value.emails[0]!
      expect(email.subject).toContain('Interview invitation')
    }
  })

  it('finds stages by name', async () => {
    // Seed a stage with a distinctive name
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
      const app = await tx.application.findFirst({
        where: { userId: Number(ALICE), roleTitle: SEED_ROLE_TITLE },
      })
      if (!app) throw new Error('Seed application not found')
      await tx.stage.create({
        data: {
          applicationId: app.id,
          name: 'Technical Phone Screen',
          order: 1,
        },
      })
    })

    const result = await fullTextSearch(ALICE, 'Phone Screen')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.stages.length).toBeGreaterThanOrEqual(1)
      const stage = result.value.stages[0]!
      expect(stage.name).toContain('Phone Screen')
    }
  })

  it('returns empty results for non-matching query', async () => {
    const result = await fullTextSearch(ALICE, 'xyznonexistent123')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.applications).toHaveLength(0)
      expect(result.value.emails).toHaveLength(0)
      expect(result.value.stages).toHaveLength(0)
    }
  })

  it('returns empty results for empty query', async () => {
    const result = await fullTextSearch(ALICE, '')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.applications).toHaveLength(0)
      expect(result.value.emails).toHaveLength(0)
      expect(result.value.stages).toHaveLength(0)
    }
  })

  it('does not leak results from other tenants', async () => {
    const BOB = UserId(2)
    const result = await fullTextSearch(BOB, 'Test Role')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      // Bob should not see Alice's seeded application
      const found = result.value.applications.find(
        (a) => a.roleTitle === SEED_ROLE_TITLE,
      )
      expect(found).toBeUndefined()
    }
  })

  it('completes in under 300ms', async () => {
    const start = Date.now()
    const result = await fullTextSearch(ALICE, 'test')
    const elapsed = Date.now() - start
    expect(result.isOk()).toBe(true)
    expect(elapsed).toBeLessThan(300)
  })
})
