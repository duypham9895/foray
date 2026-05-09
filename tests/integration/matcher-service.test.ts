// Integration tests for matcher/service.ts — the LOCKED 4-step tiebreak.
//
// Runs against the Testcontainers Postgres seeded by tests/integration/setup.ts:
//   alice = UserId(1), bob = UserId(2)
//   Seeded: one Company + one Application per user
//   process.env.DATABASE_URL → foray_app (FORCE RLS active)
//
// Coverage matrix (CONTEXT §Area 5 + threat model T-03-03-01..02):
//   T1  thread continuity wins over domain match
//   T2  domain match (no thread) returns most-recent application
//   T3  ATS-domain skip short-circuits before domain query (Pitfall #5)
//   T4  unmatched (neither thread nor domain) returns null
//   T5  RLS isolation — alice's matcher cannot see bob's data
//   T6  validation — empty input rejected
//   T7  most-recent application returned for multi-app companies
//   T8  most-recent thread email when multiple linked emails exist
//   T9  ATS subdomain match short-circuits (us.greenhouse.io)
//
// Fixture rules:
//   - beforeEach resets alice's matcher-specific rows; bob's seed row stays
//     untouched so T5 can verify cross-tenant isolation.
//   - Bob's matcher fixtures (T5) seeded inside the test body via withRls(BOB).
//   - resetAliceMatcherState mirrors applications/service.test.ts:resetAliceState
//     in pattern but is scoped to matcher concerns.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { ApplicationId, UserId } from '@/core/types/ids'
import { matchEmail } from '@/features/matcher/service'

const ALICE = UserId(1)
const BOB = UserId(2)

// Preserve seed fixtures so other test files still see them. Wipe matcher-
// specific rows alice tests create.
const SEED_ROLE_TITLE = 'Alice Test Role'
const SEED_COMPANY_NAME = 'Alice Corp'

async function resetAliceMatcherState(): Promise<void> {
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
  await resetAliceMatcherState()
})

afterEach(async () => {
  await resetAliceMatcherState()
})

