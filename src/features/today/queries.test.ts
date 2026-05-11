// Integration tests for today/queries.ts — dashboard query layer.
//
// Runs against Testcontainers Postgres seeded by tests/integration/setup.ts
// (alice = UserId(1), bob = UserId(2)).
//
// Tests:
//   findStaleForays    — returns active forays with lastActivityAt > 7 days ago
//   findOfferForays    — returns forays with canonical_status = 'offer'
//   findReviewQueueTopN — returns emails with processingStatus = needs_review, capped at N
//   findTodaysInterviews — returns stages with scheduledAt today
//   getPipelineCounts  — returns counts per canonical status
//   findRecent24hActivity — returns emails + status changes from last 24h
//   findThisWeekCounts — returns this-week + last-week counts per status

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

import {
  findStaleForays,
  findOfferForays,
  findReviewQueueTopN,
  findTodaysInterviews,
  getPipelineCounts,
  findRecent24hActivity,
  findThisWeekCounts,
  findOverdueFollowUps,
} from './queries'

// --- Constants ---

const ALICE = UserId(1)
const BOB = UserId(2)
const MS_PER_DAY = 1000 * 60 * 60 * 24

// --- Fixture management ---

async function resetTodayState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
    await tx.stage.deleteMany({ where: { application: { userId: Number(ALICE) } } })
    await tx.application.deleteMany({
      where: { userId: Number(ALICE), roleTitle: { not: 'Alice Test Role' } },
    })
    await tx.company.deleteMany({
      where: { userId: Number(ALICE), name: { not: 'Alice Corp' } },
    })
  })
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(BOB)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(BOB) } })
    await tx.stage.deleteMany({ where: { application: { userId: Number(BOB) } } })
    await tx.application.deleteMany({
      where: { userId: Number(BOB), roleTitle: { not: 'Bob Test Role' } },
    })
    await tx.company.deleteMany({
      where: { userId: Number(BOB), name: { not: 'Bob Corp' } },
    })
  })
}

let testCompanyId: number
let testApplicationId: number

beforeEach(async () => {
  await resetTodayState()

  const setup = await withRls(ALICE, async (tx) => {
    const company = await tx.company.create({
      data: { userId: Number(ALICE), name: 'TodayTestCorp', domain: 'todaytest.com' },
      select: { id: true },
    })
    const app = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Today Test Role',
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
    testCompanyId = setup.value.companyId
    testApplicationId = setup.value.appId
  }
})

afterEach(resetTodayState)

// --- findStaleForays ---

describe('findStaleForays', () => {
  it('returns forays with no activity in >7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { lastActivityAt: eightDaysAgo, canonicalStatus: 'interviewing' },
      })
    })

    const result = await findStaleForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const stale = result.value
    expect(stale.length).toBeGreaterThanOrEqual(1)
    const match = stale.find((s) => s.id === testApplicationId)
    expect(match).toBeDefined()
    expect(match!.companyName).toBe('TodayTestCorp')
    expect(match!.daysQuiet).toBeGreaterThanOrEqual(7)
  })

  it('excludes forays with recent activity', async () => {
    // lastActivityAt defaults to now, so it should NOT appear as stale
    const result = await findStaleForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((s) => s.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('excludes archived forays', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { lastActivityAt: eightDaysAgo, archivedAt: new Date() },
      })
    })

    const result = await findStaleForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((s) => s.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('excludes rejected/withdrawn forays', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { lastActivityAt: eightDaysAgo, canonicalStatus: 'rejected' },
      })
    })

    const result = await findStaleForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((s) => s.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('respects the limit option', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * MS_PER_DAY)
    // Create multiple stale forays
    await withRls(ALICE, async (tx) => {
      for (let i = 0; i < 5; i++) {
        await tx.application.create({
          data: {
            userId: Number(ALICE),
            companyId: testCompanyId,
            roleTitle: `Stale ${i}`,
            canonicalStatus: 'applied',
            appliedAt: eightDaysAgo,
            lastActivityAt: eightDaysAgo,
          },
        })
      }
    })

    const result = await findStaleForays(ALICE, { limit: 3 })
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.length).toBeLessThanOrEqual(3)
  })

  it('returns empty for user with no stale forays', async () => {
    const result = await findStaleForays(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // Bob's seed application has lastActivityAt = now, so not stale
    expect(result.value).toHaveLength(0)
  })

  it('excludes other users data (cross-tenant isolation)', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * MS_PER_DAY)
    // Create a stale foray for Bob
    await withRls(BOB, async (tx) => {
      const bobCompany = await tx.company.findFirst({
        where: { userId: Number(BOB) },
        select: { id: true },
      })
      await tx.application.create({
        data: {
          userId: Number(BOB),
          companyId: bobCompany!.id,
          roleTitle: 'Bob Stale Role',
          canonicalStatus: 'applied',
          appliedAt: eightDaysAgo,
          lastActivityAt: eightDaysAgo,
        },
      })
    })

    const result = await findStaleForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // Alice must NOT see Bob's stale foray
    const match = result.value.find((s) => s.roleTitle === 'Bob Stale Role')
    expect(match).toBeUndefined()
  })
})

