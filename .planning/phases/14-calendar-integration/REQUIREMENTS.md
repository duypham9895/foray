# Requirements: Phase 14 - Google Calendar Integration

**Phase**: Full-4  
**Derived from**: FULL-ROADMAP.md Phase 4  
**Maps to**: Plans 14-01, 14-02, 14-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| CAL-01 | Request Google Calendar OAuth scope | 14-01 | Auth flow includes `calendar` scope |
| CAL-02 | Create Google Calendar event when stage added | 14-01 | User adds stage → Event appears in Google Calendar |
| CAL-03 | Sync stage changes to calendar (update event time/title) | 14-02 | Change stage date → Calendar event updates |
| CAL-04 | Delete calendar event when stage deleted | 14-02 | Delete stage → Event removed from calendar |
| CAL-05 | Sync calendar to Foray on app open (bidirectional) | 14-02 | Open Foray → stages match calendar events |
| CAL-06 | Timezone handling (user's timezone in settings) | 14-03 | Event shows correct time in user's calendar |
| CAL-07 | Calendar event includes recruiter email (optional) | 14-03 | Calendar invite sent to recruiter if email available |
| CAL-08 | Error handling + retry logic for API failures | 14-03 | Calendar API fails → Retry, notify user |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Event creation latency | <1 second (sync with calendar) |
| Performance | App open sync time | <3 seconds (check calendar for changes) |
| Reliability | Retry on API failure | Exponential backoff (max 3 attempts) |
| Reliability | Never lose data | If calendar sync fails, stage still created in DB |
| Privacy | Only access user's own calendar | No cross-user access |
| Usability | Calendar event title clear | "{Company} {Role} — {Stage Name}" |
| Usability | Recruiter invitation optional | Invite only if recruiter email exists |

---

## Boundary Conditions

- **Event lookback**: Sync last 90 days of calendar events
- **Timezone storage**: User's timezone from settings (e.g., "America/New_York")
- **Recruiter invites**: Only if recruiter email is available + user opted in
- **Retry limit**: Max 3 attempts for failed calendar operations
- **Sync frequency**: On app open + after each stage change

---

## Success Criteria

- [ ] Google Calendar OAuth scope added to auth flow
- [ ] Event creation working (stage → calendar event)
- [ ] Event updates working (stage date/title → calendar sync)
- [ ] Event deletion working (stage delete → calendar delete)
- [ ] Bidirectional sync on app open
- [ ] Timezone correctly applied to events
- [ ] Recruiter emails included in calendar invites (if available)
- [ ] Retry logic + error handling working
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-5 complete**: Stages exist in applications
- **Full-3 optional**: Recruiter entity provides email for calendar invites
- **Google Calendar API**: Requires enabling in Google Cloud project
- **User settings**: Timezone configuration required
- **Google OAuth**: Already set up from Lean phase

---

## Out of Scope (Phase 14)

- Recurring interviews (RRULE support) — saved for future
- Calendar attendee response tracking (tentative/declined) — saved for Full-6
- Multiple calendar integration (only Google Calendar, not Outlook, etc.)
- Calendar event templates — saved for future
- Bulk calendar operations

---

## Integration Points

- **Standard-1**: Extension (Phase 11) can link to calendar
- **Full-3**: Recruiter entity provides email for invites
- **Full-5**: Analytics can track "how many interviews scheduled"
- **Full-6**: Reminders phase can send notifications before interviews

---

## API Endpoints

- `POST /api/oauth/calendar` → Initiate calendar OAuth flow
- `POST /api/applications/:id/stages` → Create stage + calendar event
- `PUT /api/applications/:id/stages/:stageId` → Update stage + sync calendar
- `DELETE /api/applications/:id/stages/:stageId` → Delete stage + remove calendar event
- `POST /api/calendar/sync` → Manual sync calendar to Foray

---

## Database Schema Changes

```prisma
model Stage {
  id Int @id
  // ... existing fields
  
  googleCalendarEventId String?  // Store event ID for sync
  googleCalendarSyncedAt DateTime?
  
  @@index([googleCalendarEventId])
}
```

---

## Testing Strategy

- Unit tests: Event title generation, timezone formatting
- Integration tests: OAuth flow, calendar API calls
- Error tests: Network failure + retry logic
- E2E tests: Create stage → verify calendar event exists
