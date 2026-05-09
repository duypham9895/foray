# Research Summary — foray Lean Milestone (v0.1)

**Date:** 2026-05-09
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md
**Granularity target:** Coarse (3–5 phases per project config)
**Overall confidence:** HIGH

---

## Executive Summary

foray's Lean milestone is unusually well-defined — stack mostly already installed, architecture locked by ADR-0010, requirement registry closed. The synthesis is therefore **wiring + risk management, not exploration**.

Build the foundation once, ship a usable manual tracker before any automation, then layer the email pipeline as three independently-testable slices that meet only at one orchestrator (`inbox.pollOnce`). The trust model (auto-update at high confidence with permanent undoable events) is both differentiator and largest risk: the first wrong silent change is fatal per `PROJECT.md`.

**Three cross-cutting concerns must be designed up-front:**
1. **OAuth health surfacing** — the test-mode 7-day token expiry will silently kill the product within a week.
2. **Asymmetric per-label classifier thresholds + status-regression block** — single global threshold encodes the wrong assumption that all labels carry equal cost (a false-positive `rejection` on a live interview is catastrophic; false-negative is free).
3. **RLS as a real safety net** — migration must include `FORCE ROW LEVEL SECURITY`, the test role must be non-superuser, `withRls(userId, tx => …)` must wrap every multi-statement tenant op.

---

## Stack — what's locked

- **Baseline already correct.** Every package in `package.json` is at the latest version on npm as of 2026-05-09. No upgrades needed — only additions.
- **Five packages to add:** `node-cron@^4.2.1`, `iron-session@^8.0.4` (HMAC-encrypted sessions, ~30 LOC vs. rolling our own), `msw@^2.14.5` (Gmail/Anthropic mocks), `@testcontainers/postgresql@^11.14.0` (real Postgres for integration tests), `fishery` (test factories).
- **Polling beats Pub/Sub for foray.** Google's own docs recommend polling for installed/personal apps; Pub/Sub also requires a public HTTPS endpoint that local-first (ADR-0003) forbids.
- **AES-256-GCM via Node stdlib** for OAuth refresh token at rest (~30 LOC, per-row IV via `crypto.randomBytes(12)`). NIST SP 800-38D backs the 96-bit IV. No library needed.
- **Doc fix needed:** `.planning/PROJECT.md` says "Next.js 15" — installed and pinned version is `16.2.6`. Surgical edit during Phase 1.

## Features — what's locked

- **foray's distinct slot is empty in the market.** No commercial tracker combines Gmail-driven auto-classification + hybrid trust + permanent undoable timeline + local-first storage. Closest competitor ("Application Tracker for Gmail") auto-labels everything via LLM with no in-app review queue.
- **Manual-update fatigue is the primary abandonment driver** in commercial trackers (Huntr, Teal). Foray's Lean milestone targets this directly via `GMAIL-* + CLASS-* + AUTO-*`. This is *the* differentiator versus a spreadsheet — not the kanban view, not resume tools.
- **`AUTO-03` (first-50 grace period) is unique in the market.** It's the most defensible mitigation for the "first wrong auto-apply destroys trust" risk.
- **No anti-feature snuck into Lean.** All commercially common features foray rejects (auto-apply, AI resume tailoring, autofill, calendar sync, document storage, recruiter UI, tags, analytics, follow-up reminders, multi-user) are correctly absent and have rationale tied to ADRs or PROJECT.md Out-of-Scope.

## Architecture — what's locked