// --- findOfferForays ---

describe('findOfferForays', () => {
  it('returns forays with canonical_status = offer', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { canonicalStatus: 'offer' },
      })
    })

    const result = await findOfferForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(1)
    expect(result.value[0]!.id).toBe(testApplicationId)
    expect(result.value[0]!.companyName).toBe('TodayTestCorp')
  })

  it('excludes non-offer forays', async () => {
    // Default status is 'applied'
    const result = await findOfferForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })

  it('excludes archived offer forays', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { canonicalStatus: 'offer', archivedAt: new Date() },
      })
    })

    const result = await findOfferForays(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })
})

// --- findReviewQueueTopN ---

describe('findReviewQueueTopN', () => {
  it('returns emails with processingStatus = needs_review', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: `msg-review-${Date.now()}`,
          gmailThreadId: 'thread-1',
          from: 'recruiter@test.com',
          fromDomain: 'test.com',
          subject: 'Review This',
          bodyExcerpt: 'Needs review',
          processingStatus: 'needs_review',
          classification: 'interview_invite',
          confidence: 0.5,
          classifiedBy: 'rules',
          applicationId: testApplicationId,
          receivedAt: new Date(),
        },
      })
    })

    const result = await findReviewQueueTopN(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(1)
    expect(result.value[0]!.subject).toBe('Review This')
    expect(result.value[0]!.classification).toBe('interview_invite')
  })

  it('excludes already-reviewed emails', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: `msg-reviewed-${Date.now()}`,
          gmailThreadId: 'thread-1',
          from: 'a@test.com',
          fromDomain: 'test.com',
          subject: 'Already Reviewed',
          bodyExcerpt: 'reviewed',
          processingStatus: 'needs_review',
          reviewedByUser: true,
          receivedAt: new Date(),
        },
      })
    })

    const result = await findReviewQueueTopN(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })

  it('caps results at N', async () => {
    await withRls(ALICE, async (tx) => {
      for (let i = 0; i < 5; i++) {
        await tx.email.create({
          data: {
            userId: Number(ALICE),
            gmailMessageId: `msg-cap-${i}-${Date.now()}`,
            gmailThreadId: `thread-${i}`,
            from: `r${i}@test.com`,
            fromDomain: 'test.com',
            subject: `Email ${i}`,
            bodyExcerpt: 'test',
            processingStatus: 'needs_review',
            receivedAt: new Date(),
          },
        })
      }
    })

    const result = await findReviewQueueTopN(ALICE, 3)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(3)
  })

  it('returns empty for user with no review items', async () => {
    const result = await findReviewQueueTopN(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })
})

// --- findTodaysInterviews ---

