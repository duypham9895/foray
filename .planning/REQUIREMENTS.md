# Requirements: foray (Lean milestone v0.1)

**Defined:** 2026-05-09
**Core Value:** One screen tells the owner what's actually happening today — without manual spreadsheet maintenance and without LLM hallucination changing the record without consent.

## v1 Requirements

Lean milestone (v0.1) — single-week scope, deliver a usable foray.

### Capture

- [ ] **CAPT-01**: Owner can manually create a new Application via `/applications/new` form (company autocomplete or new, role title, role URL, JD paste, location, salary range, source, applied date) in <30 seconds
- [ ] **CAPT-02**: Form validation via Zod runs on both client and server with parsed/branded types; ATS domains (Greenhouse, Lever, Workday, LinkedIn, Ashby, etc.) are rejected for `Company.domain` per Pitfalls #5
- [ ] **CAPT-03**: Submission creates `Application` + `Event(type='created')` in one transaction

### Gmail Ingestion

- [ ] **GMAIL-01**: Owner completes Google OAuth flow (test mode, single user) at `/api/gmail/auth` and `/api/gmail/callback`; refresh token stored encrypted (AES-256-GCM, per-row IV) on User row
- [ ] **GMAIL-02**: `/settings` page shows connection state with "Connect Gmail" / "Disconnect" / "Sync now" actions AND a token-health banner (warns ≥5 days since last successful sync; explains 7-day Test-mode revocation)
- [ ] **GMAIL-03**: Polling endpoint `/api/gmail/poll` fetches threads modified since `User.gmailLastSyncAt` and persists Email metadata + ≤500 char body excerpt; falls back to `messages.list` if `history.list` returns 404 (history exhausted)
- [ ] **GMAIL-04**: In-process `node-cron` in `src/instrumentation.ts` fires polling every 15 minutes while app is running, guarded by `globalThis.__forayCron` (hot-reload safety) + `pg_try_advisory_lock('poll-gmail')` (multi-instance safety) + `NEXT_RUNTIME` check (Node-only, not Edge)

### Classifier

