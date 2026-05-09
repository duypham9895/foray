// Integration tests for applications/stages-service.ts.
//
// Mirrors service.test.ts pattern: real Testcontainers Postgres seeded by
// tests/integration/setup.ts (alice = UserId(1), bob = UserId(2); foray_app
// connection with FORCE RLS active). Uses createApplication (Plan 02-02) to
// seed test fixtures inside beforeEach so each test starts from a known
// alice-owned application without manipulating raw Prisma.
//
// Cleanup preserves the seeded "Alice Test Role" + "Alice Corp" so other
// integration test files (rls-escape, tenant-db-cross-tenant-leak) keep
// their assertions green. Bob's row stays untouched throughout.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { ApplicationId, StageId, UserId } from '@/core/types/ids'

import { createApplication } from './service'
import { addStage, completeStage, updateStage } from './stages-service'

const ALICE = UserId(1)
const BOB = UserId(2)
const SEED_ROLE_TITLE = 'Alice Test Role'
const SEED_COMPANY_NAME = 'Alice Corp'

async function resetAliceState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
    await tx.event.deleteMany({ where: { userId: Number(ALICE) } })
    // Stages cascade-delete via Application FK, so wiping non-seed apps wipes their stages.
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

// Helper: seed a fresh alice-owned application via the Plan 02-02 service.
// Returns its ApplicationId. Each test uses a unique companyName so it doesn't
// collide with the seed "Alice Corp" or other tests in the same describe.
async function seedAliceAppViaService(companyName: string): Promise<number> {
  const created = await createApplication(ALICE, {
    companyName,
    roleTitle: 'SWE',
    source: 'direct',
    appliedAt: new Date('2026-01-01'),
  })
  if (!created.isOk()) throw new Error(`seed failed: ${JSON.stringify(created.error)}`)
  return Number(created.value.applicationId)
}

// Helper: seed a stage directly via withRls so updateStage / completeStage tests
// have a starting row.
async function seedStage(
  appId: number,
  overrides: Partial<{ name: string; order: number; completedAt: Date | null; outcome: 'passed' | 'failed' | 'no_response' | null; notes: string | null }> = {},
): Promise<number> {
  const result = await withRls(ALICE, async (tx) => {
    const stage = await tx.stage.create({
      data: {
        applicationId: appId,
        name: overrides.name ?? 'Initial stage',
        order: overrides.order ?? 1,
        completedAt: overrides.completedAt ?? null,
        outcome: overrides.outcome ?? null,
        notes: overrides.notes ?? null,
      },
      select: { id: true },
    })
    return stage.id
  })
  if (!result.isOk()) throw new Error(`seedStage failed: ${JSON.stringify(result.error)}`)
  return result.value
}

// ---------------------------------------------------------------------------
// addStage (AS1–AS5)
// ---------------------------------------------------------------------------

