# Feature Landscape: foray v0.3 Full

**Domain:** Single-user, local-first job-application tracker
**Researched:** 2026-05-10
**Overall confidence:** MEDIUM — competitor behavior inferred from public product pages (Huntr, Simplify, Teal) and GitHub open-source repos; no direct user research data for v0.3 features specifically.

---

## Scope

This file covers the 6 features planned for the v0.3 Full milestone. For v0.1 Lean feature research, see `.planning/milestones/v0.1-REQUIREMENTS.md` and the archived version of this file.

---

## Feature Analysis

### 1. Chrome MV3 Extension — One-Click Capture

**Category:** TABLE STAKES
**Complexity:** Medium

**Why table stakes:** Every serious job tracker ships a browser extension. Huntr (4.9-star, 1.1k+ reviews on Chrome Web Store), Teal (Chrome extension is core), and Simplify (200M+ applications submitted via extension) all treat this as primary capture. Without it, users must manually copy-paste or rely on bookmarklet — both are friction-heavy. The bookmarklet (shipped in v0.2) reduces friction but still requires the user to activate it manually on each page; a content-script-based extension can auto-detect job posting pages and offer one-click capture.

**How it works in the ecosystem:**
- Content script injected on job posting pages extracts: job title, company name, location, salary, full job description text, posting URL
- Popup or side panel shows extracted data, lets user confirm/edit before saving
- Sends structured payload to capture API endpoint
- Some tools (Simplify) also offer autofill for application forms — out of scope for foray
- Some tools (Huntr) extract keywords for resume matching — out of scope for foray

**Expected behavior for foray:**
- Manifest V3 with service worker background script
- Content script with site-specific extractors (LinkedIn, Greenhouse, Lever, Workday, Ashby, generic fallback)
- Popup with pre-filled form showing extracted data
- Sends to existing `/api/capture` endpoint (already built for bookmarklet in v0.2)
- Creates Application with `source: extension` (EventSource enum already has `extension`)
- Fallback: generic extractor for unknown sites (title tag, meta description, visible text)
- Auth: extension authenticates via session cookie (same as bookmarklet) or API token

**Dependencies on existing features:**
- `/api/capture` endpoint (v0.2 bookmarklet)
- `Application` model, `EventSource.extension` enum
- Auth session cookie mechanism

**New work required:**
- Extension manifest, service worker, content scripts
- Site-specific DOM extractors (LinkedIn, Greenhouse, Lever, Workday, Ashby)
- Popup UI for pre-filled capture form
- Auth mechanism for extension-to-API communication
- Chrome Web Store listing (optional for single-user, could sideload)

**Anti-features to avoid:**
- Application autofill (Simplify does this — scope creep, not core value)
- Resume keyword extraction (AI feature, different product)
- Auto-applying to jobs (ADR-0001 explicitly rejects this)

---

### 2. Document Storage — Attach Resumes, Cover Letters, Artifacts

**Category:** TABLE STAKES
**Complexity:** Medium

**Why table stakes:** Job seekers need to track which version of their resume went to which company. Huntr offers resume storage, Teal offers resume storage, most trackers do. Without it, users resort to filesystem folder structures or Drive links in notes — which is what foray v0.1/v0.2 users do today (per PROJECT.md: "resume PDFs live in Drive for now").

**How it works in the ecosystem:**
- Upload PDF/DOCX files linked to a specific application
- Version tracking (which resume version went where)
- Some tools (Teal, Huntr) offer AI resume building — out of scope for foray
- Some tools store documents globally (one resume library) vs per-application — foray's schema is per-application

**Expected behavior for foray:**
- Upload endpoint accepting multipart form data (PDF, DOCX, images)
- Local filesystem storage under `data/documents/{userId}/{applicationId}/` (local-first, ADR-0003)
- File size limit: 10MB per file
- Document kinds: resume, cover_letter, jd_pdf, take_home, other (already in schema as `DocumentKind` enum)
- Download/view link on application detail page
- Version field for tracking iterations (already in schema: `version Int @default(1)`)
- Event logging: `EventType.document_uploaded` already exists in schema
- Max 20 documents per application (prevent abuse in single-user context)