- [ ] **CLASS-01**: Rules-first classifier in `src/features/classifier/service.ts` recognizes `rejection`, `interview_invite`, `recruiter_outreach`, `noise`, `unmatched` with regex patterns externalized in `rules.ts` (one file per pattern, importable into tests)
- [ ] **CLASS-02**: LLM fallback (Claude Haiku) handles low-confidence rule cases; SDK call wrapped in `Result<…, AppError>`, `timeout: 15_000`, `maxRetries: 0` (per-tick budget guard handles retry logic)
- [ ] **CLASS-03**: Returns `{ label, confidence, classifiedBy: 'rules' | 'llm' }`; per-label thresholds (asymmetric — `rejection` higher than `interview_invite` per Pitfalls #4) sourced from typed config, not single env var
- [ ] **CLASS-04**: All Anthropic calls logged to `data/classifier-log.jsonl` with token counts; pre-call budget guard blocks LLM call if daily total >$0.50 (control, not just alerting); idempotency check on `email.classifiedBy` prevents re-classification

### Matcher

- [ ] **MATCH-01**: Email→Application matcher in `src/features/matcher/service.ts` returns `Result<{ applicationId: ApplicationId | null }, AppError>`
- [ ] **MATCH-02**: Tiebreak order: thread continuity (`gmailThreadId` linked) → sender domain match against `Company.domain` (skipping ATS domains per CAPT-02) → unmatched
- [ ] **MATCH-03**: All Prisma access via `tenantDb(userId)` — zero direct `prisma.*` imports outside `src/core/db/` (verified by ESLint `no-direct-prisma` rule)

### Auto-Update + Review Queue Routing

- [ ] **AUTO-01**: confidence ≥ per-label threshold AND application matched AND not a status regression (e.g., `interviewing → rejected` requires human confirmation per Pitfalls #4) → update `Application.canonicalStatus`, write `Event(type='auto_status_changed', undoable=true)`
- [ ] **AUTO-02**: confidence < threshold OR unmatched OR status regression → surface in `/inbox` review queue (no auto-apply)
- [ ] **AUTO-03**: First 50 emails after Gmail connect bypass auto-update and go to review queue regardless (build user-corrected ground truth)
- [ ] **AUTO-04**: Auto-applied changes show prominent undo (toast ~10s + permanent in event timeline); undo writes `email.reviewedByUser=true` to prevent next cron tick from re-acting (idempotency per Pitfalls #8); per-email `pg_try_advisory_lock` for act-stage serialization

### Review Queue

- [ ] **REVIEW-01**: `/inbox` page shows low-confidence + unmatched emails (subject, from, body excerpt, suggested classification + confidence, suggested application)
- [ ] **REVIEW-02**: Per-row actions: confirm classification, override classification, link to existing Application, ignore (mark `reviewedByUser=true`); rate-limit on per-user-per-second full-body fetch endpoint

### Application Views

- [ ] **APP-01**: `/applications` list — table view filterable by `canonicalStatus` (default excludes `rejected` + `withdrawn`), sortable by `appliedAt` / `lastActivityAt`, count per status
- [ ] **APP-02**: `/applications/[id]` detail — chronological timeline (Stages + Events + Emails), edit affordances; auto-update Events styled distinctly per DESIGN.md (different from manual edits)
- [ ] **APP-03**: Quick `canonicalStatus` change dropdown in detail view
- [ ] **APP-04**: Add/edit/complete Stages inline; free-form notes field; every status change, linked email, and note edit updates `lastActivityAt`

### Auth

- [ ] **AUTH-01**: `src/core/auth/session.ts` `requireUser()` wired to real cookie/session check via `iron-session` (HMAC-encrypted cookie over `APP_PASSWORD`-derived secret)
- [ ] **AUTH-02**: `/login` page with single password field; sets `foray_session` cookie on success
- [ ] **AUTH-03**: Middleware redirects unauthenticated requests to `/login` (defense-in-depth; real auth check stays in `requireUser()` per PRINCIPLES.md §"Security baseline")

### Foundational Hardening

- [ ] **FND-01**: Extend `tenantDb` with all CRUD methods needed by Lean slices (currently only `application.findMany/findUnique/findFirst/count` are wrapped); add `withRls(userId, tx => …)` helper for atomic multi-statement work
- [ ] **FND-02**: Add Postgres RLS policies in a migration with `FORCE ROW LEVEL SECURITY` (one policy per tenant-scoped table); non-superuser `foray_app` DB role for app + tests; `withRls` sets `app.user_id` per transaction
- [ ] **FND-03**: Test coverage by **category** (per Pitfalls #12 — replaces gameable "≥30 tests" count): (a) tenant isolation per scoped model — RLS escape attempt suite using a foreign user_id; (b) classifier per label — at least one fixture per `rejection / interview_invite / recruiter_outreach / noise / unmatched`; (c) matcher per tiebreak path — thread-continuity, sender-domain match, ATS-domain skip, unmatched fallback; (d) undo race — concurrent classify-and-act vs undo; (e) runaway loop — budget guard blocks 51st call; (f) env validation — every required `env.*` field rejects missing/malformed input
- [ ] **FND-04**: Pre-commit gate green: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` (no `--no-verify` exceptions); structural CI check: `relforcerowsecurity = true` query in test setup; Server-Action-returns-`Result` lint or grep

## v2 Requirements

Deferred to Standard milestone (next).

### Standard milestone capabilities (per `docs/milestones/standard.md`)

- **STD-CAPTURE-01**: Bookmarklet for one-click capture from any job page
- **STD-DASH-01**: "Today" dashboard (today's interviews, stale forays, week summary)
- **STD-SEARCH-01**: Tags + cross-record search

## Out of Scope

Explicitly excluded from Lean. Re-evaluated after Lean ships per the milestone spec.

| Feature | Reason |
|---------|--------|
| Native Chrome MV3 extension | Full milestone — bookmarklet + manual form cover Lean trust validation |
| Document upload / storage | Full milestone — resume PDFs live in Drive for Lean |
| Recruiter entity UI | Full milestone — recruiter is a free-text field in Lean |
| Google Calendar sync | Full milestone — calendar invites stay in Gmail/Calendar manually |
| Analytics view | Full milestone — no funnel/cohort metrics until owner has ≥30 forays |
| Follow-up reminders | Full milestone — `lastActivityAt` sort serves manual nudge for now |
| Tags + cross-record search | Standard milestone — `canonicalStatus` filter is enough for Lean |
| Multi-user / SaaS deployment | Multi-tenant patterns baked in (tenantDb, branded IDs, RLS) but only single-user ships |
| Auto-apply to job postings | Anti-feature per ADR-0001 — owner trust requires manual capture as foundation |
| AI resume tailoring | Anti-feature — out of scope for tracking; owner's existing tools suffice |
| Real-time browser notifications | Anti-feature for Lean — defer to Full milestone follow-up reminders |
| OAuth login (vs single-password) | Lean is single-user; iron-session HMAC cookie is the smallest correct thing |
| Mobile app | Web-responsive only; mobile would force premature SaaS posture |
| Cloud-hosted Postgres | ADR-0003 (local-first) — Docker Postgres until SaaS pivot |
| Pub/Sub Gmail push notifications | Local-first incompatible with public HTTPS endpoint requirement |
| Single global `CLASSIFIER_AUTO_THRESHOLD` env var | Replaced by per-label asymmetric thresholds (CLASS-03) |
| Re-classification of already-processed emails | Idempotency check (CLASS-04) prevents wasted spend + duplicate Events |

## Traceability

Empty until roadmap is created. `gsd-roadmapper` populates this table mapping each REQ-ID to its phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmapper) | | |

**Coverage:**
- v1 requirements: **30 total**
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 30 ⚠️ (will resolve when roadmap commits)

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 after research synthesis (FND-03 re-specced from count to category coverage)*
