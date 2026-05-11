# QA Release Test Scenarios

Reusable senior QA/QC checklist for deciding whether `foray` is release-ready.

This document is intentionally broader than the automated test suite. Use it before a release, after a large phase, or before merging a feature branch that touches product workflows.

## Release Decision

A build is **release-ready** only when:

- All automated release gates pass.
- No P0 or P1 bugs remain open.
- Every critical manual scenario in this document is marked Pass or explicitly waived.
- Any waived scenario has an owner, reason, and follow-up issue.
- Real external integrations are tested at least once per release candidate when their code changed.

Severity:

| Severity | Meaning | Release impact |
|---|---|---|
| P0 | Data loss, auth bypass, cross-tenant leak, secret leak, app cannot start | Block release |
| P1 | Core workflow broken, irreversible wrong automation, OAuth/capture unusable | Block release unless explicitly waived |
| P2 | Important UX/API bug with workaround | Release manager decision |
| P3 | Cosmetic, copy, minor edge case | Does not block |

## Automated Release Gates

Run from repo root:

```bash
pnpm install
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm e2e
pnpm extension:build
```

Expected:

- `pnpm lint` exits 0. Existing dependency-boundaries deprecation warnings are acceptable until the ESLint config is migrated.
- `pnpm test:run` exits 0.
- `pnpm build` exits 0. The known Turbopack NFT tracing warning through `src/features/classifier/budget.ts` is acceptable; new warning classes must be investigated.
- `pnpm e2e` exits 0 against a clean E2E database.
- `pnpm extension:build` produces a loadable extension bundle.

If Docker socket issues block Testcontainers locally, record the exact failure and rerun with the documented Docker host workaround before declaring the gate failed.

## Test Data Setup

Minimum seeded data for manual QA:

- One user with valid local session password.
- At least 8 applications:
  - applied, screening, interviewing, offer, rejected, withdrawn statuses represented
  - at least one archived application
  - at least one stale application with no recent activity
  - at least one overdue follow-up
  - at least one application with tags
  - at least one application with linked recruiter
  - at least one application with attached document
- At least 6 emails:
  - matched high-confidence rejection
  - matched high-confidence interview invite
  - matched low-confidence message requiring review
  - unmatched recruiter outreach
  - noise/newsletter
  - malformed or unsupported message fixture for failure-path checks
- One recruiter with multiple linked applications.
- One upcoming calendar event matched to an application and one unmatched event.
- Optional but recommended: real Gmail OAuth, real Google Calendar OAuth, one real Anthropic key, one real OpenAI key.

## Critical Smoke

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| SMK-01 | App boots in dev | `docker compose up -d db`, `pnpm db:migrate`, `pnpm dev`, open `/login` | Login page renders without server errors |
| SMK-02 | Production build starts | `pnpm build`, then `pnpm start`, open `/login` | Production server responds and renders login |
| SMK-03 | Auth gate | Visit `/today`, `/applications`, `/settings` logged out | Each protected page redirects to `/login` |
| SMK-04 | Auth success | Log in with `APP_PASSWORD` | Redirects to `/applications` or app default page; nav is visible |
| SMK-05 | Bad password | Submit wrong password | Stays on login and shows error without creating session |
| SMK-06 | Navigation shell | Visit Today, Applications, Inbox, Search, Recruiters, Analytics, Settings | Each page renders the expected heading and no React/runtime error |