**Dependencies on existing features:**
- `Document` model (already in schema with all fields)
- `DocumentKind` enum (already in schema)
- `EventType.document_uploaded` (already in schema)
- Application detail page (v0.1)

**New work required:**
- Upload API route (multipart form data handling in Next.js App Router)
- File storage directory management
- UI: upload component, document list on application detail, download/view
- MIME type validation (PDF, DOCX, PNG, JPG)
- Cleanup on application delete (cascade already in schema)

**Anti-features to avoid:**
- AI resume builder/generator (different product entirely)
- Resume scoring/ATS optimization (Teal does this — scope creep)
- Cloud storage integration (Google Drive, Dropbox — violates local-first ADR-0003)
- OCR for scanned documents (over-engineering for single user)

---

### 3. Recruiter Entity — Structured Recruiter Records

**Category:** DIFFERENTIATOR (mild)
**Complexity:** Low-Medium

**Why differentiator:** Most basic trackers don't have structured recruiter records. Huntr has a "Contact Tracker" for recruiters/hiring managers. Teal focuses more on the application itself. Foray already has the schema (Recruiter, ApplicationRecruiter junction table) but no UI. Building the UI acknowledges that job search is a relationship game, not just a pipeline game.

**How it works in the ecosystem:**
- Huntr: store contact details (email, phone, social media) for recruiters and hiring managers
- Some CRM-style tools track communication history with recruiters
- Most trackers just have a notes field on the application

**Expected behavior for foray:**
- CRUD for recruiter records: name, email, phone, LinkedIn URL, company, notes (already in schema)
- Link recruiters to applications via junction table with role field (already in schema: `ApplicationRecruiter`)
- Roles: "Recruiter", "Hiring Manager", "Founder", "Referral Contact"
- Show linked recruiters on application detail page
- Show all applications for a recruiter on recruiter detail page
- Auto-suggest: when Gmail classifier detects recruiter_outreach, suggest linking to existing recruiter record (nice-to-have, not MVP)

**Dependencies on existing features:**
- `Recruiter` model (already in schema)
- `ApplicationRecruiter` junction table (already in schema)
- `EventType.recruiter_linked` (already in schema)
- Classifier's `recruiter_outreach` label (v0.1)
- Application detail page (v0.1)

**New work required:**
- CRUD API routes for recruiters
- Recruiter list page (`/recruiters`)
- Recruiter detail page (`/recruiters/[id]`)
- Link/unlink UI on application detail page
- Auto-suggest from classifier (optional enhancement)

**Anti-features to avoid:**
- Full CRM pipeline for recruiters (this is a job tracker, not a sales CRM)
- Email threading with recruiters (Gmail already handles this)
- Automated outreach sequences (ethical concerns, scope creep)
- Recruiter scoring/rating (subjective, adds complexity)

---

### 4. Google Calendar Integration — Auto-Sync Interview Events

**Category:** DIFFERENTIATOR
**Complexity:** Medium-High

**Why differentiator:** No major job tracker deeply integrates with external calendars. Huntr has an internal interview tracker but no external calendar sync. Teal doesn't offer calendar integration. This would be a genuine differentiator: "your interview schedule lives in one place." However, the existing Today dashboard (v0.2) already shows upcoming interviews if manually entered as stages.

**How it works in the ecosystem:**
- Google Calendar API (Node.js client: `googleapis` package)
- OAuth2 flow with `calendar.events` scope (foray already has Gmail OAuth — can extend)
- Read: pull calendar events that match interview patterns, link to applications
- Write: create calendar events when user adds an interview stage to an application
- Two-way sync is hard (conflict resolution, which side is source of truth)

**Expected behavior for foray:**
- Extend existing Google OAuth to include `calendar.events` scope (requires re-auth for existing users)
- Write mode (primary): when user creates a Stage with a date, optionally create a Google Calendar event
- Read mode (secondary): scan upcoming calendar events, match to applications by company name or recruiter email
- Interview detection: look for calendar events with keywords (interview, screen, call, onsite, technical)
- Show upcoming interviews on Today dashboard (already has interview section in v0.2)
- One-way sync preferred: foray writes to calendar (simpler, fewer conflicts)

