import { beforeEach, describe, expect, it } from 'vitest'

import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'
import { getAnalyticsDashboard } from '@/features/analytics/queries'

const ALICE = UserId(1)

beforeEach(async () => {
  await withRls(ALICE, async (tx) => {
    const apps = await tx.application.findMany({
      where: {
        userId: Number(ALICE),
        roleTitle: { startsWith: 'Analytics Test' },
      },
      select: { id: true },
    })
    const appIds = apps.map((app) => app.id)

    if (appIds.length > 0) {
      await tx.email.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.event.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.stage.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.applicationRecruiter.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.document.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.application.deleteMany({ where: { id: { in: appIds } } })
    }

    await tx.company.deleteMany({
      where: { userId: Number(ALICE), name: { startsWith: 'Analytics Test' } },
    })
  })
})

async function seedAnalyticsFixture() {
  const result = await withRls(ALICE, async (tx) => {
    const now = new Date()
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86400_000)

    const company = await tx.company.create({
      data: {
        userId: Number(ALICE),
        name: 'Analytics Test Co',
        domain: 'analytics-test.example',
      },
      select: { id: true },
    })

    const applied = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Analytics Test Applied',
        source: 'linkedin',
        canonicalStatus: 'applied',
        appliedAt: daysAgo(10),
        createdAt: daysAgo(10),
        lastActivityAt: daysAgo(8),
      },
      select: { id: true },
    })
    const screening = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Analytics Test Screening',
        source: 'referral',
        canonicalStatus: 'screening',
        appliedAt: daysAgo(6),
        createdAt: daysAgo(6),
        lastActivityAt: daysAgo(2),
      },
      select: { id: true },
    })
    const offer = await tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Analytics Test Offer',
        source: 'referral',
        canonicalStatus: 'offer',
        appliedAt: daysAgo(4),
        createdAt: daysAgo(4),
        lastActivityAt: daysAgo(1),
      },
      select: { id: true },
    })

    await tx.email.create({
      data: {
        userId: Number(ALICE),
        applicationId: screening.id,
        gmailMessageId: `analytics-screening-${Date.now()}`,
        gmailThreadId: 'analytics-screening-thread',
        from: 'recruiter@analytics-test.example',
        fromDomain: 'analytics-test.example',
        subject: 'Analytics screening',
        bodyExcerpt: 'Screening invite',
        processingStatus: 'acted',
        receivedAt: daysAgo(3),
      },
    })
    await tx.email.create({
      data: {
        userId: Number(ALICE),
        applicationId: offer.id,
        gmailMessageId: `analytics-offer-${Date.now()}`,
        gmailThreadId: 'analytics-offer-thread',
        from: 'hiring@analytics-test.example',
        fromDomain: 'analytics-test.example',
        subject: 'Analytics offer',
        bodyExcerpt: 'Offer update',
        processingStatus: 'acted',
        receivedAt: daysAgo(1),
      },
    })

    return { appliedId: applied.id, screeningId: screening.id, offerId: offer.id }
  })
  if (result.isErr()) throw result.error
  return result.value
}

describe('analytics dashboard queries', () => {
  it('returns funnel, response, weekly, source, and stale metrics from SQL-backed aggregations', async () => {
    await seedAnalyticsFixture()

    const result = await getAnalyticsDashboard(ALICE)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw result.error

    const data = result.value
    const funnel = new Map(data.funnel.map((row) => [row.status, row.count]))
    const referral = data.sourceEffectiveness.find((row) => row.source === 'referral')

    expect(funnel.get('applied')).toBeGreaterThanOrEqual(1)
    expect(funnel.get('screening')).toBeGreaterThanOrEqual(1)
    expect(funnel.get('offer')).toBeGreaterThanOrEqual(1)
    expect(data.response.totalApplications).toBeGreaterThanOrEqual(3)
    expect(data.response.respondedApplications).toBeGreaterThanOrEqual(2)
    expect(data.response.responseRate).toBeGreaterThan(0)
    expect(data.response.medianDaysToResponse).not.toBeNull()
    expect(data.weeklyActivity).toHaveLength(8)
    expect(data.weeklyActivity.some((row) => row.count > 0)).toBe(true)
    expect(referral?.total).toBeGreaterThanOrEqual(2)
    expect(referral?.responded).toBeGreaterThanOrEqual(2)
    expect(referral?.converted).toBeGreaterThanOrEqual(2)
    expect(data.staleCount).toBeGreaterThanOrEqual(1)
  })
})
