# Milestone: Full

> **Goal**: the real-product version. Native browser extension, file storage, recruiter relationship management, calendar sync, analytics, and reminders.

**Estimated effort**: ~2-3 weeks
**Status**: 🚧 In progress — Phases 11-12 complete, Phase 13 executing
**Prerequisites**: Standard milestone complete

**Live plan**: [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md) is the source of truth for current phase status.

---

## In scope

### Native Chrome MV3 extension (Phase 13, in progress)
- [ ] Token infrastructure + capture route bearer auth
- [ ] WXT extension scaffold, popup, and capture flow
- [ ] SPA navigation handling and build pipeline finalization

### Document storage (Phase 12, shipped)
- [x] `Document` entity wired up
- [x] Upload UI on Application detail — accept resume PDF/DOCX, cover letter, JD PDF, take-home submission
- [x] Local file storage under `data/documents/`
- [x] Download/delete endpoints with auth checks
- [x] Upload validation by size, extension, and magic bytes
- [ ] Storage quota soft-warning at 1GB used

### Recruiter entity UI (Phase 14, planned)
- [ ] `Recruiter` and `ApplicationRecruiter` join table wired up (already in schema)
- [ ] `/recruiters` list page
- [ ] `/recruiters/[id]` detail page — shows all linked Applications
- [ ] Add/link recruiter to Application from detail view
- [ ] Recruiter contact field on Application form (autocomplete creates Recruiter inline)
- [ ] Email auto-link: when an Email arrives from a known recruiter's email address, link both to Recruiter and Application

### Google Calendar integration (Phase 16, planned)
- [ ] OAuth scope additions (`calendar.events` + `calendar.events.readonly`) — re-authentication required (clear notice in settings)
- [ ] When a Stage is created with `scheduledAt`, offer to create a Google Calendar event
- [ ] Two-way sync: cron-poll the Calendar for declined/rescheduled events; update Stage accordingly
- [ ] Conflict resolution: foray is source of truth for the `scheduledAt` field; Calendar reflects what foray says

### Analytics dashboard (Phase 15, planned)
- [ ] `/analytics` page with sections:
  - Applications per week (line chart)
  - Funnel: applied → screening → interviewing → offer (bar chart with drop-off rates)
  - Time-in-stage distribution (histogram per stage)
  - Response rate by source (linkedin / direct / referral / recruiter)
  - Median time-to-first-response by company size / industry
  - Median time-to-rejection
- [ ] All charts respect filters: date range, tags, source, company industry
- [ ] Export CSV button for raw data

### Follow-up reminders (Phase 11, shipped)
- [x] Per-application "remind me to follow up" affordance — sets a `followUpAt` field
- [x] Cron infrastructure checks reminders every 15 minutes; Today dashboard queries overdue follow-ups
- [x] Overdue follow-ups surface on Today dashboard
- [ ] Smart suggestions: "5 days since recruiter call with X, no follow-up logged — ping them?"
- [ ] Optional native browser notification when reminders fire

### Polish
- [ ] Dark mode (Tailwind `dark:` variants applied throughout)
- [ ] Print stylesheet for application detail (in case owner wants offline reference)
- [ ] Backup/export: button on settings → downloads ZIP of `pg_dump` + uploaded documents
- [ ] Restore-from-backup wizard (defensive — don't auto-clobber)

---

## Acceptance criteria

1. Chrome extension loads as unpacked; clicking on a LinkedIn job post pre-fills the popup with role, company, JD, location with ≥90% accuracy
2. Document upload completes in <2s for files ≤5MB; download works with auth check
3. Recruiter detail page shows all linked Applications with their canonicalStatus
4. Creating a Stage with `scheduledAt = tomorrow 14:00` produces a corresponding Google Calendar event within 60s; declining the calendar event updates the Stage
5. Analytics dashboard loads in <1s with realistic data (~100 applications); funnel drop-off rates match raw data
6. Follow-up reminder set on Application X surfaces on Today dashboard on the trigger date
7. Backup ZIP can be restored on a fresh foray instance and produces an identical state
8. Owner self-reports that foray covers their full job-hunt workflow with no spreadsheet or Notion fallback for ≥2 weeks

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Chrome Web Store submission required for extension | NOT publishing to store; owner uses "Load unpacked" mode locally — same as Lean/Standard's local-only ethos |
| Google Calendar OAuth re-verification | Adding scopes triggers re-consent; document clearly + minimize scope additions |
| Calendar sync infinite loops (foray → calendar → foray) | Idempotent: check if event already exists before create; skip self-originated webhook updates |
| Analytics queries slow on growing data | Materialized views or per-day aggregations for funnels; benchmark before merge |
| Document storage fills disk | 1GB soft-warning + per-document size cap (10MB); cleanup tooling for old versions |
| Reminder fatigue | Cap suggestions at 3 per day; let user dismiss patterns ("don't suggest follow-ups for company X") |

---

## Triggers to skip Full entirely

This is a real possibility, not a failure mode. After Standard, evaluate:

- Has the bookmarklet been "good enough" for ≥3 weeks of real use? → Skip native extension.
- Has Google Calendar been used as the source of truth (interviews still go in Calendar manually)? → Skip Calendar sync.
- Have document attachments been needed in foray, or is "link to Drive" in notes sufficient? → Skip document storage.
- Has analytics insight changed any decision the owner made? → Skip analytics.

If 3+ Full features fail this test, declare Standard the actual v1 and freeze. That's a successful outcome, not a regression.