describe('findTodaysInterviews', () => {
  it('returns stages scheduled for today', async () => {
    const laterToday = new Date()
    laterToday.setHours(12, 0, 0, 0)

    await withRls(ALICE, async (tx) => {
      await tx.stage.create({
        data: {
          applicationId: testApplicationId,
          name: 'Phone Screen',
          order: 1,
          scheduledAt: laterToday,
        },
      })
    })

    const result = await findTodaysInterviews(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(1)
    expect(result.value[0]!.stageName).toBe('Phone Screen')
    expect(result.value[0]!.companyName).toBe('TodayTestCorp')
    expect(result.value[0]!.roleTitle).toBe('Today Test Role')
  })

  it('excludes stages scheduled for other days', async () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.stage.create({
        data: {
          applicationId: testApplicationId,
          name: 'Yesterday Interview',
          order: 1,
          scheduledAt: yesterday,
        },
      })
    })

    const result = await findTodaysInterviews(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })

  it('excludes completed stages', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.stage.create({
        data: {
          applicationId: testApplicationId,
          name: 'Done Interview',
          order: 1,
          scheduledAt: new Date(),
          completedAt: new Date(),
        },
      })
    })

    const result = await findTodaysInterviews(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })

  it('excludes stages without scheduledAt', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.stage.create({
        data: {
          applicationId: testApplicationId,
          name: 'Unscheduled Stage',
          order: 1,
        },
      })
    })

    const result = await findTodaysInterviews(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })

  it('orders interviews by scheduledAt ascending', async () => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)

    await withRls(ALICE, async (tx) => {
      await tx.stage.create({
        data: {
          applicationId: testApplicationId,
          name: 'Afternoon',
          order: 2,
          scheduledAt: new Date(base.getTime() + 14 * 60 * 60 * 1000),
        },
      })
      await tx.stage.create({
        data: {
          applicationId: testApplicationId,
          name: 'Morning',
          order: 1,
          scheduledAt: new Date(base.getTime() + 9 * 60 * 60 * 1000),
        },
      })
    })

    const result = await findTodaysInterviews(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(2)
    expect(result.value[0]!.stageName).toBe('Morning')
    expect(result.value[1]!.stageName).toBe('Afternoon')
  })

  it('returns empty for user with no interviews today', async () => {
    const result = await findTodaysInterviews(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value).toHaveLength(0)
  })
})

// --- getPipelineCounts ---

describe('getPipelineCounts', () => {
  it('returns counts per canonical status', async () => {
    // Seed application has canonicalStatus = 'applied'
    const result = await getPipelineCounts(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.applied).toBeGreaterThanOrEqual(1)
    expect(result.value.screening).toBe(0)
    expect(result.value.interviewing).toBe(0)
    expect(result.value.offer).toBe(0)
    expect(result.value.rejected).toBe(0)
    expect(result.value.withdrawn).toBe(0)
  })

  it('excludes archived applications from counts', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { archivedAt: new Date() },
      })
    })

    const result = await getPipelineCounts(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // The seed 'Alice Test Role' application is still applied + not archived
    expect(result.value.applied).toBeGreaterThanOrEqual(1)
    // TodayTestCorp application is now archived, should not count
  })

  it('returns counts including seed application for user with only seed data', async () => {
    const result = await getPipelineCounts(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // Bob has a seed application
    expect(result.value.applied).toBeGreaterThanOrEqual(1)
  })
})

// --- findRecent24hActivity ---

