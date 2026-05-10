# Milestones

## v0.2 Standard (Shipped: 2026-05-10)

**Phases completed:** 5 phases, 15 plans, 50 tasks

**Key accomplishments:**

- IIFE bookmarklet that captures page title/URL/selection, with esbuild minification pipeline producing 861-char javascript:... URL
- POST /api/capture route handler with CORS, ATS domain rejection, base64url prefill encoding, and form auto-population
- Bookmarklet build pipeline with esbuild minification and draggable install link on settings page
- Seven Prisma query functions feeding the Today dashboard — stale forays, interviews, review queue, recent activity, pipeline counts, and week-over-week deltas
- Reusable TodaySection, CountBadge, and StaleIndicator components for the today dashboard UI
- Root page redirects to /today dashboard; two missing query functions added with 371 passing tests
- Tag system with autocomplete input, tag cloud with counts, filter API endpoint, and tag editing on application detail
- Full-text search across applications, emails, and stages with GIN indexes and /search page
- Global "/" keyboard shortcut to focus search bar with integration test coverage for shortcut and submit behavior
- Centralized keyboard shortcut system with vim-style g-prefix combos (n, g+a, g+i, g+s) mounted globally via client provider, with settings documentation
- StaleIndicator badges on application cards (7d threshold) and UndoToast component with 10-second countdown for auto-update undo
- One-time shortcut hint toast on first visit plus i18n translations for keyboard shortcuts section
- Playwright E2E test runner with chromium project, authenticated page fixture, and DB reset via TRUNCATE CASCADE
- 31 Playwright E2E test cases across 4 spec files covering capture flow, dashboard, search/filter, and keyboard shortcuts
- Docker-based E2E test infrastructure with GitHub Actions CI, tmpfs Postgres, and Playwright artifact uploads

---

## v0.1 — Lean

**Shipped:** 2026-05-09
**Phases:** 5 | **Plans:** 22 | **Tests:** 314 passing

### What Was Built

1. **Foundation + Auth** — Multi-tenant RLS, iron-session auth, withRls helper, branded IDs
2. **Applications Slice** — Manual tracker: capture → list → detail → status → stages → notes
3. **Classifier + Matcher** — Rules-first + LLM fallback with per-label thresholds, 3-strategy matcher with ATS-domain block
4. **Gmail Ingestion + Pipeline** — OAuth2 flow, 4-stage pipeline (ingest → match → classify → act), 15-minute cron with 4 guards
5. **Review Queue + Acceptance** — /inbox triage UI, structural CI checks, category-based test coverage

### Key Accomplishments

- 31/31 v1 requirements satisfied
- 5 E2E flows verified (login, capture, Gmail sync, auto-update, review triage)
- 14 cross-phase exports properly wired
- Zero broken flows, zero unprotected sensitive areas
- Structural CI check verifies all 14 Server Actions return safe types

### Tech Debt (Non-Blocking)

- Phase 4: OAuth CSRF risk, advisory lock collision risk at ~77k emails
- Phase 5: Missing Zod validation on server actions, silent failure handling
- 6 human verification items deferred (requires live app + browser)

### Archive

- `.planning/milestones/v0.1-ROADMAP.md`
- `.planning/milestones/v0.1-REQUIREMENTS.md`
- `.planning/milestones/v0.1-MILESTONE-AUDIT.md`
