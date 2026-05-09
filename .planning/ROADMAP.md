# Roadmap: foray Lean milestone (v0.1)

**Created:** 2026-05-09
**Granularity:** coarse (5 phases)
**Coverage:** 31/31 v1 requirements mapped
**Source synthesis:** `.planning/research/SUMMARY.md` (HIGH confidence — 4-dimension parallel research)

---

## Core Value

One screen tells the owner what's actually happening today — what's stale, what got rejected silently, what needs a follow-up — without manual spreadsheet maintenance and without LLM hallucination changing the record without consent.

## Phases

- [ ] **Phase 1: Foundation + Auth** — Lock the multi-tenant safety net (RLS + `withRls`), wire real auth (iron-session), enable the slice-isolation exception
- [ ] **Phase 2: Applications Slice** — Ship a usable manual tracker (capture → list → detail → status → stages); independently shippable checkpoint
- [ ] **Phase 3: Classifier + Matcher** — Build the trust-trio core (rules-first + LLM fallback with per-label thresholds, three-strategy matcher with ATS-domain block)
- [ ] **Phase 4: Gmail Ingestion + Pipeline** — Connect Gmail (OAuth + encrypted refresh token + token-health banner), wire `pollOnce` orchestrator, auto-update with first-50 grace + status-regression block + undo idempotency, in-process cron with hot-reload guard
- [ ] **Phase 5: Review Queue + Acceptance** — Ship `/inbox` triage UI with degradation banner, structural CI checks, category-based test coverage, verify all 12 Lean acceptance criteria

---

## Phase Details

### Phase 1: Foundation + Auth

**Goal**: Multi-tenant safety net is real (RLS active, type-checked, escape-tested) and the auth boundary is wired so every later slice writes through verified-safe primitives.

**Depends on**: Nothing (foundation phase — builds atop v0.1.0 scaffold)

**Requirements**: FND-01, FND-02, AUTH-01, AUTH-02, AUTH-03

**Success Criteria** (what must be TRUE):
  1. Owner can log in via `/login` with the single password and is redirected to `/applications`; unauthenticated browser navigation to any protected route lands at `/login`
  2. `requireUser()` reads the iron-session HMAC cookie and returns `Result<{id: UserId}, Unauthorized>`; every Server Action and Route Handler in later phases can call it directly
  3. `tenantDb(userId)` exposes wrapped CRUD methods for `application`, `email`, `event`, `company`, `stage`; `withRls(userId, tx => …)` helper opens a Prisma `$transaction` with `set_config('app.user_id', …, true)` as the first statement
  4. RLS policies are active (`relrowsecurity = true` AND `relforcerowsecurity = true`) on every tenant-scoped table; the test DB connection uses a non-superuser `foray_app` role and an escape-attempt query (`SELECT * FROM applications WHERE user_id = <other>`) returns zero rows
  5. ADR-0011 candidate ("RLS via `withRls()` helper, not Prisma client extension, until SaaS flip") is committed to `docs/decisions/`

**Plans**: 4 plans
- [x] 01-01-PLAN.md — Foundation primitives (env + crypto + withRls + dep-cruiser exception) [Wave 1]
- [x] 01-02-PLAN.md — Auth slice (iron-session + login page + Server Action + middleware) [Wave 1]
- [x] 01-03-PLAN.md — RLS migration + tenantDb mutation matrix + Testcontainers + escape tests [Wave 2]
- [x] 01-04-PLAN.md — ADR-0011 + PROJECT.md doc fix + FND-04 sentinel pre-commit gate [Wave 2]

**UI hint**: yes

---

### Phase 2: Applications Slice (Manual Tracker)

**Goal**: foray is a usable manual tracker — owner can capture a foray in <30 seconds, see all forays in a list, drill into a foray's full timeline, change status, edit stages and notes.

**Depends on**: Phase 1 (needs `requireUser()` + `tenantDb` + `withRls`)

**Requirements**: CAPT-01, CAPT-02, CAPT-03, APP-01, APP-02, APP-03, APP-04

