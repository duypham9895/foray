# Milestones

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