## Applications

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| APP-01 | Create minimal application | `/applications/new`, fill company, role, source, applied date, submit | Application is created, detail page opens, timeline has created event |
| APP-02 | Create application with full details | Add URL, location, salary, tags, notes, job description, referral | All fields persist and display correctly |
| APP-03 | Validation errors | Submit missing required fields and invalid URL/salary ranges | Inline errors display; no partial record created |
| APP-04 | Company reuse | Create second application for same company name/domain | Existing company is reused or duplicate prevention behaves as designed |
| APP-05 | Board view | Open `/applications` default view | Applications appear under correct canonical status columns |
| APP-06 | List view | Open `/applications?view=list` and sort | Rows render, sort order changes predictably |
| APP-07 | Status transition | Change status applied -> screening -> interviewing -> rejected | Status persists; rejectedAt is set only for rejected; timeline records transitions |
| APP-08 | Status regression guard | Attempt invalid regression if UI/API exposes one | Regression is blocked or requires intentional workflow per status rules |
| APP-09 | Stage management | Add, edit, complete stage with scheduled time | Stage appears in timeline/detail; completed state persists |
| APP-10 | Notes | Add and edit notes | Notes persist without corrupting timeline |
| APP-11 | Tags | Add/remove tags, filter by tag | Tags persist; `/applications?tag=...` shows matching applications |
| APP-12 | Archive behavior | Archive an application if supported by UI | It disappears from default lists but remains accessible by direct detail/filter |
| APP-13 | Empty state | Reset DB and open applications | Empty state is helpful and no broken controls appear |

## Follow-Ups And Today Dashboard

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| TOD-01 | Today dashboard default | Open `/today` with seeded data | Decisions, interviews, follow-ups, quiet/stale sections render |
| TOD-02 | Overdue follow-up | Set follow-up date to yesterday | Application appears in follow-ups due |
| TOD-03 | Future follow-up | Set follow-up date to tomorrow | Application does not appear as overdue |
| TOD-04 | Clear follow-up | Remove follow-up date | Application leaves follow-up section |
| TOD-05 | Stale application | Seed app with `lastActivityAt` older than stale threshold | App appears in needs-attention/quiet section |
| TOD-06 | Review queue count | Seed emails needing review | Today decisions section shows correct count/link |
| TOD-07 | Empty Today | Reset DB and open Today | Empty states render without misleading counts |
| TOD-08 | Performance | Load Today with about 100 applications and 50 events | Page is usable; target browser load under 2s locally |

## Capture, Bookmarklet, And Extension

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| CAP-01 | Bookmarklet capture API | POST title, URL, selected text to `/api/capture` | Returns `/applications/new?prefilled=...` with correct encoded fields |
| CAP-02 | Capture prefill form | Open returned redirect URL while logged in | New application form fields are prefilled |
| CAP-03 | ATS rejection | Capture Greenhouse/Workday/Lever board URL directly | API rejects unsupported ATS board URL with clear error |
| CAP-04 | Invalid payload | POST malformed JSON, missing URL, unsupported content type | Returns 400/415 as appropriate; no record created |
| CAP-05 | Extension token create | In Settings, generate extension token | Token displays once; token hash stored; no raw token persists in DB |
| CAP-06 | Extension token revoke | Revoke token and retry extension/API capture with old token | Capture is rejected with Unauthorized |
| CAP-07 | Extension load unpacked | Build extension, load in Chrome, configure base URL/token | Extension loads with no manifest/service-worker errors |
| CAP-08 | Extension popup capture | Visit normal job page, open popup, click capture | Popup reports success and links to prefilled Foray form |
| CAP-09 | Extension SPA navigation | On LinkedIn-like SPA, navigate between job posts without full reload | Popup captures current tab URL/title after navigation |
| CAP-10 | Extension storage persistence | Close/reopen browser or extension popup | Base URL/token settings persist in `chrome.storage.local` |

