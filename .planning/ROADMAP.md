# Roadmap: foray

**Created:** 2026-05-09
**Last Updated:** 2026-05-11

---

## Milestones

- ✅ **v0.1 Lean** — Phases 1-5 (shipped 2026-05-09)
- ✅ **v0.2 Standard** — Phases 6-10 (shipped 2026-05-10)
- ✅ **v0.3 Full** — Phases 11-16 (shipped 2026-05-11)
- 🚧 **v0.4 Future** — Phase 17 complete; next scope TBD

---

## Phases

<details>
<summary>✅ v0.1 Lean (Phases 1-5) — SHIPPED 2026-05-09</summary>

- [x] Phase 1: Foundation + Auth (4/4 plans) — completed 2026-05-09
- [x] Phase 2: Applications Slice (5/5 plans) — completed 2026-05-09
- [x] Phase 3: Classifier + Matcher (5/5 plans) — completed 2026-05-09
- [x] Phase 4: Gmail Ingestion + Pipeline (5/5 plans) — completed 2026-05-09
- [x] Phase 5: Review Queue + Acceptance (3/3 plans) — completed 2026-05-09

</details>

<details>
<summary>✅ v0.2 Standard (Phases 6-10) — SHIPPED 2026-05-10</summary>

- [x] Phase 6: Bookmarklet + Capture API (3/3 plans) — completed 2026-05-10
- [x] Phase 7: Today Dashboard (3/3 plans) — completed 2026-05-10
- [x] Phase 8: Tags + Search (3/3 plans) — completed 2026-05-10
- [x] Phase 9: UX Polish + Keyboard Shortcuts (3/3 plans) — completed 2026-05-10
- [x] Phase 10: E2E Tests + Acceptance (3/3 plans) — completed 2026-05-10

</details>

<details>
<summary>✅ v0.3 Full (Phases 11-16) — SHIPPED 2026-05-11</summary>

**Milestone Goal:** Transform foray from a capture-and-classify tool into a complete job-search command center with browser extension, document management, calendar integration, and analytics.

- [x] **Phase 11: Reminders + Cron Infrastructure** - Follow-up dates, Today dashboard integration, CronRegistry upgrade (completed 2026-05-10)
- [x] **Phase 12: Document Storage** - File upload/download/delete for resumes, cover letters, and artifacts (completed 2026-05-10)
- [x] **Phase 13: Chrome MV3 Extension** - One-click capture from job posting pages via browser extension (completed 2026-05-10)
- [x] **Phase 14: Recruiter Entity** - Structured recruiter records linked to applications (completed 2026-05-10)
- [x] **Phase 15: Analytics Dashboard** - Funnel visualization, response rates, weekly activity, source effectiveness (completed 2026-05-11)
- [x] **Phase 16: Google Calendar Integration** - One-way sync of interview events from Google Calendar (completed 2026-05-11)

</details>

### 🚧 v0.4 Future

- [x] **Phase 17: Multi-LLM Provider Abstraction** - Extract classifier LLM provider boundary beyond the current Anthropic-only adapter (completed 2026-05-11)

## Phase Details

### Phase 11: Reminders + Cron Infrastructure
**Goal**: Owner can set follow-up dates on applications and see overdue follow-ups on the Today dashboard, powered by a robust multi-job cron infrastructure.
**Depends on**: Phase 10
**Requirements**: REMIND-01, REMIND-02, REMIND-03, REMIND-04, REMIND-05
**Success Criteria** (what must be TRUE):
  1. Owner can set and change a follow-up date on any application via the detail view
  2. Today dashboard shows a "Follow-ups due" section listing applications where `followUpAt <= now()`
  3. Count badge on Today nav link displays the number of overdue follow-ups
  4. Reminder check cron runs every 15 minutes without hot-reload double-fire (CronRegistry pattern)
  5. Overdue follow-ups appear in Today view within 15 minutes of becoming due
**Plans:** 3/3 plans complete
Plans:
- [x] 11-01-PLAN.md — CronRegistry + Follow-up Backend
- [x] 11-02-PLAN.md — Follow-up UI Components
- [x] 11-03-PLAN.md — Wiring + Nav Badge
**UI hint**: yes