describe('addStage', () => {
  it('AS1: first stage gets order=1; second gets order=2 (per-application MAX+1)', async () => {
    const appId = await seedAliceAppViaService('AS1 Co')

    const r1 = await addStage(ALICE, ApplicationId(appId), { name: 'Recruiter call' })
    expect(r1.isOk()).toBe(true)
    if (r1.isOk()) expect(r1.value.stage.order).toBe(1)

    const r2 = await addStage(ALICE, ApplicationId(appId), { name: 'Tech round 1' })
    expect(r2.isOk()).toBe(true)
    if (r2.isOk()) expect(r2.value.stage.order).toBe(2)

    const verify = await withRls(ALICE, async (tx) =>
      tx.stage.findMany({ where: { applicationId: appId }, orderBy: { order: 'asc' } }),
    )
    const stages = verify._unsafeUnwrap()
    expect(stages.map((s) => s.order)).toEqual([1, 2])
    expect(stages.map((s) => s.name)).toEqual(['Recruiter call', 'Tech round 1'])
  })

  it('AS2: writes Event(type=stage_added, data: {stageId, stageName}); event.applicationId set', async () => {
    const appId = await seedAliceAppViaService('AS2 Co')
    const result = await addStage(ALICE, ApplicationId(appId), { name: 'Phone screen' })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    const newStageId = result.value.stage.id

    const verify = await withRls(ALICE, async (tx) =>
      tx.event.findMany({ where: { applicationId: appId, type: 'stage_added' } }),
    )
    const events = verify._unsafeUnwrap()
    expect(events.length).toBe(1)
    expect(events[0]!.applicationId).toBe(appId)
    expect(events[0]!.source).toBe('manual')
    expect(events[0]!.data).toMatchObject({
      stageId: newStageId,
      stageName: 'Phone screen',
    })
  })

  it('AS3: bumps Application.lastActivityAt above its previous value', async () => {
    const appId = await seedAliceAppViaService('AS3 Co')
    const before = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({ where: { id: appId }, select: { lastActivityAt: true } }),
    )
    const beforeAt = before._unsafeUnwrap()!.lastActivityAt

    // Tiny delay so the new Date() inside addStage is strictly later.
    await new Promise((r) => setTimeout(r, 10))

    const result = await addStage(ALICE, ApplicationId(appId), { name: 'Onsite' })
    expect(result.isOk()).toBe(true)

    const after = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({ where: { id: appId }, select: { lastActivityAt: true } }),
    )
    const afterAt = after._unsafeUnwrap()!.lastActivityAt
    expect(afterAt.getTime()).toBeGreaterThan(beforeAt.getTime())
  })

  it("AS4: cross-tenant — alice on bob's applicationId returns NotFound; zero Stage rows written", async () => {
    // Bob's seeded application has id 2 from setup.ts.
    const bobAppId = 2
    const beforeStageCount = await withRls(BOB, async (tx) =>
      tx.stage.count({ where: { applicationId: bobAppId } }),
    )

    const result = await addStage(ALICE, ApplicationId(bobAppId), { name: 'Sneaky stage' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Application')
      }
    }

    const afterStageCount = await withRls(BOB, async (tx) =>
      tx.stage.count({ where: { applicationId: bobAppId } }),
    )
    expect(afterStageCount._unsafeUnwrap()).toBe(beforeStageCount._unsafeUnwrap())
  })

  it('AS5: invalid input (empty name) returns Validation err; zero writes', async () => {
    const appId = await seedAliceAppViaService('AS5 Co')
    const beforeCount = await withRls(ALICE, async (tx) =>
      tx.stage.count({ where: { applicationId: appId } }),
    )

    const result = await addStage(ALICE, ApplicationId(appId), { name: '' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
    }

    const afterCount = await withRls(ALICE, async (tx) =>
      tx.stage.count({ where: { applicationId: appId } }),
    )
    expect(afterCount._unsafeUnwrap()).toBe(beforeCount._unsafeUnwrap())
  })
})

// ---------------------------------------------------------------------------
// updateStage (US1–US3)
// ---------------------------------------------------------------------------

describe('updateStage', () => {
  it('US1: partial patch (only notes) updates row, bumps lastActivityAt, writes ZERO Events', async () => {
    const appId = await seedAliceAppViaService('US1 Co')
    const stageId = await seedStage(appId, { name: 'Recruiter call' })

    const before = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({
        where: { id: appId },
        select: { lastActivityAt: true },
      }),
      eventCount: await tx.event.count({ where: { applicationId: appId } }),
    }))
    const { app: appBefore, eventCount: eventCountBefore } = before._unsafeUnwrap()

    await new Promise((r) => setTimeout(r, 10))

    const result = await updateStage(ALICE, StageId(stageId), { notes: 'went well' })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.stage.notes).toBe('went well')

    const after = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({
        where: { id: appId },
        select: { lastActivityAt: true },
      }),
      stage: await tx.stage.findUnique({ where: { id: stageId } }),
      eventCount: await tx.event.count({ where: { applicationId: appId } }),
    }))
    const { app: appAfter, stage, eventCount: eventCountAfter } = after._unsafeUnwrap()
    expect(stage!.notes).toBe('went well')
    expect(stage!.name).toBe('Recruiter call') // untouched
    expect(appAfter!.lastActivityAt.getTime()).toBeGreaterThan(
      appBefore!.lastActivityAt.getTime(),
    )
    expect(eventCountAfter).toBe(eventCountBefore) // no event spam from partial edit
  })

  it("US2: cross-tenant — alice on bob's stageId returns NotFound; no update happens", async () => {
    // Seed a stage on bob's seeded app via raw prisma (RLS-disabled scope inside withRls(BOB)).
    const bobAppId = 2
    const stageResult = await withRls(BOB, async (tx) => {
      const stage = await tx.stage.create({
        data: { applicationId: bobAppId, name: 'Bob stage', order: 1 },
        select: { id: true, name: true },
      })
      return stage
    })
    expect(stageResult.isOk()).toBe(true)
    if (!stageResult.isOk()) return
    const bobStageId = stageResult.value.id

    const result = await updateStage(ALICE, StageId(bobStageId), { name: 'Hijacked' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Stage')
      }
    }

    // Verify bob's stage was NOT renamed.
    const verify = await withRls(BOB, async (tx) =>
      tx.stage.findUnique({ where: { id: bobStageId } }),
    )
    expect(verify._unsafeUnwrap()!.name).toBe('Bob stage')
  })

  it('US3: full patch (name + scheduledAt + notes) updates all three columns', async () => {
    const appId = await seedAliceAppViaService('US3 Co')
    const stageId = await seedStage(appId, { name: 'Original' })

    const scheduledAt = new Date('2026-06-15T10:00:00Z')
    const result = await updateStage(ALICE, StageId(stageId), {
      name: 'Renamed',
      scheduledAt,
      notes: 'fresh notes',
    })
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) =>
      tx.stage.findUnique({ where: { id: stageId } }),
    )
    const stage = verify._unsafeUnwrap()
    expect(stage!.name).toBe('Renamed')
    expect(stage!.scheduledAt!.getTime()).toBe(scheduledAt.getTime())
    expect(stage!.notes).toBe('fresh notes')
  })
})

