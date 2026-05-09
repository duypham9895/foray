// Integration tests for applications/notes-service.ts.
//
// Mirrors stages-service.test.ts pattern: real Testcontainers Postgres
// seeded by tests/integration/setup.ts. Uses createApplication (Plan 02-02)
// to seed each test's foray inside beforeEach.
//
// The autosave-on-blur behavior under test (per CONTEXT.md §"Specifics" →
// "Notes field"): blank-to-blank does NOT write an Event or bump
// lastActivityAt — that would spam the timeline on every accidental focus.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { ApplicationId, UserId } from '@/core/types/ids'

import { createApplication } from './service'
import { updateApplicationNotes } from './notes-service'

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

describe('updateApplicationNotes', () => {
  it('NT1: null → "first note" updates notes, bumps lastActivityAt, writes Event(note_added)', async () => {
    const appId = await seedAliceAppViaService('NT1 Co')

    const before = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({
        where: { id: appId },
        select: { notes: true, lastActivityAt: true },
      }),
    )
    const beforeSnap = before._unsafeUnwrap()
    expect(beforeSnap!.notes).toBeNull()
    await new Promise((r) => setTimeout(r, 10))

    const result = await updateApplicationNotes(ALICE, ApplicationId(appId), {
      notes: 'first note',
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.notesChanged).toBe(true)

    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: appId },
        select: { notes: true, lastActivityAt: true },
      })
      const events = await tx.event.findMany({
        where: { applicationId: appId, type: 'note_added' },
      })
      return { app, events }
    })
    const { app, events } = verify._unsafeUnwrap()
    expect(app!.notes).toBe('first note')
    expect(app!.lastActivityAt.getTime()).toBeGreaterThan(beforeSnap!.lastActivityAt.getTime())
    expect(events.length).toBe(1)
    expect(events[0]!.source).toBe('manual')
  })

  it('NT2: "first" → "second" updates notes, writes a new Event, bumps lastActivityAt', async () => {
    const appId = await seedAliceAppViaService('NT2 Co')
    // Seed initial notes via the service.
    await updateApplicationNotes(ALICE, ApplicationId(appId), { notes: 'first' })

    const between = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({
        where: { id: appId },
        select: { notes: true, lastActivityAt: true },
      }),
      events: await tx.event.findMany({
        where: { applicationId: appId, type: 'note_added' },
      }),
    }))
    const { app: appBetween, events: eventsBetween } = between._unsafeUnwrap()
    expect(appBetween!.notes).toBe('first')
    expect(eventsBetween.length).toBe(1)
    await new Promise((r) => setTimeout(r, 10))

    const result = await updateApplicationNotes(ALICE, ApplicationId(appId), {
      notes: 'second',
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.notesChanged).toBe(true)

    const verify = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({
        where: { id: appId },
        select: { notes: true, lastActivityAt: true },
      }),
      events: await tx.event.findMany({
        where: { applicationId: appId, type: 'note_added' },
      }),
    }))
    const { app, events } = verify._unsafeUnwrap()
    expect(app!.notes).toBe('second')
    expect(events.length).toBe(2) // one per change
    expect(app!.lastActivityAt.getTime()).toBeGreaterThan(appBetween!.lastActivityAt.getTime())
  })

  it('NT3: blank-to-blank no-op (existing null, new "") returns ok with notesChanged=false; ZERO writes', async () => {
    const appId = await seedAliceAppViaService('NT3 Co')

    const before = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({
        where: { id: appId },
        select: { notes: true, lastActivityAt: true },
      }),
      eventCount: await tx.event.count({
        where: { applicationId: appId, type: 'note_added' },
      }),
    }))
    const beforeSnap = before._unsafeUnwrap()
    expect(beforeSnap.app!.notes).toBeNull()

    const result = await updateApplicationNotes(ALICE, ApplicationId(appId), {
      notes: '',
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.notesChanged).toBe(false)

    const after = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({
        where: { id: appId },
        select: { notes: true, lastActivityAt: true },
      }),
      eventCount: await tx.event.count({
        where: { applicationId: appId, type: 'note_added' },
      }),
    }))
    const afterSnap = after._unsafeUnwrap()
    expect(afterSnap.app!.notes).toBeNull()
    expect(afterSnap.app!.lastActivityAt.getTime()).toBe(
      beforeSnap.app!.lastActivityAt.getTime(),
    )
    expect(afterSnap.eventCount).toBe(beforeSnap.eventCount)
  })

  it('NT4: invalid input (notes > 10_000 chars) returns Validation err; zero writes', async () => {
    const appId = await seedAliceAppViaService('NT4 Co')
    const before = await withRls(ALICE, async (tx) =>
      tx.event.count({ where: { applicationId: appId } }),
    )

    const result = await updateApplicationNotes(ALICE, ApplicationId(appId), {
      notes: 'x'.repeat(10_001),
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
    }

    const after = await withRls(ALICE, async (tx) =>
      tx.event.count({ where: { applicationId: appId } }),
    )
    expect(after._unsafeUnwrap()).toBe(before._unsafeUnwrap())
  })

  it("NT5: cross-tenant — alice on bob's applicationId returns NotFound; bob's notes untouched", async () => {
    // Bob's seeded application has id 2 from setup.ts.
    const bobAppId = 2

    const result = await updateApplicationNotes(ALICE, ApplicationId(bobAppId), {
      notes: 'sneaky',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Application')
      }
    }

    const verify = await withRls(UserId(2), async (tx) =>
      tx.application.findUnique({ where: { id: bobAppId }, select: { notes: true } }),
    )
    expect(verify._unsafeUnwrap()!.notes).toBeNull() // bob's notes never changed
  })
})
