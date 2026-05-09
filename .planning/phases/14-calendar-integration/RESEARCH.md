# Research: Phase 14 - Google Calendar Integration

**Phase**: Full-4  
**Goal**: Sync interview schedules with Google Calendar + create calendar events from Foray  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Interview dates exist in Foray but users must manually add to Google Calendar. Risk of scheduling conflicts.

**Friction points**:
- Double entry (add to Foray + Google Calendar)
- Foray interview date doesn't sync with calendar
- Miss interviews because calendar wasn't updated
- No way to mark attendance (accepted/tentative/declined in calendar)

**Solution**: Google Calendar integration:
- Automatically create calendar event when stage added (interview scheduled)
- Sync updates: Stage date changed → calendar event updated
- Soft-delete: Stage deleted → remove calendar event
- Read calendar invites and auto-create foray stages (if invited to interview)

---

## OAuth Setup

**New OAuth scope** (in addition to Gmail):
- `https://www.googleapis.com/auth/calendar` (full calendar access)

**Flow**:
1. User already authenticated with Gmail (Phase 4, Lean-4)
2. Request additional scope for calendar
3. User grants permission
4. Store additional refresh token (or extend existing)

---

## Event Creation Flow

**When user adds interview stage**:
```
User creates stage "Final Interview, 2026-05-15 10:00 AM"
  ↓
POST /api/applications/:id/stages
  ↓
Create Stage record in DB
  ↓
Create Google Calendar event
  ├─ Title: "Final Interview - {Company} {Role}"
  ├─ Time: 2026-05-15 10:00 AM (user's timezone)
  ├─ Description: "Foray link: https://foray.app/applications/{id}"
  └─ Attendees: Recruiter email (if available, optional)
  ↓
Save calendar event ID to stages.googleCalendarEventId
  ↓
Return stage + calendar event ID to client
```

---

## Sync & Updates

**Bidirectional sync**:

**Foray → Calendar**:
- User changes stage date → Update calendar event time
- User changes stage name → Update calendar event title
- User deletes stage → Delete calendar event

**Calendar → Foray**:
- User declines interview in calendar → Mark stage as "declined" (optional)
- User accepts in calendar → Sync acceptance status (Phase 14 scope: read-only)

**Implementation**: Use Google Calendar Webhook (requires public URL for notifications).

---

## Timezone Handling

**Challenge**: Interview time could be in user's timezone or recruiter's timezone.

**Solution for Phase 14**:
- Store stage time in user's timezone (configured in settings)
- When creating calendar event, explicitly set timezone
- Calendar event shows correct time in user's local calendar

**Example**:
```typescript
const event = {
  summary: 'Final Interview - Acme Inc',
  start: {
    dateTime: '2026-05-15T10:00:00',
    timeZone: 'America/New_York'  // User's timezone from settings
  },
};
```

---

## Calendar Sync on App Open

**At login**, sync calendar events:
1. Fetch user's calendar events from last 90 days
2. For each event with Foray link in description:
   - Check if corresponding stage exists in DB
   - If event changed (title/time), update stage
   - If event deleted, soft-delete stage
3. For events WITHOUT Foray link:
   - Ignore (don't create duplicate stages for non-Foray events)

---

## Recurring Interviews (Out of Scope)

**Not in Phase 14**: Recurring interviews (e.g., daily standups, weekly check-ins).
- Would require storing recurrence rules (RRULE)
- Complex sync logic
- Saved for future phase

---

## Privacy & Permissions

**What we access**:
- Create/read/update/delete events on user's calendar
- Do NOT access other users' calendars
- Do NOT read email body (only from Gmail for classification, separate)

**Scope**: `https://www.googleapis.com/auth/calendar` (not `calendar.readonly`)

---

## Error Handling

**Calendar API failures**:
- Network timeout → Retry with exponential backoff
- Invalid timezone → Fall back to UTC, show warning
- Event creation fails → Log error, notify user, don't block stage creation

**User expects**: "Stage created in Foray, but calendar sync failed. Try again?"

---

*Phase 14 brings interviews into a unified calendar view. No major architecture changes — straightforward API integration.*
