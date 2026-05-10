# Requirements: foray

**Defined:** 2026-05-10
**Core Value:** One screen tells the owner what's actually happening today — what's stale, what got rejected silently, what needs a follow-up — without manual spreadsheet maintenance.

## v0.3 Requirements

Requirements for v0.3 Full milestone. Each maps to roadmap phases.

### Reminders + Cron Infrastructure

- [ ] **REMIND-01**: Owner can set a follow-up date on any application via `followUpAt` field
- [ ] **REMIND-02**: Today dashboard shows "Follow-ups due" section listing applications where `followUpAt <= now()`
- [ ] **REMIND-03**: Count badge on Today nav link shows number of overdue follow-ups
- [ ] **REMIND-04**: Cron infrastructure upgraded to `CronRegistry` pattern supporting multiple scheduled jobs without hot-reload double-fire
- [ ] **REMIND-05**: Reminder check cron runs every 15 minutes and surfaces due follow-ups in Today view

### Document Storage

- [ ] **DOC-01**: Owner can upload a document (resume, cover letter, JD PDF, take-home, other) to an application via multipart form
- [ ] **DOC-02**: Uploaded files stored on local filesystem under `data/documents/{userId}/{applicationId}/{docId}/` with server-generated filenames (path traversal protection)
- [ ] **DOC-03**: Owner can download any attached document via streaming route handler with correct Content-Type and Content-Disposition headers
- [ ] **DOC-04**: Owner can delete a document; file removed from disk and DB row removed in one transaction
- [ ] **DOC-05**: Document list shown in application detail view with kind, filename, size, and upload date
- [ ] **DOC-06**: File upload validates MIME type via magic bytes (not just extension), max 10MB per file
- [ ] **DOC-07**: `Event(type='document_uploaded')` created on each upload; appears in application timeline

### Chrome MV3 Extension

- [ ] **EXT-01**: Chrome extension built with WXT; `extension/` directory with manifest.json, popup, content script
- [ ] **EXT-02**: Extension popup captures current tab's title and URL via `chrome.tabs` API
- [ ] **EXT-03**: Extension sends POST to `/api/capture` with Bearer token auth (resolves existing TODO in capture route)
- [ ] **EXT-04**: `EXTENSION_API_TOKEN` env var or DB-stored token for extension authentication
- [ ] **EXT-05**: Extension popup shows capture success status and "Open in Foray" link to prefilled application form
- [ ] **EXT-06**: Extension handles SPA navigation (LinkedIn, etc.) via `webNavigation.onHistoryStateUpdated` for content script re-injection
- [ ] **EXT-07**: All extension state stored in `chrome.storage.local` (never module variables — MV3 service worker dies after 30s)
- [ ] **EXT-08**: Extension icons and popup UI consistent with foray design system
- [ ] **EXT-09**: Build pipeline produces loadable extension directory (WXT dev mode + production build)

### Recruiter Entity

- [ ] **RCRT-01**: Owner can create a recruiter record with name, email, LinkedIn URL, phone, and notes
- [ ] **RCRT-02**: Owner can view a list of all recruiters at `/recruiters`
- [ ] **RCRT-03**: Owner can view and edit recruiter detail at `/recruiters/[id]`
- [ ] **RCRT-04**: Owner can link a recruiter to an application with a role (Recruiter, Hiring Manager, Founder, etc.)
- [ ] **RCRT-05**: Owner can unlink a recruiter from an application
- [ ] **RCRT-06**: Application detail view shows linked recruiters with role and contact info
- [ ] **RCRT-07**: Recruiter deduplication: auto-suggest existing recruiters by email match when linking
- [ ] **RCRT-08**: `Event(type='recruiter_linked')` created when recruiter linked to application; appears in timeline

### Analytics Dashboard

- [ ] **ANAL-01**: `/analytics` page shows funnel visualization: count of forays at each canonical status (applied → screening → interviewing → offer)
- [ ] **ANAL-02**: Response rate metric: (screening + interviewing + offer) / total applied, displayed as percentage
- [ ] **ANAL-03**: Time-to-response metric: median days from `appliedAt` to first status change
- [ ] **ANAL-04**: Weekly activity chart: applications created per week as bar chart using Recharts
- [ ] **ANAL-05**: Source effectiveness: breakdown by `ApplicationSource` with conversion rates per source
- [ ] **ANAL-06**: Stale forays count: forays with no activity in 7+ days, linked to filtered list
- [ ] **ANAL-07**: All aggregation queries use SQL (Prisma `groupBy`/`aggregate` or `$queryRaw` for medians); no in-memory processing
- [ ] **ANAL-08**: Analytics link added to main navigation sidebar

