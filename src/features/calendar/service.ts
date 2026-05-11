import 'server-only'

import type { calendar_v3 } from 'googleapis'

import { withRls } from '@/core/db/with-rls'
import { err, errors, ok, type AppError, type Result } from '@/core/errors'
import { logger } from '@/core/logger'
import type { UserId } from '@/core/types/ids'
import type { Prisma } from '@/generated/prisma/client'

import { getCalendarClient } from './client'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const CALENDAR_ID = 'primary'
const DESCRIPTION_EXCERPT_LENGTH = 500
const ACTIVE_STATUSES = ['applied', 'screening', 'interviewing', 'offer'] as const
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
])

export type CalendarSyncSummary = {
  fetched: number
  created: number
  updated: number
  skipped: number
  matched: number
}

export type CalendarSyncOptions = {
  now?: Date
  calendar?: calendar_v3.Calendar
}

type NormalizedCalendarEvent = {
  googleEventId: string
  etag: string
  status: string
  summary: string
  descriptionExcerpt: string | null
  location: string | null
  htmlLink: string | null
  hangoutLink: string | null
  organizerEmail: string | null
  attendeeEmails: string[]
  candidateDomains: string[]
  startAt: Date
  endAt: Date | null
  interviewLike: boolean
}

export async function syncCalendarEvents(
  userId: UserId,
  opts: CalendarSyncOptions = {},
): Promise<Result<CalendarSyncSummary, AppError>> {
  const log = logger.child({ op: 'calendar.sync', userId })
  const calendarResult = opts.calendar ? ok(opts.calendar) : await getCalendarClient(userId)
  if (calendarResult.isErr()) return err(calendarResult.error)

  const now = opts.now ?? new Date()
  const timeMin = new Date(now.getTime() - 7 * MS_PER_DAY)
  const timeMax = new Date(now.getTime() + 30 * MS_PER_DAY)

  let events: calendar_v3.Schema$Event[]
  try {
    events = await listWindowEvents(calendarResult.value, timeMin, timeMax)
  } catch (error) {
    log.error({ err: error }, 'calendar events list failed')
    return err(errors.externalApi('calendar', error))
  }

  const result = await withRls(userId, async (tx) => {
    let created = 0
    let updated = 0
    let skipped = 0
    let matched = 0

    for (const event of events) {
      const normalized = normalizeCalendarEvent(event)
      if (!normalized) {
        skipped++
        continue
      }

      const existing = await tx.calendarEvent.findUnique({
        where: {
          userId_calendarId_googleEventId: {
            userId: Number(userId),
            calendarId: CALENDAR_ID,
            googleEventId: normalized.googleEventId,
          },
        },
        select: { id: true, etag: true },
      })

      if (existing?.etag === normalized.etag) {
        skipped++
        continue
      }

      const match = await matchApplicationByDomain(tx, userId, normalized.candidateDomains)
      if (match) matched++

      const data = {
        userId: Number(userId),
        applicationId: match?.applicationId ?? null,
        calendarId: CALENDAR_ID,
        googleEventId: normalized.googleEventId,
        etag: normalized.etag,
        status: normalized.status,
        summary: normalized.summary,
        descriptionExcerpt: normalized.descriptionExcerpt,
        location: normalized.location,
        htmlLink: normalized.htmlLink,
        hangoutLink: normalized.hangoutLink,
        organizerEmail: normalized.organizerEmail,
        attendeeEmails: normalized.attendeeEmails,
        matchedDomain: match?.domain ?? null,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
      }

      if (!normalized.interviewLike && !match) {
        skipped++
        continue
      }

      await tx.calendarEvent.upsert({
        where: {
          userId_calendarId_googleEventId: {
            userId: Number(userId),
            calendarId: CALENDAR_ID,
            googleEventId: normalized.googleEventId,
          },
        },
        create: data,
        update: data,
      })

      if (existing) updated++
      else created++
    }

    await tx.user.update({
      where: { id: Number(userId) },
      data: { calendarLastSyncAt: now },
    })

    return {
      fetched: events.length,
      created,
      updated,
      skipped,
      matched,
    }
  })

  if (result.isErr()) return err(result.error)
  log.info(result.value, 'calendar sync complete')
  return ok(result.value)
}

async function listWindowEvents(
  calendar: calendar_v3.Calendar,
  timeMin: Date,
  timeMax: Date,
): Promise<calendar_v3.Schema$Event[]> {
  const events: calendar_v3.Schema$Event[] = []
  let pageToken: string | undefined

  do {
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    })
    events.push(...(response.data.items ?? []))
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return events
}

function normalizeCalendarEvent(event: calendar_v3.Schema$Event): NormalizedCalendarEvent | null {
  const googleEventId = event.id
  const etag = event.etag
  const startAt = parseEventDate(event.start)
  if (!googleEventId || !etag || !startAt) return null

  const attendeeEmails = (event.attendees ?? [])
    .map((attendee) => attendee.email?.toLowerCase())
    .filter((email): email is string => !!email)

  const organizerEmail = event.organizer?.email?.toLowerCase() ?? null
  const domains = new Set<string>()
  for (const email of attendeeEmails) addDomain(domains, email)
  if (organizerEmail) addDomain(domains, organizerEmail)

  const summary = event.summary?.trim() || 'Untitled calendar event'
  const description = event.description?.trim() || null
  const text = `${summary} ${description ?? ''} ${event.location ?? ''}`.toLowerCase()

  return {
    googleEventId,
    etag,
    status: event.status ?? 'confirmed',
    summary,
    descriptionExcerpt: description ? description.slice(0, DESCRIPTION_EXCERPT_LENGTH) : null,
    location: event.location ?? null,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
    organizerEmail,
    attendeeEmails,
    candidateDomains: [...domains],
    startAt,
    endAt: parseEventDate(event.end),
    interviewLike: isInterviewLike(text),
  }
}

function parseEventDate(value: calendar_v3.Schema$EventDateTime | undefined): Date | null {
  const raw = value?.dateTime ?? (value?.date ? `${value.date}T00:00:00.000Z` : null)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addDomain(domains: Set<string>, email: string): void {
  const domain = extractDomain(email)
  if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain)) domains.add(domain)
}

function extractDomain(email: string): string | null {
  const match = email.match(/@([a-z0-9.-]+\.[a-z]{2,})$/i)
  return match?.[1]?.toLowerCase() ?? null
}

function isInterviewLike(text: string): boolean {
  return /\b(interview|phone screen|screening|technical|onsite|on-site|coding|pairing|hiring manager|panel|final round|recruiter)\b/i.test(text)
}

async function matchApplicationByDomain(
  tx: Prisma.TransactionClient,
  userId: UserId,
  domains: string[],
): Promise<{ applicationId: number; domain: string } | null> {
  if (domains.length === 0) return null

  const match = await tx.application.findFirst({
    where: {
      userId: Number(userId),
      archivedAt: null,
      canonicalStatus: { in: [...ACTIVE_STATUSES] },
      company: { domain: { in: domains } },
    },
    select: {
      id: true,
      company: { select: { domain: true } },
    },
    orderBy: { lastActivityAt: 'desc' },
  })

  if (!match?.company.domain) return null
  return { applicationId: match.id, domain: match.company.domain }
}
