// Integration tests for applications/service.ts.
//
// Runs against the Testcontainers Postgres seeded by tests/integration/setup.ts:
//   alice = UserId(1), bob = UserId(2)
//   one Company + one Application per user
//   process.env.DATABASE_URL → foray_app (FORCE RLS active)
//
// Fixture rules:
//   - beforeEach resets alice's rows (applications/events/emails created by
//     tests, plus extra companies); bob's row stays untouched so CR6 can
//     verify cross-tenant isolation.
//   - Tests use withRls(ALICE) for assertion reads because foray_app needs
//     the GUC to be set.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { ApplicationId, EventId, UserId } from '@/core/types/ids'
import {
  applyAutoStatusChange,
  applyManualStatusChange,
  createApplication,
  undoStatusChange,
} from './service'

const ALICE = UserId(1)
const BOB = UserId(2)

// Cleanup helper. Wipes data created by THIS test file between tests so each
// test starts from a known minimal state. Critically: preserves the seeded
// "Alice Test Role" application + Alice Corp company so other integration
// test files (rls-escape, tenant-db-cross-tenant-leak) still see the seeded
// fixture they assert on. Bob's row stays untouched throughout.
//
// Order matters: emails (FK applications) → events (FK applications) →
// applications (FK companies) → extra companies. RLS is set so our deletes
// are scoped to alice (suspenders); explicit WHERE userId=ALICE is the belt.
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

// ---------------------------------------------------------------------------
// createApplication (CR1–CR6)
// ---------------------------------------------------------------------------

