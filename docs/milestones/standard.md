# Milestone: Standard

> **Goal**: zero-friction capture from any job page + a daily-check landing dashboard. The "ritual" is well-supported.

**Estimated effort**: ~1.5-2 weeks
**Status**: ⏳ Pending Lean
**Prerequisites**: Lean milestone complete

---

## In scope

### Bookmarklet
- [ ] `bookmarklet/foray.js` source — single-file JS that, when invoked on any page, captures `document.title`, `window.location.href`, selected text (if any), and POSTs to `localhost:3000/api/capture`
- [ ] Build step that minifies + URL-encodes the bookmarklet into `javascript:...` form
- [ ] Settings page section showing the bookmarklet as a draggable link with install instructions
- [ ] `/api/capture` endpoint accepts payload from bookmarklet (CORS allows any origin), opens a confirmation modal in a new tab at `/applications/new?prefilled=true` with parsed fields

### Today dashboard
- [ ] `/` (root) becomes the Today view (Lean had list as default)
- [ ] Sections in priority order:
  1. **Today's interviews** — Stages with `scheduledAt` matching today
  2. **Action needed** — review queue items, stale forays (>7 days no activity)
  3. **Recent activity** — last 24h of Events across all forays
  4. **This week** — counts by canonicalStatus + week-over-week deltas
- [ ] Empty states for each section (per [DESIGN.md](../../DESIGN.md))

### Tags + search
- [ ] Tags field on Application (already in schema; UI surface this milestone)
- [ ] Tag autocomplete in form
- [ ] `/applications?tag=remote` filter
- [ ] Global search bar (header) — searches across Application.roleTitle, Company.name, Application.notes, Stage.name, Email.subject, Email.bodyExcerpt
- [ ] Search results page at `/search?q=...` grouped by entity type

### UX improvements
- [ ] Keyboard shortcuts: `n` (new application), `/` (focus search), `g a` (go to applications), `g i` (go to inbox), `g s` (go to settings)
- [ ] Toast notifications for auto-classifications with prominent undo button (10s linger)
- [ ] Stale-foray indicator on application cards (subtle "stale" badge after 7 days)

### E2E tests
- [ ] Playwright set up
- [ ] E2E suite covers: capture flow (bookmarklet → confirm modal → save), Today dashboard rendering, search, tag filter, status change with undo

---

## Out of scope (deferred to Full)

- Native Chrome MV3 extension (bookmarklet covers ~90% of use)
- Document storage
- Recruiter entity UI
- Calendar integration
- Analytics dashboard
- Follow-up reminders

---

## Acceptance criteria

1. Bookmarklet installs in <30s from settings page; clicking it on a LinkedIn / Greenhouse / company careers page opens the prefilled new-application modal in a new tab
2. Today dashboard loads in <500ms with realistic data (~50 applications, ~200 emails)
3. Global search returns relevant results across all entity types in <300ms (cold)
4. Keyboard shortcut `n` opens new-application form from anywhere in the app
5. Stale forays (lastActivityAt > 7 days ago) are visibly tagged on application cards
6. Auto-classification toasts appear with working undo, undoing within 10s correctly reverts status + writes a `status_undone` event
7. Playwright E2E suite has ≥10 specs, all passing locally and reproducibly in Docker
8. Owner self-reports using the Today view as their morning ritual for ≥5 consecutive working days

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Bookmarklet breaks across job sites' CSP | Use simple title+URL capture (no DOM scraping); fail gracefully — open modal with whatever was capturable, let user paste JD manually |
| Search query latency at scale | Postgres full-text indexes on Application + Email; benchmark with 1000+ records before declaring done |
| Today dashboard becomes a "second inbox" of noise | Strict empty states — empty section just shows "Nothing here", not a placeholder; review queue capped at 10 visible items |
| Keyboard shortcuts conflict with browser defaults | Avoid `Cmd+K` (most browsers); use letter shortcuts on body only when not in an input field |