## Gmail, Classifier, Matcher, Review Queue

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| GML-01 | Gmail connect | Settings -> Connect Gmail with test Google account | OAuth completes; connected state and last sync render |
| GML-02 | Gmail disconnect | Disconnect Gmail | Refresh token removed; connected state clears; sync disabled |
| GML-03 | Sync now | Click Sync now with Gmail connected | New emails are ingested once; last sync updates |
| GML-04 | Idempotent ingestion | Run sync twice with same Gmail history/messages | No duplicate Email rows |
| GML-05 | Thread match | Ingest email in known Gmail thread | Email links to existing application |
| GML-06 | Domain match | Ingest email from company domain matching application company | Email links to correct application |
| GML-07 | Ambiguous match | Ingest email where multiple apps could match | Email goes to review, not an arbitrary app |
| CLS-01 | Rules-first rejection | Classify canonical rejection fixture | Label rejection, high confidence, no LLM call |
| CLS-02 | Rules-first interview invite | Classify scheduling fixture | Label interview_invite, high confidence |
| CLS-03 | Noise | Classify newsletter fixture | Label noise; no status automation |
| CLS-04 | Low-confidence LLM path | Classify weak relevant message with budget available | LLM provider is called; cost log contains token counts and email hash only |
| CLS-05 | Budget fail-closed | Corrupt classifier cost log, classify weak relevant email | Classification returns RateLimited; LLM is not called |
| CLS-06 | Anthropic provider | Select Anthropic in Settings and classify low-confidence email | Anthropic adapter used; model in cost log is Claude Haiku |
| CLS-07 | OpenAI provider | Configure `OPENAI_API_KEY`, select OpenAI, classify low-confidence email | OpenAI Responses adapter used; output validates against schema |
| CLS-08 | Missing OpenAI key | Remove `OPENAI_API_KEY`, open Settings | OpenAI shows missing key and cannot be saved |
| RVW-01 | Needs review queue | Seed low-confidence/unmatched classified emails | Inbox shows review items with label/confidence/application context |
| RVW-02 | Confirm classification | Confirm suggested label | Email marked reviewed; linked app status updates if eligible |
| RVW-03 | Override classification | Override label manually | Manual label persists; event records manual classification |
| RVW-04 | Ignore email | Ignore noise/unrelated email | Email leaves queue without app status change |
| RVW-05 | Link to application | Link unmatched email to application | Email links; subsequent action applies to linked application |
| RVW-06 | Full body on demand | Request full body from inbox item | Full body fetch works only when authorized and Gmail connected; body is not stored indefinitely |

## Documents

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| DOC-01 | Upload PDF resume | Application detail -> upload valid PDF <=10MB | Document appears with kind, filename, size, date; timeline event created |
| DOC-02 | Upload DOCX cover letter | Upload valid DOCX | Document persists and displays correct kind/MIME |
| DOC-03 | Magic-byte validation | Rename invalid binary to `.pdf` and upload | Upload rejected by content validation |
| DOC-04 | Size validation | Upload file >10MB | Upload rejected with clear error; no orphan file/DB row |
| DOC-05 | Download | Click document download | File downloads with correct Content-Type and Content-Disposition |
| DOC-06 | Delete | Delete a document | DB row and local file are removed; UI updates |
| DOC-07 | Auth isolation | Try direct download URL logged out | Redirect/Unauthorized; file not disclosed |

## Recruiters

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| RCR-01 | Create recruiter | `/recruiters`, create recruiter with name/email/company | Recruiter appears in list |
| RCR-02 | Validation | Submit invalid email/URL | Inline errors; no invalid record |
| RCR-03 | Recruiter detail | Open recruiter detail | Shows contact info and linked applications |
| RCR-04 | Link recruiter to application | Application detail -> link recruiter with role | Recruiter appears on application; timeline has recruiter_linked event |
| RCR-05 | Unlink recruiter | Remove recruiter from application | Link disappears; other recruiter record remains |
| RCR-06 | Duplicate prevention | Create/link recruiter with same email | Existing recruiter is suggested or duplicate is blocked |