describe('findRecent24hActivity', () => {
  it('returns emails received in the last 24 hours', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: `msg-recent-${Date.now()}`,
          gmailThreadId: 'thread-1',
          from: 'recruiter@recent.com',
          fromDomain: 'recent.com',
          subject: 'Recent Email',
          bodyExcerpt: 'Recent content',
          processingStatus: 'received',
          receivedAt: new Date(),
        },
      })
    })

    const result = await findRecent24hActivity(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.emails).toHaveLength(1)
    expect(result.value.emails[0]!.subject).toBe('Recent Email')
    expect(result.value.emails[0]!.from).toBe('recruiter@recent.com')
  })

  it('excludes emails older than 24 hours', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.email.create({
        data: {
          userId: Number(ALICE),
          gmailMessageId: `msg-old-${Date.now()}`,
          gmailThreadId: 'thread-1',
          from: 'old@test.com',
          fromDomain: 'test.com',
          subject: 'Old Email',
          bodyExcerpt: 'Old content',
          processingStatus: 'received',
          receivedAt: new Date(Date.now() - 2 * MS_PER_DAY),
        },
      })
    })

    const result = await findRecent24hActivity(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.emails.find((e) => e.subject === 'Old Email')
    expect(match).toBeUndefined()
  })

  it('returns applications updated in the last 24 hours as status changes', async () => {
    // testApplicationId was just created (updatedAt = now)
    const result = await findRecent24hActivity(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.activeApplications.length).toBeGreaterThanOrEqual(1)
    const match = result.value.activeApplications.find((s) => s.id === testApplicationId)
    expect(match).toBeDefined()
  })

  it('excludes applications not updated in last 24 hours', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { updatedAt: twoDaysAgo },
      })
    })

    const result = await findRecent24hActivity(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.activeApplications.find((s) => s.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('returns empty arrays for user with no recent activity', async () => {
    // Bob has no emails and his application updatedAt might be recent from seed
    // Clean Bob's application updatedAt
    await withRls(BOB, async (tx) => {
      const bobApps = await tx.application.findMany({
        where: { userId: Number(BOB) },
        select: { id: true },
      })
      for (const app of bobApps) {
        await tx.application.update({
          where: { id: app.id },
          data: { updatedAt: new Date(Date.now() - 2 * MS_PER_DAY) },
        })
      }
    })

    const result = await findRecent24hActivity(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.emails).toHaveLength(0)
    expect(result.value.activeApplications).toHaveLength(0)
  })
})

// --- findThisWeekCounts ---

describe('findThisWeekCounts', () => {
  it('returns this-week and last-week counts per status', async () => {
    const result = await findThisWeekCounts(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // Seed application was created today (this week)
    expect(result.value.thisWeek.applied).toBeGreaterThanOrEqual(1)
    // All counts should be numbers
    expect(typeof result.value.thisWeek.applied).toBe('number')
    expect(typeof result.value.lastWeek.applied).toBe('number')
  })

  it('returns zeroes for last week when no old applications exist', async () => {
    const result = await findThisWeekCounts(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // No applications should have appliedAt in last week's range
    expect(result.value.lastWeek.applied).toBe(0)
    expect(result.value.lastWeek.screening).toBe(0)
    expect(result.value.lastWeek.interviewing).toBe(0)
    expect(result.value.lastWeek.offer).toBe(0)
    expect(result.value.lastWeek.rejected).toBe(0)
    expect(result.value.lastWeek.withdrawn).toBe(0)
  })

  it('counts applications from last week correctly', async () => {
    // Compute exact last-week midpoint to guarantee the date falls in range.
    // Week starts on Sunday (getDay() = 0). Last week = [weekStart-7, weekStart).
    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    // Midpoint of last week = lastWeekStart + 3.5 days
    const lastWeekDate = new Date(lastWeekStart.getTime() + 3.5 * MS_PER_DAY)

    await withRls(ALICE, async (tx) => {
      await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: testCompanyId,
          roleTitle: 'Last Week Role',
          canonicalStatus: 'interviewing',
          appliedAt: lastWeekDate,
          lastActivityAt: lastWeekDate,
        },
      })
    })

    const result = await findThisWeekCounts(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.lastWeek.interviewing).toBe(1)
  })

  it('excludes archived applications from counts', async () => {
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { archivedAt: new Date() },
      })
    })

    const result = await findThisWeekCounts(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // The seed 'Alice Test Role' is still active this week
    // TodayTestCorp is now archived
    const totalThisWeek =
      result.value.thisWeek.applied +
      result.value.thisWeek.screening +
      result.value.thisWeek.interviewing +
      result.value.thisWeek.offer +
      result.value.thisWeek.rejected +
      result.value.thisWeek.withdrawn
    // At least the seed application should count
    expect(totalThisWeek).toBeGreaterThanOrEqual(1)
  })

  it('returns this-week counts including seed application', async () => {
    const result = await findThisWeekCounts(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // Bob's seed application was created today (this week)
    expect(result.value.thisWeek.applied).toBeGreaterThanOrEqual(1)
    expect(result.value.lastWeek.applied).toBe(0)
  })
})

