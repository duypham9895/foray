import type { calendar_v3 } from 'googleapis'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'
import { syncCalendarEvents } from '@/features/calendar/service'
import { findUpcomingCalendarInterviews } from '@/features/today/queries'

const ALICE = UserId(1)

beforeEach(async () => {
  await withRls(ALICE, async (tx) => {
    const apps = await tx.application.findMany({
      where: {
        userId: Number(ALICE),
        roleTitle: { startsWith: 'Calendar Test' },
      },
      select: { id: true },
    })
    const appIds = apps.map((app) => app.id)

    await tx.calendarEvent.deleteMany({
      where: {
        userId: Number(ALICE),
        OR: [
          { summary: { startsWith: 'Calendar Test' } },
          ...(appIds.length > 0 ? [{ applicationId: { in: appIds } }] : []),
        ],
      },
    })

    if (appIds.length > 0) {
      await tx.email.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.event.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.stage.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.applicationRecruiter.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.document.deleteMany({ where: { applicationId: { in: appIds } } })
      await tx.application.deleteMany({ where: { id: { in: appIds } } })
    }

    await tx.company.deleteMany({
      where: { userId: Number(ALICE), name: { startsWith: 'Calendar Test' } },
    })
  })
})

function fakeCalendar(events: calendar_v3.Schema$Event[]): calendar_v3.Calendar {
  return {
    events: {
      list: vi.fn(async () => ({
        data: {
          items: events,
        },
      })),
    },
  } as unknown as calendar_v3.Calendar
}

async function seedApplication() {
  const result = await withRls(ALICE, async (tx) => {
    const company = await tx.company.create({
      data: {
        userId: Number(ALICE),
        name: 'Calendar Test Co',
        domain: 'calendar-test.example',
      },
      select: { id: true },
    })

    return tx.application.create({
      data: {
        userId: Number(ALICE),
        companyId: company.id,
        roleTitle: 'Calendar Test Staff Engineer',
        source: 'recruiter',
        canonicalStatus: 'interviewing',
      },
      select: { id: true },
    })
  })
  if (result.isErr()) throw result.error
  return result.value
}

describe('calendar integration', () => {
  it('syncs interview events, matches by attendee domain, and skips unchanged etags', async () => {
    const app = await seedApplication()
    const now = new Date()
    const start = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 45 * 60 * 1000)
    const calendar = fakeCalendar([
      {
        id: 'calendar-test-event-1',
        etag: '"etag-1"',
        status: 'confirmed',
        summary: 'Calendar Test Technical Interview',
        description: 'Pairing round with the platform team.',
        location: 'Google Meet',
        htmlLink: 'https://calendar.google.com/event?eid=test',
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
        organizer: { email: 'recruiter@calendar-test.example' },
        attendees: [
          { email: 'alice@gmail.com' },
          { email: 'interviewer@calendar-test.example' },
        ],
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    ])

    const first = await syncCalendarEvents(ALICE, { now, calendar })
    expect(first.isOk()).toBe(true)
    if (first.isErr()) throw first.error
    expect(first.value).toMatchObject({
      fetched: 1,
      created: 1,
      updated: 0,
      matched: 1,
    })

    const stored = await withRls(ALICE, async (tx) =>
      tx.calendarEvent.findFirst({
        where: { googleEventId: 'calendar-test-event-1' },
        select: {
          applicationId: true,
          matchedDomain: true,
          summary: true,
          attendeeEmails: true,
        },
      }),
    )
    expect(stored.isOk()).toBe(true)
    if (stored.isErr()) throw stored.error
    expect(stored.value).toEqual({
      applicationId: app.id,
      matchedDomain: 'calendar-test.example',
      summary: 'Calendar Test Technical Interview',
      attendeeEmails: ['alice@gmail.com', 'interviewer@calendar-test.example'],
    })

    const upcoming = await findUpcomingCalendarInterviews(ALICE)
    expect(upcoming.isOk()).toBe(true)
    if (upcoming.isErr()) throw upcoming.error
    expect(upcoming.value.some((event) =>
      event.applicationId === app.id &&
      event.summary === 'Calendar Test Technical Interview' &&
      event.hangoutLink === 'https://meet.google.com/abc-defg-hij',
    )).toBe(true)

    const second = await syncCalendarEvents(ALICE, { now, calendar })
    expect(second.isOk()).toBe(true)
    if (second.isErr()) throw second.error
    expect(second.value).toMatchObject({
      fetched: 1,
      created: 0,
      updated: 0,
      skipped: 1,
    })
  })
})