## Calendar

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| CAL-01 | Calendar connect | Settings -> Connect Calendar with readonly scope | OAuth completes; connected state renders |
| CAL-02 | Calendar disconnect | Disconnect Calendar | Token removed; sync disabled |
| CAL-03 | Sync now | Click Calendar sync | Events from now-7d to now+30d are fetched |
| CAL-04 | Idempotent upsert | Sync same event twice with unchanged etag | No duplicate CalendarEvent rows |
| CAL-05 | Matched interview | Calendar event attendee/organizer domain matches application company | Event links to application and appears on Today |
| CAL-06 | Unmatched event | Event has no matching company domain | Event persists without application link if interview-like, or is skipped per filter |
| CAL-07 | Cancelled event | Calendar returns cancelled event | Stored status updates; Today display handles cancelled state correctly |
| CAL-08 | Token failure | Expire/revoke Google token | Settings surfaces reconnect state; cron does not crash |

## Analytics

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| ANA-01 | Dashboard loads | Open `/analytics` with seeded applications | Funnel, response, weekly activity, source effectiveness sections render |
| ANA-02 | Funnel counts | Compare dashboard counts to raw application statuses | Counts match database |
| ANA-03 | Response rate | Seed responded/unresponded applications | Response rate matches expected numerator/denominator |
| ANA-04 | Median time to response | Seed known timestamps | Median matches expected calculation |
| ANA-05 | Weekly activity | Seed applications across weeks | Bars/counts match weeks |
| ANA-06 | Source effectiveness | Seed multiple sources and outcomes | Table conversion rates match raw data |
| ANA-07 | Empty analytics | Reset DB and open analytics | Empty/zero states render without NaN or broken charts |
| ANA-08 | Performance | Load dashboard with about 500 applications/events | Queries stay SQL-backed and page remains usable |

## Search, Tags, And Keyboard Shortcuts

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| SRH-01 | Empty search | Open `/search` without query | Shows search prompt |
| SRH-02 | Application search | Search by role/company/tag | Matching applications appear with highlighted terms |
| SRH-03 | Email/stage search | Search by email subject or stage name | Relevant results appear and link to context |
| SRH-04 | No results | Search unique nonsense term | No-results state appears |
| SRH-05 | Search shortcut | Press `/` on Search | Search input focuses |
| KBD-01 | New application shortcut | Press `n` outside inputs | Navigates to `/applications/new` |
| KBD-02 | Go shortcuts | Press `g` then `a`, `i`, `s` | Navigates to Applications, Inbox, Settings respectively |
| KBD-03 | Input safety | Focus input and type shortcut keys | Keys type into input; no navigation occurs |

## Settings And Configuration

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| SET-01 | Settings page | Open `/settings` | Gmail, Calendar, Extension token, LLM provider sections render |
| SET-02 | LLM provider save | Select Anthropic/OpenAI when key is configured and save | Selection persists after reload |
| SET-03 | LLM provider missing key | Select provider without key | Save is disabled and missing-key copy is visible |
| SET-04 | Env validation | Start app missing required env var | Startup fails loud with useful env validation error |
| SET-05 | Secret redaction | Trigger logs involving tokens/API calls | Logs do not print API keys, OAuth tokens, cookies, or full email bodies |

## Security And Privacy

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| SEC-01 | Protected pages | Visit every app page logged out | Protected pages redirect to login |
| SEC-02 | Protected APIs | Call document/full-body/user-sensitive APIs logged out | APIs return Unauthorized/redirect and no data |
| SEC-03 | Capture bearer auth | Extension capture without/with invalid token | Rejected; valid token accepted |
| SEC-04 | Tenant isolation | Run RLS/integration tests with Alice/Bob fixtures | Alice cannot see Bob data through queries or raw RLS paths |
| SEC-05 | Email privacy | Inspect Email rows after ingestion | Only metadata/excerpts stored; no full bodies persisted |
| SEC-06 | Cost log privacy | Inspect classifier log | Contains model, token counts, cost, email hash; no raw subject/body |
| SEC-07 | Document path traversal | Attempt malicious filename/path | Filename sanitized; file remains under document storage root |
| SEC-08 | OAuth state | Start OAuth and tamper callback state if supported | Callback rejects invalid/missing state |