### Phase 12: Document Storage
**Goal**: Owner can attach, view, download, and delete documents (resumes, cover letters, JD PDFs, take-homes) on any application, with validated uploads and timeline tracking.
**Depends on**: Phase 11
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07
**Success Criteria** (what must be TRUE):
  1. Owner can upload a document to an application via multipart form; file stored on local filesystem with server-generated filename
  2. Owner can download any attached document with correct Content-Type and Content-Disposition headers
  3. Owner can delete a document; file removed from disk and DB row removed in one transaction
  4. Document list in application detail view shows kind, filename, size, and upload date
  5. Upload validates MIME type via magic bytes (not extension), rejects files over 10MB, and creates a `document_uploaded` event in the timeline
**Plans:** 3/3 plans complete
Plans:
- [x] 12-01-PLAN.md — Document Schema + Service Layer (Wave 1)
- [x] 12-02-PLAN.md — Document API Routes + Integration Tests (Wave 1)
- [x] 12-03-PLAN.md — Document UI Components + Wiring (Wave 2)
**UI hint**: yes

### Phase 13: Chrome MV3 Extension
**Goal**: Owner can capture a job posting directly from the browser with one click, sending the page title and URL to foray's capture API via a Chrome extension.
**Depends on**: Phase 12
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09
**Success Criteria** (what must be TRUE):
  1. Extension popup captures current tab's title and URL and sends POST to `/api/capture` with Bearer token auth
  2. Extension popup shows capture success status and "Open in Foray" link to prefilled application form
  3. Extension handles SPA navigation (LinkedIn, etc.) via `webNavigation.onHistoryStateUpdated`
  4. All extension state stored in `chrome.storage.local`; no module variables (MV3 service worker dies after 30s)
  5. Build pipeline (WXT) produces a loadable extension directory for dev and production
**Plans:** 3/3 plans complete
Plans:
- [x] 13-01-PLAN.md — Token Infrastructure + Capture Route Auth (Wave 1)
- [x] 13-02-PLAN.md — WXT Extension Scaffold + Popup + Capture Flow (Wave 2)
- [x] 13-03-PLAN.md — SPA Navigation + Build Pipeline Finalization (Wave 3)

### Phase 14: Recruiter Entity
**Goal**: Owner can create and manage recruiter records, link them to applications with roles, and see linked recruiters on application detail views.
**Depends on**: Phase 13
**Requirements**: RCRT-01, RCRT-02, RCRT-03, RCRT-04, RCRT-05, RCRT-06, RCRT-07, RCRT-08
**Success Criteria** (what must be TRUE):
  1. Owner can create, view, and edit recruiter records (name, email, LinkedIn URL, phone, notes) at `/recruiters`
  2. Owner can link a recruiter to an application with a role (Recruiter, Hiring Manager, Founder, etc.) and unlink them
  3. Application detail view shows linked recruiters with role and contact info
  4. Linking a recruiter auto-suggests existing recruiters by email match to prevent duplicates
  5. `recruiter_linked` event appears in application timeline when a recruiter is linked
**Plans**: Complete
**UI hint**: yes

### Phase 15: Analytics Dashboard
**Goal**: Owner can view campaign-level analytics including funnel conversion, response rates, time-to-response, weekly activity, and source effectiveness on a dedicated `/analytics` page.
**Depends on**: Phase 14
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04, ANAL-05, ANAL-06, ANAL-07, ANAL-08
**Success Criteria** (what must be TRUE):
  1. `/analytics` page shows funnel visualization with count of forays at each canonical status
  2. Response rate and median time-to-response metrics are displayed
  3. Weekly activity bar chart shows applications created per week
  4. Source effectiveness table shows breakdown by `ApplicationSource` with conversion rates
  5. Stale forays count (7+ days no activity) is shown and links to a filtered list
  6. All aggregation queries use SQL (Prisma `groupBy`/`aggregate` or `$queryRaw`); no in-memory processing