**Success Criteria** (what must be TRUE):
  1. Owner can submit `/applications/new` form (company autocomplete-or-new, role title, role URL, JD paste, location, salary range, source, applied date) in under 30 seconds; ATS domains (Greenhouse, Lever, Workday, LinkedIn, Ashby, etc.) are rejected client- and server-side for `Company.domain` with a helpful error
  2. Submission creates one `Application` row + one `Event(type='created', source='manual')` in a single `withRls` transaction
  3. `/applications` list view filters by `canonicalStatus` (default excludes `rejected` + `withdrawn`), is sortable by `appliedAt` / `lastActivityAt`, and shows a count badge per status (including hidden archived count)
  4. `/applications/[id]` renders a chronological timeline merging Stages + Events + Emails; status dropdown writes a new Event and updates `lastActivityAt`; Stages and notes are editable inline; auto-update Events are visually distinct (per DESIGN.md) — distinguishable from manual edits at a glance
  5. `applyAutoStatusChange` and `undoStatusChange` services exist as `Result`-returning functions in `applications/service.ts`, ready for Phase 4 to call; `Event.data` is parsed via Zod schema per `EventType` on read

**Plans**: 5 plans
- [ ] 02-01-PLAN.md — Foundation: ATS-domain helper + Zod schemas (application, company, stage, notes, per-EventType data) [Wave 1]
- [ ] 02-02-PLAN.md — Service layer: createApplication + manual/auto/undo status changes + queries (status-transitions helper, regression block) [Wave 2]
- [ ] 02-03-PLAN.md — Stages + notes services + cross-tenant RLS isolation tests (closes Phase 1 it.todos) [Wave 3]
- [ ] 02-04-PLAN.md — UI: shadcn primitives, 6 Server Actions, 7 components, 3 pages, browser-verify checkpoint [Wave 4]
- [ ] 02-05-PLAN.md — Close-out: ADR-0012 (regression block + auto-update visual treatment) + UAT walkthrough [Wave 5]
**UI hint**: yes

---

### Phase 3: Classifier + Matcher

**Goal**: Pure-ish slices that turn an email into a labeled, matched, cost-bounded decision — without ever touching Gmail or writing to an Application. Designed in one pass so the trust-trio (per-label thresholds + budget guard + ATS-domain skip) is coherent before Phase 4 wires it into the live pipeline.

**Depends on**: Phase 1 (env, errors, branded IDs); Phase 2 (Application + Company tables exist with seedable data for matcher fixtures)

**Requirements**: CLASS-01, CLASS-02, CLASS-03, CLASS-04, MATCH-01, MATCH-02, MATCH-03

**Success Criteria** (what must be TRUE):
  1. `classifier/service.classifyEmail({subject, bodyExcerpt})` returns `Result<{label, confidence, classifiedBy}, AppError>` where label ∈ `{rejection, interview_invite, recruiter_outreach, noise, unmatched}`; rules-first via `rules.ts` regex table; LLM fallback (Claude Haiku, `timeout: 15_000`, `maxRetries: 0`, structured tool output) wrapped in `Result` only on rules-low-confidence
  2. Per-label asymmetric thresholds live in typed config (recommend `rejection ≥ 0.92`, `interview_invite ≥ 0.85`, `noise` aggressive); a single `CLASSIFIER_AUTO_THRESHOLD` env var is NOT the gate
  3. Pre-call budget guard reads today's running classifier-log cost and returns `err({_tag: 'RateLimited', …})` when ≥ `$0.50/day` — control, not monitoring; idempotency check on `email.classifiedBy` refuses to re-classify; per-batch hard cap of 50 emails
  4. `matcher/service.matchEmail({userId, gmailThreadId, fromDomain})` returns `Result<{applicationId: ApplicationId | null}, AppError>` via tiebreak: thread continuity → `Company.domain` exact match (skipping ATS domains) → unmatched; zero direct `prisma.*` access (all via `tenantDb` / `withRls`, ESLint-verified)
  5. Classifier-fixtures suite (`tests/integration/classifier-fixtures/`) contains ≥1 real email per label and ≥1 real Greenhouse/Lever/Workday sample; matcher tests cover all four tiebreak paths (thread / domain / ATS-blocked / unmatched); ADR-0012 candidate ("Asymmetric per-label thresholds + status-regression block") is committed