## Accessibility, Responsive, And Visual QA

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| UI-01 | Desktop layout | Check main pages at 1440x900 | No overlapping text; dense work-focused layout; nav usable |
| UI-02 | Laptop layout | Check main pages at 1280x800 | Primary workflows fit and controls remain visible |
| UI-03 | Mobile layout | Check login, Today, Applications, detail, Settings at 390x844 | No horizontal overflow; controls wrap cleanly |
| UI-04 | Keyboard-only | Tab through login, app nav, forms, dialogs | Focus order is logical; visible focus states |
| UI-05 | Screen-reader basics | Inspect headings, buttons, form labels, dialogs | Interactive controls have accessible names |
| UI-06 | Loading/pending states | Submit forms/actions with slow network simulation | Buttons indicate pending state and prevent duplicate submission |
| UI-07 | Error states | Force service/API errors | User sees clear non-secret error; app remains usable |
| UI-08 | Localization smoke | Switch/check message catalogs if locale routing is enabled | No missing visible copy keys in supported locales |

## Data And Migration QA

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| DB-01 | Fresh migration | Empty database -> `pnpm db:migrate` | All migrations apply cleanly |
| DB-02 | Reset and seed | `pnpm db:reset`, `pnpm seed` | Seed completes; app loads seeded data |
| DB-03 | Existing data migration | Apply latest migrations to previous release database snapshot | Existing rows survive; defaults are correct |
| DB-04 | Prisma generation | `pnpm db:generate` | Generated client matches schema |
| DB-05 | Backup manual check | Create pg dump before migration and restore to scratch DB | Restored DB can migrate and app boots |

## Release Sign-Off Template

Copy this into a release issue or PR:

```markdown
## QA Release Sign-Off

Release candidate:
Commit:
Tester:
Date:
Environment:

### Automated Gates
- [ ] pnpm db:generate
- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm test:run
- [ ] pnpm build
- [ ] pnpm e2e
- [ ] pnpm extension:build

### Critical Manual Areas
- [ ] Auth and navigation
- [ ] Application create/detail/status/stage/tags
- [ ] Today dashboard and follow-ups
- [ ] Capture API/bookmarklet
- [ ] Chrome extension load-unpacked and capture
- [ ] Gmail connect/sync/review queue
- [ ] Classifier provider selection: Anthropic and OpenAI
- [ ] Documents upload/download/delete
- [ ] Recruiters link/unlink
- [ ] Calendar connect/sync/matching
- [ ] Analytics dashboard
- [ ] Search and keyboard shortcuts
- [ ] Settings and token management
- [ ] Security/privacy checks
- [ ] Responsive/accessibility smoke
- [ ] Migration/data checks

### Open Issues
| ID | Severity | Area | Summary | Decision |
|---|---|---|---|---|
| | | | | |

### Decision
- [ ] Ready to release
- [ ] Not ready
- [ ] Ready with waivers listed above
```

## Current Automation Coverage Map

Automated coverage currently exists for:

- Unit/service: applications, stages, notes, follow-ups, classifier rules/LLM/budget/providers, documents, inbox actions/queries/service, shortcuts, Today components/queries, settings actions.
- Integration: RLS isolation, matcher, inbox pipeline, classifier fixtures, Gmail OAuth, capture/bookmarklet/extension capture, documents, recruiters, analytics, calendar.
- E2E: capture prefill, Today dashboard smoke, search/tag filters, keyboard shortcuts.

Manual coverage still required for every release candidate:

- Real Gmail OAuth and real Gmail API sync.
- Real Google Calendar OAuth and real Calendar API sync.
- Real Anthropic/OpenAI API calls if classifier provider code changed.
- Chrome extension load-unpacked in Chrome and SPA navigation behavior.
- File download behavior in a real browser.
- Responsive visual pass across desktop and mobile widths.