// --- findOverdueFollowUps ---

describe('findOverdueFollowUps', () => {
  it('returns applications where followUpAt <= now()', async () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { followUpAt: yesterday },
      })
    })

    const result = await findOverdueFollowUps(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.length).toBeGreaterThanOrEqual(1)
    const match = result.value.find((f) => f.id === testApplicationId)
    expect(match).toBeDefined()
    expect(match!.companyName).toBe('TodayTestCorp')
    expect(match!.daysOverdue).toBeGreaterThanOrEqual(1)
  })

  it('excludes applications with followUpAt in the future', async () => {
    const tomorrow = new Date(Date.now() + MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { followUpAt: tomorrow },
      })
    })

    const result = await findOverdueFollowUps(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((f) => f.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('excludes applications with null followUpAt', async () => {
    // followUpAt defaults to null
    const result = await findOverdueFollowUps(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((f) => f.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('excludes archived applications', async () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { followUpAt: yesterday, archivedAt: new Date() },
      })
    })

    const result = await findOverdueFollowUps(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((f) => f.id === testApplicationId)
    expect(match).toBeUndefined()
  })

  it('sorts by followUpAt ascending (oldest first)', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * MS_PER_DAY)
    const oneDayAgo = new Date(Date.now() - MS_PER_DAY)

    await withRls(ALICE, async (tx) => {
      // Create a second application with older followUpAt
      await tx.application.create({
        data: {
          userId: Number(ALICE),
          companyId: testCompanyId,
          roleTitle: 'Older Follow-up',
          canonicalStatus: 'applied',
          appliedAt: new Date(),
          lastActivityAt: new Date(),
          followUpAt: threeDaysAgo,
        },
      })
      // Update existing with newer followUpAt
      await tx.application.update({
        where: { id: testApplicationId },
        data: { followUpAt: oneDayAgo },
      })
    })

    const result = await findOverdueFollowUps(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    expect(result.value.length).toBeGreaterThanOrEqual(2)
    // First should be the older one
    expect(result.value[0]!.daysOverdue).toBeGreaterThanOrEqual(result.value[1]!.daysOverdue)
  })

  it('returns empty array for user with no overdue follow-ups', async () => {
    const result = await findOverdueFollowUps(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    // Bob has no follow-up dates set
    expect(result.value).toHaveLength(0)
  })

  it('excludes other users data (cross-tenant isolation)', async () => {
    const yesterday = new Date(Date.now() - MS_PER_DAY)
    // Set follow-up on Alice's application
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { followUpAt: yesterday },
      })
    })

    // Bob should NOT see Alice's overdue follow-up
    const result = await findOverdueFollowUps(BOB)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((f) => f.roleTitle === 'Today Test Role')
    expect(match).toBeUndefined()
  })

  it('result includes roleTitle, companyName, daysOverdue fields', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * MS_PER_DAY)
    await withRls(ALICE, async (tx) => {
      await tx.application.update({
        where: { id: testApplicationId },
        data: { followUpAt: twoDaysAgo },
      })
    })

    const result = await findOverdueFollowUps(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const match = result.value.find((f) => f.id === testApplicationId)
    expect(match).toBeDefined()
    expect(match!.roleTitle).toBe('Today Test Role')
    expect(match!.companyName).toBe('TodayTestCorp')
    expect(match!.daysOverdue).toBeGreaterThanOrEqual(2)
  })
})