**Dependencies on existing features:**
- Google OAuth flow (v0.1 Gmail integration)
- Today dashboard interview section (v0.2)
- Stage model with dates (v0.1)

**New work required:**
- OAuth scope extension (requires re-consent flow)
- Calendar API client (googleapis package)
- Event matching logic (fuzzy match by company name, recruiter email)
- Calendar event creation from Stage UI
- Calendar event reading and matching to applications
- Timezone handling

**Anti-features to avoid:**
- Two-way sync (conflict resolution nightmare for single user — one-way write is enough)
- Outlook/Apple Calendar support (single user, already on Google)
- Meeting link extraction (over-engineering)
- Automatic interview scheduling (too aggressive)

---

### 5. Analytics Dashboard — Funnel, Response Rates, Time Metrics

**Category:** DIFFERENTIATOR
**Complexity:** Medium

**Why differentiator:** Teal and Huntr have basic metrics, but most trackers are just lists. A proper funnel visualization with response rates and time-to-offer is rare. This transforms foray from "where are my applications" to "how is my search actually going." However, per the existing FEATURES.md anti-feature analysis: "Funnel charts on n=5 forays are vanity metrics" — this feature only becomes valuable with >=30 forays of real data.

**How it works in the ecosystem:**
- Teal: basic metrics (applications per week, response rates)
- Huntr: "Job Search Metrics" (minimal detail on their site)
- Most trackers: count by status column (Kanban view)

**Expected behavior for foray:**
- Funnel visualization: Applied -> Screening -> Interviewing -> Offer (with conversion rates at each stage)
- Response rate: % of applications that moved past "applied" within 14/30 days
- Time metrics: median days from applied to first response, applied to offer, applied to rejection
- Weekly velocity: applications submitted per week (trend line)
- Source effectiveness: which source (linkedin, direct, referral, recruiter) has highest conversion
- Stale foray count over time
- All computed from existing data (Application, Event, Stage models)
- Chart library: Recharts (lightweight, good React integration, MIT license)

**Dependencies on existing features:**
- Application model (canonicalStatus, appliedAt, source)
- Event model (timestamps, types — status_changed, auto_status_changed)
- Stage model (dates, outcomes)

**New work required:**
- Analytics API route (aggregation queries over Application, Event, Stage)
- Chart components (funnel, line, bar)
- Analytics page (`/analytics`)
- Time calculations (timezone, business days)
- Funnel math: handle applications that skip stages

**Anti-features to avoid:**
- AI-powered insights ("you should apply to more startups") — subjective, not data
- Salary negotiation analytics (too specific)
- Predictive modeling (will I get an offer?) — over-engineering
- Export to spreadsheet (nice-to-have, not core)
- Comparison with other users' metrics (single-user, no benchmark data)

---

### 6. Reminders + Polish — Follow-up Nudges, Notification System, Final UX Polish

**Category:** TABLE STAKES (reminders) + DIFFERENTIATOR (polish)
**Complexity:** Low (reminders) + Medium (polish)

**Why table stakes + differentiator:** Follow-up reminders are expected — Huntr has them, Teal has them. Without them, users forget to follow up on applications. The "polish" part is differentiator: making the whole experience feel complete and refined. Per the existing FEATURES.md: "Reminder fatigue — cap suggestions at 3 per day."

**How it works in the ecosystem:**
- Huntr: set follow-up dates per application, reminders when due
- Teal: similar follow-up tracking
- Most trackers: basic date-based reminders

**Expected behavior for foray:**

**Reminders:**
- `followUpAt` field already exists on Application model (v0.1 schema)
- Set follow-up date when creating application or from detail view
- Today dashboard shows overdue/upcoming follow-ups (Today dashboard exists in v0.2)
- Browser notification when follow-up is due (Notification API, no external service)
- Auto-suggest follow-up: 7 days after application if no response, 3 days after interview