**Plans**: TBD

---

### Phase 4: Gmail Ingestion + Pipeline + Cron

**Goal**: Connecting Gmail, ingesting threads, running the four-stage pipeline (`ingest → match → classify → act`), and scheduling it every 15 minutes — all with the trust safety nets (first-50 grace, status-regression block, undo race fix) wired in. This is the only legitimate cross-slice composition (`inbox/` imports `matcher/` + `classifier/`).

**Depends on**: Phase 1 (env, withRls, encryption key); Phase 2 (Application + Event services for the `act` stage); Phase 3 (matcher + classifier services for `match` and `classify` stages)

**Requirements**: GMAIL-01, GMAIL-02, GMAIL-03, GMAIL-04, AUTO-01, AUTO-02, AUTO-03, AUTO-04

**Success Criteria** (what must be TRUE):
  1. Owner completes Google OAuth (test mode, single user) at `/api/gmail/auth` → `/api/gmail/callback`; refresh token is stored AES-256-GCM-encrypted with per-row IV on `User.gmailRefreshTokenEncrypted`; `/settings` shows connection state + Connect/Disconnect/Sync-now actions + a token-health banner that warns when last successful sync is ≥5 days old AND explains the 7-day Test-mode revocation
  2. `inbox.pollOnce(userId)` orchestrates the four stages end-to-end: `ingestSinceWatermark` (uses `history.list` watermark, falls back to `messages.list?q=newer_than:7d` on 404) → per-email match → per-email classify → act-or-queue; per-email failures are logged and never abort the batch; ≤500-char `bodyExcerpt` stored
  3. Auto-update fires only when confidence ≥ per-label threshold AND application matched AND NOT a status regression (e.g., `interviewing → rejected` requires human confirmation) AND NOT within the first 50 emails after Gmail connect; otherwise the email lands in `processing_status='needs_review'` for `/inbox`
  4. Auto-applied changes write `Event(type='auto_status_changed', undoable=true)` permanently in the timeline; undo writes `email.reviewedByUser=true` so the next cron tick cannot re-act on the same email; `pg_try_advisory_lock(hashtext('act:'||emailId))` serializes act-stage races
  5. `src/instrumentation.ts` registers a single 15-minute `node-cron` job guarded by `process.env.NEXT_RUNTIME === 'nodejs'` (skip on Edge) + `globalThis.__forayCron?.stop()` (hot-reload safety) + `pg_try_advisory_lock('poll-gmail')` (overlap prevention) + `NODE_ENV !== 'test'` (test-process safety); the cron calls `pollOnce` directly in-process, no HTTP self-call

**Plans**: TBD
**UI hint**: yes

---

### Phase 5: Review Queue + Acceptance

**Goal**: Ship the human-triage surface (`/inbox`), wire structural CI checks that prevent regression of the safety properties, replace the gameable "≥30 tests" target with category coverage, and verify all 12 Lean acceptance criteria from `docs/milestones/lean.md` end-to-end.

**Depends on**: Phase 4 (rows in `processing_status='needs_review'` exist; token-health surface exists)

**Requirements**: REVIEW-01, REVIEW-02, FND-03, FND-04