**Plans**: Complete
**UI hint**: yes

### Phase 16: Google Calendar Integration
**Goal**: Owner can connect Google Calendar and see upcoming interview events auto-synced into foray, matched to applications where possible, on the Today dashboard.
**Depends on**: Phase 15
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06, CAL-07, CAL-08, CAL-09
**Success Criteria** (what must be TRUE):
  1. Owner can connect Google Calendar via OAuth flow (separate from Gmail token) with `calendar.events.readonly` scope
  2. Settings page shows Calendar connection state with Connect/Disconnect actions
  3. Calendar sync cron fetches events (now - 7d to now + 30d) and stores them as `CalendarEvent` records with idempotent upserts via etag
  4. Calendar events matched to applications via attendee email domain; matched events link to the associated application
  5. Today dashboard shows upcoming calendar events in the next 7 days with links to matched applications
**Plans**: Complete
**UI hint**: yes

### Phase 17: Multi-LLM Provider Abstraction
**Goal**: Decouple the classifier from a single Anthropic SDK adapter so additional LLM providers can be configured later without changing classifier orchestration.
**Depends on**: Phase 16
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06
**Success Criteria** (what must be TRUE):
  1. Classifier service depends on a provider-neutral LLM interface, not directly on an Anthropic-specific module
  2. Existing Anthropic behavior, model settings, structured output validation, cost logging, and error mapping remain unchanged
  3. Provider selection is explicit and validated at startup or configuration boundary
  4. Existing classifier tests still pass, with added coverage for provider selection/fallback boundaries
  5. Settings page lets the owner choose Anthropic or OpenAI and shows key availability
  6. Gmail ingestion uses the persisted per-user provider setting
**Plans**: Complete
Plans:
- [x] 17-RESEARCH.md — Provider/API research
- [x] 17-PLAN.md — Implementation plan
- [x] 17-SUMMARY.md — Completion summary
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 11 → 12 → 13 → 14 → 15 → 16 → 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Auth | v0.1 | 4/4 | ✅ Complete | 2026-05-09 |
| 2. Applications Slice | v0.1 | 5/5 | ✅ Complete | 2026-05-09 |
| 3. Classifier + Matcher | v0.1 | 5/5 | ✅ Complete | 2026-05-09 |
| 4. Gmail Ingestion + Pipeline | v0.1 | 5/5 | ✅ Complete | 2026-05-09 |
| 5. Review Queue + Acceptance | v0.1 | 3/3 | ✅ Complete | 2026-05-09 |
| 6. Bookmarklet + Capture API | v0.2 | 3/3 | ✅ Complete | 2026-05-10 |
| 7. Today Dashboard | v0.2 | 3/3 | ✅ Complete | 2026-05-10 |
| 8. Tags + Search | v0.2 | 3/3 | ✅ Complete | 2026-05-10 |
| 9. UX Polish + Keyboard Shortcuts | v0.2 | 3/3 | ✅ Complete | 2026-05-10 |
| 10. E2E Tests + Acceptance | v0.2 | 3/3 | ✅ Complete | 2026-05-10 |
| 11. Reminders + Cron Infrastructure | v0.3 | 3/3 | ✅ Complete | 2026-05-10 |
| 12. Document Storage | v0.3 | 3/3 | ✅ Complete | 2026-05-10 |
| 13. Chrome MV3 Extension | v0.3 | 3/3 | ✅ Complete | 2026-05-10 |
| 14. Recruiter Entity | v0.3 | 1/1 | ✅ Complete | 2026-05-10 |
| 15. Analytics Dashboard | v0.3 | 1/1 | ✅ Complete | 2026-05-11 |
| 16. Google Calendar Integration | v0.3 | 1/1 | ✅ Complete | 2026-05-11 |
| 17. Multi-LLM Provider Abstraction | v0.4 | 1/1 | ✅ Complete | 2026-05-11 |

## Archive

- v0.1: `.planning/milestones/v0.1-ROADMAP.md`
- v0.2: `.planning/milestones/v0.2-ROADMAP.md`
