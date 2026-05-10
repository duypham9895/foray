// Integration tests for applications/follow-up-service.ts.
//
// Mirrors notes-service.test.ts pattern: real Testcontainers Postgres
// seeded by tests/integration/setup.ts. Uses createApplication to seed
// each test's foray inside beforeEach.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { ApplicationId, UserId } from '@/core/types/ids'

import { createApplication } from './service'
import { setFollowUp, clearFollowUp } from './follow-up-service'

const ALICE = UserId(1)
const BOB = UserId(2)
const SEED_ROLE_TITLE = 'Alice Test Role'
const SEED_COMPANY_NAME = 'Alice Corp'

async function resetAliceState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
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

async function seedAliceApp(companyName: string): Promise<number> {
  const created = await createApplication(ALICE, {
    companyName,
    roleTitle: 'SWE',
    source: 'direct',
    appliedAt: new Date('2026-01-01'),
  })
  if (!created.isOk()) throw new Error(`seed failed: ${JSON.stringify(created.error)}`)
  return Number(created.value.applicationId)
}

describe('setFollowUp', () => {
  it('sets followUpAt on an application', async () => {
    const appId = await seedAliceApp('FU-Set Co')
    const futureDate = new Date('2026-06-01')

    const result = await setFollowUp(ALICE, ApplicationId(appId), futureDate)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.id).toBe(appId)
      expect(result.value.followUpAt).toEqual(futureDate)
    }

    // Verify in DB
    const verify = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({ where: { id: appId }, select: { followUpAt: true } }),
    )
    expect(verify._unsafeUnwrap()!.followUpAt).toEqual(futureDate)
  })

  it('returns NotFound when application does not exist', async () => {
    const result = await setFollowUp(ALICE, ApplicationId(99999), new Date())
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Application')
      }
    }
  })

  it("returns NotFound when application belongs to different user", async () => {
    // Bob's seed application has id 2 from setup.ts
    const result = await setFollowUp(ALICE, ApplicationId(2), new Date())
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it('overwrites existing followUpAt', async () => {
    const appId = await seedAliceApp('FU-Overwrite Co')
    const date1 = new Date('2026-06-01')
    const date2 = new Date('2026-07-01')

    await setFollowUp(ALICE, ApplicationId(appId), date1)
    const result = await setFollowUp(ALICE, ApplicationId(appId), date2)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.followUpAt).toEqual(date2)
    }
  })
})

describe('clearFollowUp', () => {
  it('sets followUpAt to null', async () => {
    const appId = await seedAliceApp('FU-Clear Co')
    await setFollowUp(ALICE, ApplicationId(appId), new Date('2026-06-01'))

    const result = await clearFollowUp(ALICE, ApplicationId(appId))
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.id).toBe(appId)
    }

    // Verify in DB
    const verify = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({ where: { id: appId }, select: { followUpAt: true } }),
    )
    expect(verify._unsafeUnwrap()!.followUpAt).toBeNull()
  })

  it('returns NotFound when application does not exist', async () => {
    const result = await clearFollowUp(ALICE, ApplicationId(99999))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it("returns NotFound when application belongs to different user", async () => {
    const result = await clearFollowUp(ALICE, ApplicationId(2))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it('clearing already-null followUpAt is idempotent', async () => {
    const appId = await seedAliceApp('FU-Idempotent Co')
    // followUpAt is null by default
    const result = await clearFollowUp(ALICE, ApplicationId(appId))
    expect(result.isOk()).toBe(true)
  })
})