**Success Criteria** (what must be TRUE):
  1. `/inbox` shows low-confidence + unmatched emails with subject, from, body excerpt, suggested classification + confidence (visualized as 3-bar / low-medium-high, exact number on hover), and suggested application; per-row actions confirm / override / link-to-application / ignore work and write `email.reviewedByUser=true` where appropriate
  2. Full-body fetch endpoint (used by `/inbox` "view full email") is rate-limited to 5 req/sec per user via token bucket; a degradation banner appears in `/inbox` header when token-health check fails ("Gmail disconnected — full bodies unavailable")
  3. Test coverage by category passes (replaces FND-03's count target): (a) tenant isolation per tenant-scoped model via RLS escape-attempt with foreign user_id; (b) classifier ≥1 fixture per label; (c) matcher ≥1 test per tiebreak path; (d) auto-update + undo race; (e) classifier runaway-loop budget guard; (f) env validation per required field
  4. Pre-commit gate green: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` — no `--no-verify` exceptions; structural CI checks pass: `relforcerowsecurity = true` query in test setup, Server-Action-returns-`Result` lint or grep
  5. All 12 Lean acceptance criteria from `docs/milestones/lean.md` verified by manual demo walkthrough: capture form <30s, Sync-now pulls 7-day window, canonical rejection auto-classifies + auto-updates + is undoable from timeline, ambiguous outreach lands in `/inbox` without auto-apply, list shows correct counts per status, detail timeline is chronological, ≥3 real applications logged, ≥1 auto-classification triggered correctly

**Plans**: TBD
**UI hint**: yes

---

## Cross-Cutting Concerns

These designed-once-touched-many concerns need a coherent decision before the relevant phase starts (per `.planning/research/SUMMARY.md`):

| Concern | Designed in | Lands in |
|---|---|---|
| RLS + non-superuser test role + `withRls` helper | Phase 1 plan | Phase 1 build, Phase 5 verification (escape-attempt + structural CI check) |
| OAuth health surfacing (7-day Test-mode revocation) | Phase 4 plan | Phase 4 banner + Phase 5 degradation UX |
| Trust trio (per-label thresholds + status-regression block + undo race fix + visually-distinct events) | Phase 3 plan (must precede Phase 4 build) | Phase 3 thresholds, Phase 4 regression block + undo idempotency, Phase 2 + Phase 5 event styling |
| `inbox-pipeline-exception` dep-cruiser allowlist | Phase 1 plan | Phase 1 configure, Phase 4 use |
| LLM cost as control not monitoring (pre-call guard + idempotency + per-batch cap) | Phase 3 plan | Phase 3 build |

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth | 0/4 | Planned (not started) | - |
| 2. Applications Slice | 0/5 | Planned (not started) | - |
| 3. Classifier + Matcher | 0/0 | Not started | - |
| 4. Gmail Ingestion + Pipeline | 0/0 | Not started | - |
| 5. Review Queue + Acceptance | 0/0 | Not started | - |

`roadmap_complete: false` — phases 2-5 pending decomposition into plans via `/gsd-plan-phase`.

---

## Coverage Validation

**v1 requirements:** 31 total (REQUIREMENTS.md header said 30; actual count is 31 — discrepancy flagged below)

**By phase:**

| Phase | Count | Requirements |
|---|---|---|
| 1. Foundation + Auth | 5 | FND-01, FND-02, AUTH-01, AUTH-02, AUTH-03 |
| 2. Applications Slice | 7 | CAPT-01, CAPT-02, CAPT-03, APP-01, APP-02, APP-03, APP-04 |
| 3. Classifier + Matcher | 7 | CLASS-01, CLASS-02, CLASS-03, CLASS-04, MATCH-01, MATCH-02, MATCH-03 |
| 4. Gmail Ingestion + Pipeline | 8 | GMAIL-01, GMAIL-02, GMAIL-03, GMAIL-04, AUTO-01, AUTO-02, AUTO-03, AUTO-04 |
| 5. Review Queue + Acceptance | 4 | REVIEW-01, REVIEW-02, FND-03, FND-04 |
| **Total** | **31** | — |

**Discrepancy flagged:** REQUIREMENTS.md coverage footer states "v1 requirements: 30 total" but the requirement list contains 31 (CAPT 3 + GMAIL 4 + CLASS 4 + MATCH 3 + AUTO 4 + REVIEW 2 + APP 4 + AUTH 3 + FND 4 = 31). Updating REQUIREMENTS.md traceability table to 31; recommend a one-line fix to the coverage footer in REQUIREMENTS.md to match.

✓ All 31 v1 requirements mapped to exactly one phase
✓ No orphans, no duplicates
✓ Phase ordering respects dependency graph from `.planning/research/ARCHITECTURE.md` "Build order"

---

*Roadmap created: 2026-05-09 by `gsd-roadmapper` from research synthesis (4-dimension parallel research, HIGH confidence)*
*Phase 1 decomposed into 4 plans: 2026-05-09 by `/gsd-plan-phase 1`*
*Phase 2 decomposed into 5 plans: 2026-05-09 by `/gsd-plan-phase 2`*