- **VSA per ADR-0010, folder layout fixed.** Pages and route handlers stay ≤5 lines, delegating to slice services.
- **One legitimate slice-isolation exception required:** `inbox/` must import `matcher/service` and `classifier/service` because the four-stage pipeline (`ingest → match → classify → act`) is naturally one orchestrator. Add a single named allow-rule in `.dependency-cruiser.cjs` (`inbox-pipeline-exception`) — narrow, one-direction, two-import — and document in `inbox/README.md`. Everything else stays slice-isolated.
- **`applications/` should NOT be imported by `inbox/`.** Cross-slice writes use `tenantDb` / `withRls` directly to `Application` and `Event`. `applications/service.ts` remains a peer reader; the schema is the contract.
- **RLS via `withRls(userId, tx => …)` helper, NOT a global Prisma `$extends({ query })` extension** for Lean. The `$extends` route doubles round-trips per query, conflicts with existing `tenantDb` tests, and has known interactive-transaction blocking issues (Prisma Issue #23583). Defer the global extension to SaaS flip; capture in **ADR-0011 candidate**.
- **Cron lives in `src/instrumentation.ts`** (Next.js's official server-init hook), guarded by `pg_try_advisory_lock('poll-gmail')` AND `globalThis.__forayCron` to survive hot reloads. Calls `inbox.pollOnce(userId)` directly — same process, no HTTP self-call.

---

## Recommended Phase Breakdown — 5 Phases

> **Why 5, not 11:** The architecture file suggested 11 phases; coarse granularity (per `.planning/config.json`) consolidates related work. The trust trio (classifier + auto-update + review-queue) is split across phases 3–5 by design — per-label thresholds in 3, runaway-loop guard + undo race fix in 4, visually-distinct event styling in 5 — but designed in one pass during Phase 3 planning.

### Phase 1: Foundation Hardening + Auth

- **Builds:** `withRls(userId, tx => …)` helper; RLS migration with `FORCE ROW LEVEL SECURITY`; non-superuser `foray_app` DB role; `tenantDb` extensions (`FND-01`); iron-session cookie wired into `requireUser()` (`AUTH-01..03`); middleware redirect; `.dependency-cruiser.cjs` `inbox-pipeline-exception` allowlist; ESLint rule blocking `from '@prisma/client'`; doc fix (Next.js 15 → 16).
- **Lands ADR-0011 candidate** ("RLS via `withRls()` helper, not Prisma client extension, until SaaS flip").
- **Avoids Pitfalls:** 2, 4, 9, 10.
- **Why first:** Every later slice writes through these. Treating it as cleanup risks shipping Friday with the safety net unverified.

### Phase 2: Applications Slice (Manual Tracker — independently shippable)

- **Builds:** `/applications/new` form (`CAPT-01..03`, <30s); list view (`APP-01`); detail + timeline (`APP-02`); status dropdown (`APP-03`); Stages + notes inline (`APP-04`); `applyAutoStatusChange` + `undoStatusChange` services (used later by Phase 4); ATS-domain Zod rejection in capture form (Pitfall 5 prep); `Event.data` Zod schema per `EventType`.
- **Useful checkpoint to ship even before Gmail.** After this, foray is a usable manual tracker.

### Phase 3: Classifier + Matcher (Pure-ish slices)

- **Builds:** Classifier (`rules.ts` templated phrases over keyword bag; `service.ts` returning `{label, confidence, classifiedBy}` per `CLASS-01..03`; `llm.ts` Claude Haiku with `timeout: 15_000`, `maxRetries: 0`, structured output via tool schema, wrapped in `Result`; `log.ts` per `CLASS-04`); **per-label threshold map** (recommend `rejection ≥ 0.92`, `interview_invite ≥ 0.85`, `noise` aggressive — tune against fixtures); **pre-call budget guard** (control, not monitoring); **idempotency check** on `email.classifiedBy`; per-tick hard cap of 50.
- **Matcher (`MATCH-01..03`)** with three-strategy tiebreak + ATS-domain block (Greenhouse, Lever, Workday, LinkedIn, Ashby, Rippling, etc.).
- **Lands ADR-0012 candidate** ("Asymmetric per-label thresholds + status-regression block") — may be combined with ADR-0011 by team preference.
- **Classifier-fixtures** with real Greenhouse/Lever/Workday samples.
- **Avoids Pitfalls:** 4, 5, 6.

### Phase 4: Gmail Ingestion + Pipeline Orchestration + Cron

- **Builds:** `gmail-client.ts` (token refresh, `history.list` with 404 → full-list fallback); `encryption.ts` (AES-256-GCM stdlib); `/api/gmail/{auth,callback}` (`GMAIL-01`); `/settings` page with **token-health banner** (`GMAIL-02`); `ingestSinceWatermark` (`GMAIL-03`, ≤500 char excerpt); `pollOnce(userId)` orchestrator (the legitimate cross-slice import); auto-update + review-queue routing (`AUTO-01..04`) with **first-50 grace period**, **status-regression block** (e.g., `interviewing → rejected` requires confirmation), **undo writes `email.reviewedByUser=true`** (Pitfall 8 idempotency fix); per-email `pg_try_advisory_lock` for act-stage serialization; `src/instrumentation.ts` cron with `globalThis.__forayCron` hot-reload guard, `NEXT_RUNTIME` check, test-mode disable, advisory lock (`GMAIL-04`).
- **Avoids Pitfalls:** 1, 3, 6, 7, 8.

### Phase 5: Review Queue UI + Hardening + Lean Acceptance

- **Builds:** `/inbox` page (`REVIEW-01..02`); graceful degradation banner on token failure; per-user-per-second rate-limit on full-body fetch endpoint; **structural CI checks** (`relforcerowsecurity = true` query in test setup; Server-Actions-return-`Result` lint or grep); **coverage by category** replacing the `≥30 tests` count (per Pitfall 12 — Lean ship-blocker); default status filter excludes `rejected` + `withdrawn`; auto-update events styled distinctly per DESIGN.md.
- **Verifies:** `FND-03..04`, all 12 acceptance criteria from `PROJECT.md`.

---

## Cross-Cutting Concerns

| Concern | Phases touched | Why it can't be deferred |
|---|---|---|
| RLS implementation + non-superuser test role | 1 (build), 5 (verify) | Migration after data exists means a backfill story; test theater hides the safety-net hole |
| OAuth health surfacing | 4 (build banner), 5 (degradation UX) | Auto-thesis dies in week two without it (7-day Test-mode revocation) |
| Trust trio (classifier + auto-update + review queue) | 3 (per-label thresholds), 4 (status-regression block + undo race fix), 5 (event styling) | First wrong silent change is fatal; design pass needed before any one is built |
| `inbox-pipeline-exception` dep-cruiser allowlist | 1 (configure), 4 (use) | Forgetting it means CI breaks the moment Phase 4 ships |
| LLM cost as control not monitoring | 3 (pre-call guard + idempotency) | Pitfall 6 fires when most needed; runaway loop is exactly when budget guard matters |

---

## Research Flags (per-phase deeper research candidates)

- **Phase 1 — `/gsd-research-phase` candidate:** RLS migration patterns under Prisma 7, pgTAP-style escape tests, non-superuser role + grant matrix. Architecture file flags this as "non-trivially harder than the one-paragraph version in PRINCIPLES.md."
- **Phase 4 — `/gsd-research-phase` candidate:** Gmail OAuth in Next 16 App Router with `googleapis` (callback config, token refresh failure UX, history-list 404 fallback contract); cron + hot-reload + advisory-lock interaction.
- **Phases 2, 3, 5 — standard patterns**, skip research-phase. Server Actions + Zod + Prisma + shadcn primitives + Anthropic SDK wrapped in `Result` are well-trodden ground; non-obvious bits already documented in PITFALLS.md and surfaced here.

---

## ADRs to Land Before Code

| ADR | Title | Phase | Why |
|---|---|---|---|
| ADR-0011 (candidate) | RLS via `withRls()` helper (not Prisma client extension) until SaaS flip | 1 | Decision constrains every multi-statement tenant op |
| ADR-0012 (candidate) | Asymmetric per-label classifier thresholds + status-regression block | 3 | Single `CLASSIFIER_AUTO_THRESHOLD` encodes wrong cost assumption |

May be combined into a single ADR per team preference for ADR scope.

---

## Gaps to Address During Planning/Execution

- **Per-label classifier threshold values.** Recommend `rejection ≥ 0.92`, `interview_invite ≥ 0.85`, `noise` aggressive — tune against classifier-fixtures once 20+ real emails exist. **Phase 3.**
- **OAuth "In production" with single-user audience vs Test mode.** 7-day revocation can be sidestepped; surface both options in SETUP.md. **Phase 4.**
- **`Event.data` JSON typing.** Currently untyped `Json` — recommend Zod schema per `EventType` parsed on read. **Phase 2** (cheap up-front, expensive to retrofit).
- **`FND-03` re-spec from count to category.** "≥30 tests" is gameable per Pitfall 12; replace with category coverage list. **Phase 5.**
- **Excerpt size (500 chars).** May be too short to triage in review queue; empirically check 5–10 real emails; if pushing toward full-body fetch, raise it. ADR territory if changed (privacy posture is in CLAUDE.md §6). **Phase 5.**
- **Full ATS domain blocklist.** Stack research named the big four; complete list (SmartRecruiters, Ashby, Rippling, Lattice, Eightfold, etc.) should be researched in Phase 3 from real Gmail data once OAuth works.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry on 2026-05-09; baseline already installed; one doc fix (Next 15→16) |
| Features | HIGH | Lean scope fixed; competitor matrix from product pages + multiple independent reviews; anti-features each cited to ADR or PROJECT.md constraint |
| Architecture | HIGH | Locked by ADR-0010; folder layout fixed; five module-boundary rules CI-enforced; `inbox-pipeline-exception` well-justified |
| Pitfalls | HIGH on Gmail/Prisma/RLS items (verified against official docs + community issues); MEDIUM on UX-trust + scope-creep items |

**Overall:** HIGH. Ready for roadmap creation.