### Google Calendar Integration

- [ ] **CAL-01**: Owner can connect Google Calendar via OAuth flow with `calendar.events.readonly` scope
- [ ] **CAL-02**: Separate `calendarRefreshTokenEncrypted` column on User (does NOT invalidate existing Gmail token)
- [ ] **CAL-03**: Settings page shows Calendar connection state with Connect/Disconnect actions
- [ ] **CAL-04**: Calendar sync cron fetches events from Google Calendar API (timeMin: now - 7d, timeMax: now + 30d)
- [ ] **CAL-05**: New `CalendarEvent` model with `googleEventId`, `summary`, `startTime`, `endTime`, `location`, `applicationId?`, `stageId?`
- [ ] **CAL-06**: Calendar events matched to applications via attendee email domain (similar to existing matcher logic)
- [ ] **CAL-07**: Sync is one-way (Google → foray); etag stored on CalendarEvent for idempotent upserts
- [ ] **CAL-08**: Today dashboard shows upcoming calendar events in next 7 days
- [ ] **CAL-09**: Calendar event cards link to associated application when matched

## v0.4 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-User / SaaS

- **SAAS-01**: Multi-tenant deployment with per-org isolation
- **SAAS-02**: User registration and team management

### Advanced Features

- **ADV-01**: Browser Notification API integration for reminders (opt-in)
- **ADV-02**: Two-way calendar sync (foray → Google Calendar)
- **ADV-03**: Document preview rendering in browser (PDF iframe, DOCX viewer)
- **ADV-04**: Chrome Web Store publishing pipeline
- **ADV-05**: Site-specific DOM extractors for ATS platforms (Greenhouse, Lever, Workday, Ashby)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user / SaaS deployment | Multi-tenant patterns baked in but only single-user shipped |
| Browser push notifications for reminders | In-app badges sufficient; browser notifications require user permission UX |
| Two-way calendar sync | One-way avoids sync loop pitfalls; two-way adds massive complexity |
| Document versioning | MVP overwrites file on re-upload; full version history deferred |
| Virus scanning for uploads | Local-first single-user; skip for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REMIND-01 | 11 | Pending |
| REMIND-02 | 11 | Pending |
| REMIND-03 | 11 | Pending |
| REMIND-04 | 11 | Pending |
| REMIND-05 | 11 | Pending |
| DOC-01 | 12 | Pending |
| DOC-02 | 12 | Pending |
| DOC-03 | 12 | Pending |
| DOC-04 | 12 | Pending |
| DOC-05 | 12 | Pending |
| DOC-06 | 12 | Pending |
| DOC-07 | 12 | Pending |
| EXT-01 | 13 | Pending |
| EXT-02 | 13 | Pending |
| EXT-03 | 13 | Pending |
| EXT-04 | 13 | Pending |
| EXT-05 | 13 | Pending |
| EXT-06 | 13 | Pending |
| EXT-07 | 13 | Pending |
| EXT-08 | 13 | Pending |
| EXT-09 | 13 | Pending |
| RCRT-01 | 14 | Pending |
| RCRT-02 | 14 | Pending |
| RCRT-03 | 14 | Pending |
| RCRT-04 | 14 | Pending |
| RCRT-05 | 14 | Pending |
| RCRT-06 | 14 | Pending |
| RCRT-07 | 14 | Pending |
| RCRT-08 | 14 | Pending |
| ANAL-01 | 15 | Pending |
| ANAL-02 | 15 | Pending |
| ANAL-03 | 15 | Pending |
| ANAL-04 | 15 | Pending |
| ANAL-05 | 15 | Pending |
| ANAL-06 | 15 | Pending |
| ANAL-07 | 15 | Pending |
| ANAL-08 | 15 | Pending |
| CAL-01 | 16 | Pending |
| CAL-02 | 16 | Pending |
| CAL-03 | 16 | Pending |
| CAL-04 | 16 | Pending |
| CAL-05 | 16 | Pending |
| CAL-06 | 16 | Pending |
| CAL-07 | 16 | Pending |
| CAL-08 | 16 | Pending |
| CAL-09 | 16 | Pending |

**Coverage:**
- v0.3 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-05-10*
*Last updated: 2026-05-10 after roadmap creation*