**Polish (v0.3 completion pass):**
- Loading states for all async operations
- Empty states with helpful guidance (no applications yet, no documents, etc.)
- Error boundaries with retry actions
- Keyboard shortcut help overlay (shortcuts exist in v0.2, need discoverability)
- Mobile-responsive layout pass
- Accessibility audit (ARIA labels, focus management, screen reader)
- Performance: list virtualization for large application lists (react-window or similar)
- Dark mode toggle (if not already done in v0.2)

**Dependencies on existing features:**
- `followUpAt` on Application model (v0.1)
- Today dashboard (v0.2)
- Keyboard shortcuts (v0.2)
- Notification API (browser-native, no external dependency)

**New work required:**
- Follow-up date picker UI
- Today dashboard section for follow-ups
- Browser notification permission request + scheduling
- Auto-suggest follow-up logic (date-based triggers)
- Polish passes (loading states, empty states, error boundaries, a11y, responsive)

**Anti-features to avoid:**
- Email/SMS notifications (requires external service, violates local-first)
- Push notification service (requires server infrastructure)
- Automated follow-up email drafting (scope creep)
- Gamification (streaks, achievements — not aligned with foray's tone)
- Aggressive nag notifications (cap at 3/day per existing risk analysis)

---

## Summary: Table Stakes vs Differentiators vs Anti-Features

| Feature | Category | Complexity | Key Existing Dependency |
|---------|----------|------------|-------------------------|
| Chrome Extension | TABLE STAKES | Medium | `/api/capture` (v0.2), EventSource.extension |
| Document Storage | TABLE STAKES | Medium | Document model (v0.1 schema), DocumentKind enum |
| Recruiter Entity | DIFFERENTIATOR (mild) | Low-Medium | Recruiter model (v0.1 schema), ApplicationRecruiter |
| Google Calendar | DIFFERENTIATOR | Medium-High | Google OAuth (v0.1), Today dashboard (v0.2) |
| Analytics Dashboard | DIFFERENTIATOR | Medium | Application + Event + Stage data (v0.1) |
| Reminders + Polish | TABLE STAKES + DIFFERENTIATOR | Low + Medium | followUpAt (v0.1), Today dashboard (v0.2) |

## Feature Dependencies (v0.3 internal)

```
Chrome Extension → Capture API (v0.2), Auth session cookie
Document Storage → Application Detail (v0.1)
Recruiter Entity → Application Detail (v0.1), Classifier recruiter_outreach (v0.1)
Google Calendar → Google OAuth (v0.1), Today Dashboard (v0.2)
Analytics Dashboard → Application + Event + Stage data (v0.1)
Reminders → Application model followUpAt (v0.1), Today Dashboard (v0.2)
```

No v0.3 feature blocks another v0.3 feature. All can be built in any order. Recommended ordering prioritizes table stakes first, then differentiators by complexity.

## MVP Recommendation for v0.3

**Phase order (table stakes first, then differentiators by complexity):**

1. **Reminders** — low complexity, `followUpAt` already in schema, high daily value
2. **Document Storage** — schema already exists, straightforward file upload, table stakes
3. **Chrome Extension** — highest user friction reduction, extends existing capture API, table stakes
4. **Recruiter Entity** — schema exists, moderate UI work, mild differentiator
5. **Analytics Dashboard** — all data exists, aggregation + visualization work, differentiator
6. **Google Calendar** — highest complexity, OAuth extension, fuzzy matching, differentiator

**Rationale:** Start with the feature that requires the least new surface area (Reminders — just UI on existing field). Then build features that extend existing models (Document, Recruiter). Then build features that require new infrastructure (Extension, Analytics, Calendar). This minimizes integration risk and delivers value early.

## Sources

- Huntr feature page (huntr.co) — MEDIUM confidence, direct fetch
- Simplify Jobs (simplify.jobs) — MEDIUM confidence, direct fetch
- GitHub topic: job-application-tracker (34 repos) — MEDIUM confidence, direct fetch
- Chrome Extension MV3 docs (developer.chrome.com) — HIGH confidence, official docs
- Google Calendar API quickstart — HIGH confidence, official docs
- Next.js Route Handlers docs — HIGH confidence, official docs
- Existing foray schema (prisma/schema.prisma) — HIGH confidence, direct code read
- Existing FEATURES.md anti-feature analysis — HIGH confidence, internal research from v0.1
