# Roadmap: foray

**Created:** 2026-05-09
**Last Updated:** 2026-05-10

---

## Milestones

- ✅ **v0.1 Lean** — Phases 1-5 (shipped 2026-05-09)
- ⏳ **v0.2 Standard** — Phases 6-10 (zero-friction capture + daily check-in)

---

## Core Value

Zero-friction job capture from anywhere (bookmarklet, extension) + a daily check-in experience that surfaces what matters today.

---

## Phases

- [x] **Phase 1: Foundation + Auth** — Multi-tenant safety net (RLS + withRls), real auth (iron-session), slice-isolation exception
- [x] **Phase 2: Applications Slice** — Usable manual tracker (capture → list → detail → status → stages)
- [x] **Phase 3: Classifier + Matcher** — Trust-trio core (rules-first + LLM fallback, three-strategy matcher)
- [x] **Phase 4: Gmail Ingestion + Pipeline** — Gmail OAuth + polling + auto-update + in-process cron
- [x] **Phase 5: Review Queue + Acceptance** — /inbox triage UI, CI checks, category coverage, acceptance criteria
- [ ] **Phase 6: Bookmarklet + Capture API** — One-click job capture from any webpage with prefilled form
- [ ] **Phase 7: Today Dashboard** — Daily check-in view: today's interviews, stale forays, unreviewed emails, week summary
- [ ] **Phase 8: Tags + Search** — User-defined tags, full-text search, advanced filtering across applications
- [ ] **Phase 9: UX Polish + Keyboard Shortcuts** — Keyboard navigation, animations, responsive refinements, accessibility
- [x] **Phase 10: E2E Tests + Acceptance** — Playwright E2E tests, Standard milestone acceptance criteria verification (completed 2026-05-10)

---

## Phase Details

### Phase 6: Bookmarklet + Capture API

**Goal**: One-click job capture from any webpage — bookmarklet extracts page info, POSTs to `/api/capture`, redirects to prefilled form.

**Depends on**: Phase 5 (Lean complete)

**Requirements**: BOOK-01, CAPT-02, CAPT-03, BOOK-02, BLOCK-01

**Success Criteria**:
  1. Bookmarklet source in `bookmarklet/foray.js` exists and exports capturePageInfo()
  2. Build step minifies + URL-encodes into `javascript:...` form
  3. `/api/capture` endpoint accepts POST, validates, returns redirectUrl
  4. Form rejects ATS domains client-side and server-side
  5. All pre-commit checks pass

**Plans**: 06-01-PLAN.md, 06-02-PLAN.md, 06-03-PLAN.md

### Phase 7: Today Dashboard

**Goal**: Daily check-in view that shows today's interviews, stale forays, unreviewed emails, and week summary — the default landing page.

**Depends on**: Phase 6

**Requirements**: TODAY-01, TODAY-02, TODAY-03, TODAY-04

**Success Criteria**:
  1. `/` (root) redirects to `/today` for authenticated users
  2. Today view shows: upcoming interviews (from stages with dates), stale forays (>7 days no movement), unreviewed email count, week summary stats
  3. Each section is clickable → navigates to relevant detail/filter
  4. Responsive layout works on mobile and desktop

**Plans**: 07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md

### Phase 8: Tags + Search

**Goal**: User-defined tags on applications + full-text search across company names, roles, notes, and tags.

**Depends on**: Phase 7

**Requirements**: TAG-01, TAG-02, TAG-03, SRCH-01, SRCH-02

**Success Criteria**:
  1. Users can add/remove tags on applications (inline, no page reload)
  2. Tags are filterable in the applications list
  3. Search bar searches across company, role title, notes, and tags
  4. Search results highlight matching text
  5. Tag management (rename, delete, merge) available in settings

**Plans**: 08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md

### Phase 9: UX Polish + Keyboard Shortcuts

**Goal**: Keyboard-driven navigation, smooth animations, responsive refinements, and accessibility improvements.

**Depends on**: Phase 8

**Requirements**: KBD-01, KBD-02, ANIM-01, A11Y-01, RESP-01

**Success Criteria**:
  1. Global keyboard shortcuts: `n` (new application), `/` (search), `j/k` (navigate list), `Enter` (open detail)
  2. Focus management follows WAI-ARIA patterns
  3. Page transitions have smooth animations (not jarring)
  4. All interactive elements have visible focus states
  5. Mobile layout is fully functional (no broken layouts)

**Plans**: 09-01-PLAN.md, 09-02-PLAN.md, 09-03-PLAN.md

### Phase 10: E2E Tests + Acceptance

**Goal**: Playwright E2E tests covering critical user flows + Standard milestone acceptance criteria verification.

**Depends on**: Phase 9

**Requirements**: E2E-01, E2E-02, ACCEPT-01

**Success Criteria**:
  1. E2E tests cover: login, capture via bookmarklet flow, application CRUD, search + filter, today dashboard
  2. Tests run in CI (GitHub Actions)
  3. All Standard milestone acceptance criteria verified
  4. No regressions in Lean milestone features

**Plans**: 10-01-PLAN.md, 10-02-PLAN.md, 10-03-PLAN.md

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Auth | v0.1 | 4/4 | ✅ Complete | 2026-05-09 |
| 2. Applications Slice | v0.1 | 5/5 | ✅ Complete | 2026-05-09 |
| 3. Classifier + Matcher | v0.1 | 5/5 | ✅ Complete | 2026-05-09 |
| 4. Gmail Ingestion + Pipeline | v0.1 | 5/5 | ✅ Complete | 2026-05-09 |
| 5. Review Queue + Acceptance | v0.1 | 3/3 | ✅ Complete | 2026-05-09 |
| 6. Bookmarklet + Capture API | v0.2 | 0/3 | ⏳ Pending | — |
| 7. Today Dashboard | v0.2 | 0/3 | ⏳ Pending | — |
| 8. Tags + Search | v0.2 | 0/3 | ⏳ Pending | — |
| 9. UX Polish + Keyboard Shortcuts | v0.2 | 0/3 | ⏳ Pending | — |
| 10. E2E Tests + Acceptance | v0.2 | 3/3 | Complete    | 2026-05-10 |

## Archive

Full v0.1 milestone details archived to `.planning/milestones/v0.1-ROADMAP.md`