describe('createApplication', () => {
  it('CR1: valid input writes 1 Application + 1 Event(type=created, source=manual) atomically', async () => {
    const result = await createApplication(ALICE, {
      companyName: 'Stripe',
      roleTitle: 'Senior SWE',
      source: 'direct',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    const { applicationId, eventId } = result.value
    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: Number(applicationId) },
        include: { company: true },
      })
      const event = await tx.event.findUnique({
        where: { id: Number(eventId) },
      })
      return { app, event }
    })
    expect(verify.isOk()).toBe(true)
    const { app, event } = verify._unsafeUnwrap()
    expect(app).not.toBeNull()
    expect(app!.userId).toBe(Number(ALICE))
    expect(app!.roleTitle).toBe('Senior SWE')
    expect(app!.canonicalStatus).toBe('applied')
    expect(app!.lastActivityAt.getTime()).toBe(app!.appliedAt.getTime())
    expect(event).not.toBeNull()
    expect(event!.type).toBe('created')
    expect(event!.source).toBe('manual')
    expect(event!.applicationId).toBe(app!.id)
  })

  it('CR2: companyName matching an existing Company is reused (case-insensitive trim)', async () => {
    // Alice Corp seeded; capture its id once.
    const seed = await withRls(ALICE, async (tx) =>
      tx.company.findFirstOrThrow({
        where: { userId: Number(ALICE), name: 'Alice Corp' },
        select: { id: true },
      }),
    )
    const seedAliceCorpId = seed._unsafeUnwrap().id

    const result = await createApplication(ALICE, {
      companyName: '  alice corp  ', // mixed case + whitespace
      roleTitle: 'PM',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: Number(result.value.applicationId) },
      })
      const aliceCompanies = await tx.company.findMany({
        where: { userId: Number(ALICE), name: { equals: 'Alice Corp', mode: 'insensitive' } },
      })
      return { app, aliceCompanies }
    })
    const { app, aliceCompanies } = verify._unsafeUnwrap()
    expect(app!.companyId).toBe(seedAliceCorpId)
    expect(aliceCompanies.length).toBe(1) // no new Company created
  })

  it('CR3: novel companyName creates a new Company first, then the Application', async () => {
    const result = await createApplication(ALICE, {
      companyName: 'NeverSeen Inc',
      companyDomain: 'neverseen.com',
      roleTitle: 'IC',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({
        where: { id: Number(result.value.applicationId) },
        include: { company: true },
      })
      return app
    })
    const app = verify._unsafeUnwrap()
    expect(app!.company.name).toBe('NeverSeen Inc')
    expect(app!.company.domain).toBe('neverseen.com')
  })

  it('CR4: invalid input (empty companyName) returns Validation err and writes zero rows', async () => {
    const before = await withRls(ALICE, async (tx) => ({
      apps: await tx.application.count({ where: { userId: Number(ALICE) } }),
      events: await tx.event.count({ where: { userId: Number(ALICE) } }),
    }))
    const beforeCounts = before._unsafeUnwrap()

    const result = await createApplication(ALICE, {
      companyName: '',
      roleTitle: 'PM',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
    }

    const after = await withRls(ALICE, async (tx) => ({
      apps: await tx.application.count({ where: { userId: Number(ALICE) } }),
      events: await tx.event.count({ where: { userId: Number(ALICE) } }),
    }))
    const afterCounts = after._unsafeUnwrap()
    expect(afterCounts.apps).toBe(beforeCounts.apps)
    expect(afterCounts.events).toBe(beforeCounts.events)
  })

  it('CR5: ATS domain in companyDomain returns Validation err (defense-in-depth via safeParse)', async () => {
    const result = await createApplication(ALICE, {
      companyName: 'Stripe',
      companyDomain: 'greenhouse.io',
      roleTitle: 'PM',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
      if (result.error._tag === 'Validation') {
        const message = result.error.issues.map((i) => i.message).join(' ')
        expect(message).toContain('ATS')
      }
    }
  })

  it("CR6: alice's createApplication is invisible to bob via withRls(BOB) (RLS isolation)", async () => {
    const result = await createApplication(ALICE, {
      companyName: 'Stripe',
      roleTitle: 'SWE',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    // Inside withRls(BOB), even an explicit raw query for alice's row returns nothing.
    const bobView = await withRls(BOB, async (tx) =>
      tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM applications WHERE id = ${Number(result.value.applicationId)}
      `,
    )
    expect(bobView.isOk()).toBe(true)
    expect(bobView._unsafeUnwrap()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Helper: seed an application owned by alice with a given canonicalStatus.
// Used by manual/auto/undo tests below as their starting state.
// ---------------------------------------------------------------------------

async function seedAliceApplication(canonicalStatus: 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn' = 'applied'): Promise<number> {
  const result = await withRls(ALICE, async (tx) => {
    const company = await tx.company.findFirstOrThrow({
      where: { userId: Number(ALICE), name: 'Alice Corp' },
      select: { id: true },
    })
    const app = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Test Role',
        canonicalStatus,
        appliedAt: new Date('2026-01-01'),
        lastActivityAt: new Date('2026-01-01'),
      },
      select: { id: true },
    })
    return app.id
  })
  return result._unsafeUnwrap()
}

// ---------------------------------------------------------------------------
// applyManualStatusChange (M1–M4)
// ---------------------------------------------------------------------------

describe('applyManualStatusChange', () => {
  it('M1: applied → screening updates row + writes status_changed Event + bumps lastActivityAt', async () => {
    const appId = await seedAliceApplication('applied')

    const result = await applyManualStatusChange(ALICE, ApplicationId(appId), 'screening')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.event).not.toBeNull()

    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({ where: { id: appId } })
      const events = await tx.event.findMany({
        where: { applicationId: appId, type: 'status_changed' },
      })
      return { app, events }
    })
    const { app, events } = verify._unsafeUnwrap()
    expect(app!.canonicalStatus).toBe('screening')
    expect(app!.lastActivityAt.getTime()).toBeGreaterThan(new Date('2026-01-01').getTime())
    expect(events.length).toBe(1)
    expect(events[0]!.source).toBe('manual')
    expect(events[0]!.data).toMatchObject({
      previousStatus: 'applied',
      newStatus: 'screening',
    })
  })

  it('M2: same-status no-op writes zero events, leaves lastActivityAt unchanged', async () => {
    const appId = await seedAliceApplication('screening')

    const before = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({ where: { id: appId } }),
      eventCount: await tx.event.count({
        where: { applicationId: appId, type: 'status_changed' },
      }),
    }))
    const { app: appBefore, eventCount: eventCountBefore } = before._unsafeUnwrap()

    const result = await applyManualStatusChange(ALICE, ApplicationId(appId), 'screening')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.event).toBeNull()
    }

    const after = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({ where: { id: appId } }),
      eventCount: await tx.event.count({
        where: { applicationId: appId, type: 'status_changed' },
      }),
    }))
    const { app: appAfter, eventCount: eventCountAfter } = after._unsafeUnwrap()
    expect(appAfter!.lastActivityAt.getTime()).toBe(appBefore!.lastActivityAt.getTime())
    expect(eventCountAfter).toBe(eventCountBefore)
  })

  it('M3: application not in tenant returns NotFound err', async () => {
    // 999999 belongs to neither alice nor bob.
    const result = await applyManualStatusChange(ALICE, ApplicationId(999_999), 'screening')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Application')
      }
    }
  })

  it('M4: manual change bypasses regression block (offer → applied succeeds)', async () => {
    const appId = await seedAliceApplication('offer')

    const result = await applyManualStatusChange(ALICE, ApplicationId(appId), 'applied')
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) =>
      tx.application.findUnique({ where: { id: appId } }),
    )
    expect(verify._unsafeUnwrap()!.canonicalStatus).toBe('applied')
  })
})

// ---------------------------------------------------------------------------
// applyAutoStatusChange (A1–A5)
// ---------------------------------------------------------------------------

describe('applyAutoStatusChange', () => {
  it('A1: forward change writes auto_status_changed Event(undoable=true) with full attribution', async () => {
    const appId = await seedAliceApplication('applied')

    const result = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'screening',
      source: 'cron',
      classifierConfidence: 0.92,
      classifiedBy: 'rules',
    })
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({ where: { id: appId } })
      const events = await tx.event.findMany({
        where: { applicationId: appId, type: 'auto_status_changed' },
      })
      return { app, events }
    })
    const { app, events } = verify._unsafeUnwrap()
    expect(app!.canonicalStatus).toBe('screening')
    expect(events.length).toBe(1)
    expect(events[0]!.undoable).toBe(true)
    expect(events[0]!.source).toBe('cron')
    expect(events[0]!.data).toMatchObject({
      previousStatus: 'applied',
      newStatus: 'screening',
      classifierConfidence: 0.92,
      classifiedBy: 'rules',
    })
  })

  it('A2: regression (offer → screening) returns Conflict err, zero writes', async () => {
    const appId = await seedAliceApplication('offer')
    const before = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({ where: { id: appId } }),
      eventCount: await tx.event.count({ where: { applicationId: appId } }),
    }))
    const beforeSnap = before._unsafeUnwrap()

    const result = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'screening',
      source: 'cron',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Conflict')
      if (result.error._tag === 'Conflict') {
        expect(result.error.reason).toBe('STATUS_REGRESSION_REQUIRES_REVIEW')
      }
    }

    const after = await withRls(ALICE, async (tx) => ({
      app: await tx.application.findUnique({ where: { id: appId } }),
      eventCount: await tx.event.count({ where: { applicationId: appId } }),
    }))
    const afterSnap = after._unsafeUnwrap()
    expect(afterSnap.app!.canonicalStatus).toBe('offer') // unchanged
    expect(afterSnap.eventCount).toBe(beforeSnap.eventCount)
  })

  it('A3: same-status no-op returns ok with event=null, zero writes', async () => {
    const appId = await seedAliceApplication('screening')
    const before = await withRls(ALICE, async (tx) =>
      tx.event.count({ where: { applicationId: appId } }),
    )

    const result = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'screening',
      source: 'cron',
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.event).toBeNull()

    const after = await withRls(ALICE, async (tx) =>
      tx.event.count({ where: { applicationId: appId } }),
    )
    expect(after._unsafeUnwrap()).toBe(before._unsafeUnwrap())
  })

  it('A4: application not in tenant returns NotFound err', async () => {
    const result = await applyAutoStatusChange(ALICE, ApplicationId(999_999), {
      newStatus: 'screening',
      source: 'cron',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it('A5: emailId is included in the parsed Event.data via the strict() schema (no post-parse spread)', async () => {
    // Seed a real Email row owned by alice so emailId references something valid.
    const appId = await seedAliceApplication('applied')
    const seedEmail = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          applicationId: appId,
          gmailMessageId: 'gm-test-a5-' + Date.now(),
          gmailThreadId: 'thr-test-a5',
          from: 'recruiter@example.com',
          fromDomain: 'example.com',
          subject: 'Next steps',
          bodyExcerpt: 'thanks for applying',
          receivedAt: new Date(),
        },
        select: { id: true },
      }),
    )
    const emailId = seedEmail._unsafeUnwrap().id

    const result = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'screening',
      source: 'cron',
      classifierConfidence: 0.91,
      classifiedBy: 'rules',
      emailId,
    })
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) =>
      tx.event.findFirst({
        where: { applicationId: appId, type: 'auto_status_changed' },
      }),
    )
    const event = verify._unsafeUnwrap()
    expect(event!.data).toMatchObject({
      previousStatus: 'applied',
      newStatus: 'screening',
      classifierConfidence: 0.91,
      classifiedBy: 'rules',
      emailId,
    })
  })
})

// ---------------------------------------------------------------------------
// undoStatusChange (U1–U5)
// ---------------------------------------------------------------------------

describe('undoStatusChange', () => {
  it('U1: undo restores Application.canonicalStatus, marks original undoneAt, writes status_undone event', async () => {
    const appId = await seedAliceApplication('applied')
    const auto = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'screening',
      source: 'cron',
      classifierConfidence: 0.9,
      classifiedBy: 'rules',
    })
    expect(auto.isOk()).toBe(true)
    if (!auto.isOk()) return
    const originalEventId = auto.value.event!.id

    const result = await undoStatusChange(ALICE, EventId(originalEventId))
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) => {
      const app = await tx.application.findUnique({ where: { id: appId } })
      const original = await tx.event.findUnique({ where: { id: originalEventId } })
      const undone = await tx.event.findFirst({
        where: { applicationId: appId, type: 'status_undone' },
      })
      const emailUpdates = await tx.email.count({
        where: { userId: Number(ALICE), reviewedByUser: true },
      })
      return { app, original, undone, emailUpdates }
    })
    const { app, original, undone, emailUpdates } = verify._unsafeUnwrap()
    expect(app!.canonicalStatus).toBe('applied')
    expect(original!.undoneAt).not.toBeNull()
    expect(undone).not.toBeNull()
    expect(undone!.source).toBe('manual')
    expect(undone!.data).toMatchObject({
      undoneEventId: originalEventId,
      restoredStatus: 'applied',
    })
    expect(emailUpdates).toBe(0) // no linked email — no email writes
  })

  it("U2: undo with linked emailId also sets Email.reviewedByUser=true", async () => {
    const appId = await seedAliceApplication('applied')
    const seedEmail = await withRls(ALICE, async (tx) =>
      tx.email.create({
        data: {
          userId: Number(ALICE),
          applicationId: appId,
          gmailMessageId: 'gm-test-u2-' + Date.now(),
          gmailThreadId: 'thr-test-u2',
          from: 'recruiter@example.com',
          fromDomain: 'example.com',
          subject: 'Bad news',
          bodyExcerpt: 'unfortunately',
          receivedAt: new Date(),
          reviewedByUser: false,
        },
        select: { id: true },
      }),
    )
    const emailId = seedEmail._unsafeUnwrap().id

    const auto = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'rejected',
      source: 'cron',
      classifierConfidence: 0.95,
      classifiedBy: 'rules',
      emailId,
    })
    expect(auto.isOk()).toBe(true)
    if (!auto.isOk()) return

    const result = await undoStatusChange(ALICE, EventId(auto.value.event!.id))
    expect(result.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) =>
      tx.email.findUnique({ where: { id: emailId } }),
    )
    expect(verify._unsafeUnwrap()!.reviewedByUser).toBe(true)
  })

  it('U3: undo on a non-auto_status_changed event returns Conflict EVENT_NOT_UNDOABLE', async () => {
    const appId = await seedAliceApplication('applied')
    const manual = await applyManualStatusChange(ALICE, ApplicationId(appId), 'screening')
    expect(manual.isOk()).toBe(true)
    if (!manual.isOk()) return
    const manualEventId = manual.value.event!.id

    const result = await undoStatusChange(ALICE, EventId(manualEventId))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Conflict')
      if (result.error._tag === 'Conflict') {
        expect(result.error.reason).toBe('EVENT_NOT_UNDOABLE')
      }
    }
  })

  it('U4: undo on already-undone event returns Conflict EVENT_ALREADY_UNDONE', async () => {
    const appId = await seedAliceApplication('applied')
    const auto = await applyAutoStatusChange(ALICE, ApplicationId(appId), {
      newStatus: 'screening',
      source: 'cron',
      classifierConfidence: 0.9,
      classifiedBy: 'rules',
    })
    if (!auto.isOk()) throw new Error('seed failed')
    const id = auto.value.event!.id

    const first = await undoStatusChange(ALICE, EventId(id))
    expect(first.isOk()).toBe(true)

    const second = await undoStatusChange(ALICE, EventId(id))
    expect(second.isErr()).toBe(true)
    if (second.isErr()) {
      expect(second.error._tag).toBe('Conflict')
      if (second.error._tag === 'Conflict') {
        expect(second.error.reason).toBe('EVENT_ALREADY_UNDONE')
      }
    }
  })

  it('U5: undo on event not in tenant returns NotFound', async () => {
    const result = await undoStatusChange(ALICE, EventId(999_999))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
      if (result.error._tag === 'NotFound') {
        expect(result.error.resource).toBe('Event')
      }
    }
  })
})