describe('matchEmail', () => {
  // -------------------------------------------------------------------------
  // T1: thread continuity wins over domain match
  // -------------------------------------------------------------------------
  it('T1: thread continuity wins even when fromDomain ALSO matches a stored Company', async () => {
    // Seed: two Companies, two Applications, one Email linked to app1 on THREAD-A.
    // The fromDomain we pass matches Stripe (app2), but THREAD-A is linked to app1.
    const setup = await withRls(ALICE, async (tx) => {
      const stripe = await tx.company.create({
        data: { userId: Number(ALICE), name: 'Stripe Co', domain: 'stripe.com' },
        select: { id: true },
      })
      const otherCo = await tx.company.create({
        data: { userId: Number(ALICE), name: 'Other Co', domain: 'unrelated.com' },
        select: { id: true },
      })
      const app1 = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: otherCo.id,
          roleTitle: 'T1 thread app',
          appliedAt: new Date('2026-01-01'),
          lastActivityAt: new Date('2026-01-01'),
        },
        select: { id: true },
      })
      const app2 = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: stripe.id,
          roleTitle: 'T1 stripe app',
          appliedAt: new Date('2026-02-01'),
          lastActivityAt: new Date('2026-02-01'),
        },
        select: { id: true },
      })
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          applicationId: app1.id,
          gmailMessageId: 'gm-t1-' + Date.now(),
          gmailThreadId: 'THREAD-A',
          from: 'noreply@unrelated.com',
          fromDomain: 'unrelated.com',
          subject: 'Re: your application',
          bodyExcerpt: 'follow-up',
          receivedAt: new Date('2026-01-15'),
        },
      })
      return { app1, app2 }
    })
    expect(setup.isOk()).toBe(true)
    if (!setup.isOk()) return
    const { app1 } = setup.value

    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'THREAD-A',
      fromDomain: 'stripe.com',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBe(ApplicationId(app1.id))
  })

  // -------------------------------------------------------------------------
  // T2: domain match — no thread
  // -------------------------------------------------------------------------
  it('T2: domain match returns the application when no thread match exists', async () => {
    const setup = await withRls(ALICE, async (tx) => {
      const stripe = await tx.company.create({
        data: { userId: Number(ALICE), name: 'Stripe Co', domain: 'stripe.com' },
        select: { id: true },
      })
      const app = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: stripe.id,
          roleTitle: 'T2 stripe app',
          appliedAt: new Date('2026-02-01'),
          lastActivityAt: new Date('2026-02-01'),
        },
        select: { id: true },
      })
      return { app }
    })
    expect(setup.isOk()).toBe(true)
    if (!setup.isOk()) return
    const { app } = setup.value

    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'NEW-THREAD-NEVER-SEEN',
      fromDomain: 'stripe.com',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBe(ApplicationId(app.id))
  })

  // -------------------------------------------------------------------------
  // T3: ATS-domain skip short-circuits before domain query (Pitfall #5)
  // -------------------------------------------------------------------------
  it('T3: ATS-domain skip short-circuits even if a Company.domain stores an ATS domain', async () => {
    // Defense-in-depth: Phase 2 blocks ATS domains at capture validation, but
    // we deliberately seed one here via raw withRls to verify the matcher
    // refuses to attribute an ATS-shaped email to it.
    const setup = await withRls(ALICE, async (tx) => {
      const ghCo = await tx.company.create({
        data: { userId: Number(ALICE), name: 'Bypassed GH Co', domain: 'greenhouse.io' },
        select: { id: true },
      })
      await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: ghCo.id,
          roleTitle: 'T3 ats-leak app',
          appliedAt: new Date('2026-03-01'),
          lastActivityAt: new Date('2026-03-01'),
        },
      })
      return { ghCo }
    })
    expect(setup.isOk()).toBe(true)

    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'NEW-THREAD-2',
      fromDomain: 'greenhouse.io',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T4: unmatched — neither thread nor domain
  // -------------------------------------------------------------------------
  it('T4: unmatched returns ok({applicationId: null}) — null is a normal outcome, not Err', async () => {
    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'UNKNOWN-THREAD',
      fromDomain: 'no-such-domain.example',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T5: RLS isolation — alice's matcher cannot see bob's data
  // -------------------------------------------------------------------------
  it("T5: RLS isolation — alice's matcher cannot return bob's applicationId via either tiebreak step", async () => {
    // Seed bob with a thread-linked email AND a domain-matched company.
    // Both lookups MUST return null when alice's matcher is invoked.
    const bobSetup = await withRls(BOB, async (tx) => {
      const bobsApp = await tx.application.findFirst({
        where: { userId: Number(BOB), roleTitle: 'Bob Test Role' },
        select: { id: true },
      })
      if (!bobsApp) throw new Error('Bob seed application missing')
      const bobsStripe = await tx.company.create({
        data: { userId: Number(BOB), name: 'Bobs Stripe', domain: 'stripe-bob.com' },
        select: { id: true },
      })
      const bobsDomainApp = await tx.application.create({
        data: {
          userId: Number(BOB),
          companyId: bobsStripe.id,
          roleTitle: 'T5 bobs domain app',
          appliedAt: new Date('2026-02-01'),
          lastActivityAt: new Date('2026-02-01'),
        },
        select: { id: true },
      })
      await tx.email.create({
        data: {
          userId: Number(BOB),
          applicationId: bobsApp.id,
          gmailMessageId: 'gm-t5-bob-' + Date.now(),
          gmailThreadId: 'BOBS-THREAD',
          from: 'recruiter@somewhere.com',
          fromDomain: 'somewhere.com',
          subject: 'Bob ping',
          bodyExcerpt: 'private',
          receivedAt: new Date('2026-02-15'),
        },
      })
      return { bobsAppId: bobsApp.id, bobsDomainAppId: bobsDomainApp.id }
    })
    expect(bobSetup.isOk()).toBe(true)

    // Alice attempts to match bob's thread → must NOT see it.
    const threadAttempt = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'BOBS-THREAD',
      fromDomain: 'unrelated.example',
    })
    expect(threadAttempt.isOk()).toBe(true)
    if (threadAttempt.isOk()) {
      expect(threadAttempt.value.applicationId).toBeNull()
    }

    // Alice attempts to match bob's company domain → must NOT see it.
    const domainAttempt = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'NEW-THREAD-FOR-T5',
      fromDomain: 'stripe-bob.com',
    })
    expect(domainAttempt.isOk()).toBe(true)
    if (domainAttempt.isOk()) {
      expect(domainAttempt.value.applicationId).toBeNull()
    }
  })

  // -------------------------------------------------------------------------
  // T6: validation — empty input rejected
  // -------------------------------------------------------------------------
  it('T6: empty input fields return Validation err', async () => {
    const result = await matchEmail({
      userId: '' as UserId,
      gmailThreadId: '',
      fromDomain: '',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
    }
  })

  // -------------------------------------------------------------------------
  // T7: most-recent application returned for multi-app companies
  // -------------------------------------------------------------------------
  it('T7: domain match returns the MOST-RECENT application when a company has many', async () => {
    const setup = await withRls(ALICE, async (tx) => {
      const stripe = await tx.company.create({
        data: { userId: Number(ALICE), name: 'Stripe Co', domain: 'stripe.com' },
        select: { id: true },
      })
      const oldApp = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: stripe.id,
          roleTitle: 'T7 old app',
          appliedAt: new Date('2025-01-01'),
          lastActivityAt: new Date('2025-01-01'),
        },
        select: { id: true },
      })
      const newApp = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: stripe.id,
          roleTitle: 'T7 new app',
          appliedAt: new Date('2026-01-01'),
          lastActivityAt: new Date('2026-01-01'),
        },
        select: { id: true },
      })
      return { oldApp, newApp }
    })
    expect(setup.isOk()).toBe(true)
    if (!setup.isOk()) return
    const { oldApp, newApp } = setup.value

    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'NEW-T7',
      fromDomain: 'stripe.com',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBe(ApplicationId(newApp.id))
    expect(result.value.applicationId).not.toBe(ApplicationId(oldApp.id))
  })

  // -------------------------------------------------------------------------
  // T8: most-recent thread email when multiple linked emails exist
  // -------------------------------------------------------------------------
  it('T8: thread continuity returns the MOST-RECENT linked email when multiple exist', async () => {
    const setup = await withRls(ALICE, async (tx) => {
      const co = await tx.company.create({
        data: { userId: Number(ALICE), name: 'T8 Co', domain: 'irrelevant.com' },
        select: { id: true },
      })
      const appA = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: co.id,
          roleTitle: 'T8 app A',
          appliedAt: new Date('2025-12-01'),
          lastActivityAt: new Date('2025-12-01'),
        },
        select: { id: true },
      })
      const appB = await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: co.id,
          roleTitle: 'T8 app B',
          appliedAt: new Date('2026-01-01'),
          lastActivityAt: new Date('2026-01-01'),
        },
        select: { id: true },
      })
      // Two emails on the same thread, linked to DIFFERENT apps. The most
      // recent (email2 → appB) must win.
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          applicationId: appA.id,
          gmailMessageId: 'gm-t8-1-' + Date.now(),
          gmailThreadId: 'SHARED-THREAD',
          from: 'a@x.com',
          fromDomain: 'x.com',
          subject: 'first',
          bodyExcerpt: 'first',
          receivedAt: new Date('2026-01-01'),
        },
      })
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          applicationId: appB.id,
          gmailMessageId: 'gm-t8-2-' + Date.now(),
          gmailThreadId: 'SHARED-THREAD',
          from: 'b@x.com',
          fromDomain: 'x.com',
          subject: 'second',
          bodyExcerpt: 'second',
          receivedAt: new Date('2026-02-01'),
        },
      })
      return { appA, appB }
    })
    expect(setup.isOk()).toBe(true)
    if (!setup.isOk()) return
    const { appB } = setup.value

    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'SHARED-THREAD',
      fromDomain: 'irrelevant.com',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBe(ApplicationId(appB.id))
  })

  // -------------------------------------------------------------------------
  // T9: ATS subdomain match short-circuits (us.greenhouse.io)
  // -------------------------------------------------------------------------
  it('T9: ATS subdomain (us.greenhouse.io) is recognized by isAtsDomain → short-circuits', async () => {
    // Seed a Company.domain = 'us.greenhouse.io' bypassing Phase 2 capture.
    // Verifies isAtsDomain() honors subdomain matching per ats-domains.ts.
    const setup = await withRls(ALICE, async (tx) => {
      const co = await tx.company.create({
        data: {
          userId: Number(ALICE),
          name: 'GH Subdomain Co',
          domain: 'us.greenhouse.io',
        },
        select: { id: true },
      })
      await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: co.id,
          roleTitle: 'T9 gh subdomain app',
          appliedAt: new Date('2026-03-01'),
          lastActivityAt: new Date('2026-03-01'),
        },
      })
    })
    expect(setup.isOk()).toBe(true)

    const result = await matchEmail({
      userId: ALICE,
      gmailThreadId: 'NEW-T9',
      fromDomain: 'us.greenhouse.io',
    })
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.applicationId).toBeNull()
  })
})