// ---------------------------------------------------------------------------
// completeStage (CS1–CS3)
// ---------------------------------------------------------------------------

describe('completeStage', () => {
  it('CS1: sets completedAt + outcome, writes Event(stage_completed), bumps lastActivityAt', async () => {
    const appId = await seedAliceAppViaService('CS1 Co')
    const stageId = await seedStage(appId, { name: 'Tech round' })

    const before = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({
        where: { id: appId },
        select: { lastActivityAt: true },
      }),
    )
    const beforeAt = before._unsafeUnwrap()!.lastActivityAt
    await new Promise((r) => setTimeout(r, 10))

    const result = await completeStage(ALICE, StageId(stageId), 'passed')
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) => {
      const stage = await tx.stage.findUnique({ where: { id: stageId } })
      const events = await tx.event.findMany({
        where: { applicationId: appId, type: 'stage_completed' },
      })
      const app = await tx.application.findUnique({
        where: { id: appId },
        select: { lastActivityAt: true },
      })
      return { stage, events, app }
    })
    const { stage, events, app } = verify._unsafeUnwrap()
    expect(stage!.completedAt).not.toBeNull()
    expect(stage!.outcome).toBe('passed')
    expect(events.length).toBe(1)
    expect(events[0]!.source).toBe('manual')
    expect(events[0]!.data).toMatchObject({ stageId, outcome: 'passed' })
    expect(app!.lastActivityAt.getTime()).toBeGreaterThan(beforeAt.getTime())
  })

  it('CS2: completing an already-completed stage returns Conflict STAGE_ALREADY_COMPLETED; zero writes', async () => {
    const appId = await seedAliceAppViaService('CS2 Co')
    const stageId = await seedStage(appId, {
      name: 'Already done',
      completedAt: new Date('2026-02-01'),
      outcome: 'passed',
    })

    const before = await withRls(ALICE, async (tx) => ({
      stage: await tx.stage.findUnique({ where: { id: stageId } }),
      eventCount: await tx.event.count({ where: { applicationId: appId } }),
    }))
    const beforeSnap = before._unsafeUnwrap()

    const result = await completeStage(ALICE, StageId(stageId), 'failed')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Conflict')
      if (result.error._tag === 'Conflict') {
        expect(result.error.reason).toBe('STAGE_ALREADY_COMPLETED')
      }
    }

    const after = await withRls(ALICE, async (tx) => ({
      stage: await tx.stage.findUnique({ where: { id: stageId } }),
      eventCount: await tx.event.count({ where: { applicationId: appId } }),
    }))
    const afterSnap = after._unsafeUnwrap()
    expect(afterSnap.stage!.outcome).toBe('passed') // unchanged
    expect(afterSnap.stage!.completedAt!.getTime()).toBe(
      beforeSnap.stage!.completedAt!.getTime(),
    )
    expect(afterSnap.eventCount).toBe(beforeSnap.eventCount)
  })

  it("CS3: cross-tenant — alice on bob's stageId returns NotFound", async () => {
    const bobAppId = 2
    const stageResult = await withRls(BOB, async (tx) =>
      tx.stage.create({
        data: { applicationId: bobAppId, name: 'Bob to-complete', order: 1 },
        select: { id: true },
      }),
    )
    expect(stageResult.isOk()).toBe(true)
    if (!stageResult.isOk()) return
    const bobStageId = stageResult.value.id

    const result = await completeStage(ALICE, StageId(bobStageId), 'passed')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Stage')
      }
    }

    // Bob's stage stays untouched (no completedAt).
    const verify = await withRls(BOB, async (tx) =>
      tx.stage.findUnique({ where: { id: bobStageId } }),
    )
    expect(verify._unsafeUnwrap()!.completedAt).toBeNull()
  })
})
