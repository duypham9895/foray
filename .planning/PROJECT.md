# foray

## What This Is

`foray` is a single-user, local-first job-application tracker that pairs manual capture with automatic Gmail classification. Each application — a "foray" against a single role at a single company — is logged once, then enriched as recruiter and ATS emails arrive: high-confidence classifications auto-update status with a one-click undo; ambiguous emails land in a tight review queue. The active job hunt as a whole is a "campaign" — never a stored entity, always a UI concept.

## Core Value

**One screen tells the owner what's actually happening today** — what's stale, what got rejected silently, what needs a follow-up — without manual spreadsheet maintenance and without LLM hallucination changing the record without consent.

## Current Milestone: v0.3 Full

**Goal:** Transform foray from a capture-and-classify tool into a complete job-search command center with browser extension, document management, calendar integration, and analytics.

**Target features:**
- Chrome MV3 Extension — one-click capture directly from job posting pages
- Document Storage — attach resumes, cover letters, and artifacts to forays
- Recruiter Entity — structured recruiter records linked to forays
- Google Calendar Integration — auto-sync interview events
- Analytics Dashboard — funnel visualization, response rates, time-to-offer metrics
- Reminders + Polish — follow-up nudges, notification system, final UX polish

## Requirements

### Validated

<!-- Shipped and confirmed valuable in v0.1 Lean milestone. -->

#### Capture

- ✓ **CAPT-01**: Owner can manually create a new Application via `/applications/new` form — v0.1
- ✓ **CAPT-02**: Form validation via Zod runs on both client and server with parsed/branded types — v0.1
- ✓ **CAPT-03**: Submission creates `Application` + `Event(type='created')` in one transaction — v0.1

#### Gmail Ingestion

- ✓ **GMAIL-01**: Owner completes Google OAuth flow at `/api/gmail/auth` and `/api/gmail/callback`; refresh token stored encrypted — v0.1
- ✓ **GMAIL-02**: Settings page at `/settings` shows connection state with Connect/Disconnect/Sync-now actions — v0.1
- ✓ **GMAIL-03**: Polling via `pollOnce` fetches threads with history.list fallback; persists metadata + ≤500 char body excerpt — v0.1
- ✓ **GMAIL-04**: In-process `node-cron` fires every 15 minutes with 4 guards (NEXT_RUNTIME, NODE_ENV, globalThis, advisory lock) — v0.1

#### Classifier

- ✓ **CLASS-01**: Rules-first classifier recognizes 5 labels with regex patterns externalized in `rules.ts` — v0.1
- ✓ **CLASS-02**: LLM fallback (Claude Haiku) handles low-confidence rule cases; SDK call wrapped in `Result<…, AppError>` — v0.1
- ✓ **CLASS-03**: Returns `{ label, confidence, classifiedBy }` with per-label asymmetric thresholds — v0.1
- ✓ **CLASS-04**: Pre-call budget guard reads daily cost; returns `err(RateLimited)` when ≥$0.50/day — v0.1

#### Matcher

- ✓ **MATCH-01**: Email→Application matcher returns `Result<{ applicationId: ApplicationId | null }, AppError>` — v0.1
- ✓ **MATCH-02**: 4-step tiebreak: thread continuity → ATS-domain skip → sender domain match → unmatched — v0.1
- ✓ **MATCH-03**: All Prisma access via `tenantDb(userId)` — zero direct `prisma.*` imports outside `src/core/db/` — v0.1

#### Auto-Update + Review Queue

- ✓ **AUTO-01**: Confidence ≥ threshold AND application matched AND NOT regression → auto-update with undoable event — v0.1
- ✓ **AUTO-02**: Low confidence OR unmatched OR regression → surface in `/inbox` review queue — v0.1
- ✓ **AUTO-03**: First 50 emails after Gmail connect bypass auto-update (build user-corrected ground truth) — v0.1
- ✓ **AUTO-04**: Auto-applied changes show undo in event timeline; undo sets `reviewedByUser=true` — v0.1

#### Review Queue

- ✓ **REVIEW-01**: `/inbox` page shows low-confidence + unmatched emails with subject, excerpt, classification, confidence, suggested application — v0.1
- ✓ **REVIEW-02**: Per-row actions: confirm, override, link-to-application, ignore — v0.1

#### Application Views

- ✓ **APP-01**: `/applications` list — filterable by canonicalStatus, sortable, count per status — v0.1
- ✓ **APP-02**: `/applications/[id]` detail — chronological timeline (Stages + Events + Emails) — v0.1
- ✓ **APP-03**: Quick canonicalStatus change dropdown in detail view — v0.1
- ✓ **APP-04**: Add/edit/complete Stages inline; free-form notes field — v0.1

#### Auth

- ✓ **AUTH-01**: `requireUser()` wired to iron-session HMAC cookie check — v0.1
- ✓ **AUTH-02**: `/login` page with single password field; sets `foray_session` cookie on success — v0.1
- ✓ **AUTH-03**: Middleware redirects unauthenticated requests to `/login` — v0.1

#### Foundational Hardening

- ✓ **FND-01**: `tenantDb` exposes wrapped CRUD methods for all tenant-scoped tables — v0.1
- ✓ **FND-02**: Postgres RLS policies active on every tenant-scoped table; `withRls` helper sets `app.user_id` per transaction — v0.1
- ✓ **FND-03**: Category-based test coverage: 314 tests across 6 categories (tenant isolation, classifier fixtures, matcher tiebreak, auto-update + undo, budget guard, env validation) — v0.1
- ✓ **FND-04**: Pre-commit gate green: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` — v0.1

### Active

<!-- Current milestone: v0.3 Full -->

- [ ] Chrome MV3 Extension — one-click capture from job posting pages
- [ ] Document Storage — attach resumes, cover letters, artifacts to forays
- [ ] Recruiter Entity — structured recruiter records linked to forays
- [ ] Google Calendar Integration — auto-sync interview events
- [ ] Analytics Dashboard — funnel visualization, response rates, time-to-offer metrics
- [ ] Reminders + Polish — follow-up nudges, notification system, final UX polish

### Out of Scope

<!-- Re-evaluated after each milestone. -->

- **Multi-user / SaaS deployment** — Multi-tenant patterns are baked in but only single-user is shipped

## Context

**Stack & scaffold:**
- Next.js 16 App Router + React 19 + TypeScript (strict)
- Prisma 7 + PostgreSQL (Docker), tenant-scoped via `tenantDb(userId)` wrapper
- Zod-validated `env.ts`, branded ID types (`UserId`, `ApplicationId`, `EmailId`)
- `AppError` + `neverthrow` `Result<T, E>` for fallible operations
- Pino with redaction for logs; classifier prompt/response logged to `data/classifier-log.jsonl` (gitignored)
- Vertical Slice Architecture under `src/features/<slice>/` with thin `src/core/`

**Shipped in v0.1 (Lean milestone):**
- 5 phases, 22 plans, 314 tests passing
- Full pipeline: manual capture → Gmail OAuth → 4-stage pipeline → auto-update → review queue
- 31/31 v1 requirements satisfied
- Structural CI checks prevent regression of safety properties

**Owner profile:** Single user (Duy / Edward Pham). Built to escape spreadsheet-and-Notion pain during active job search. Owner is technical (PM with prior SWE background) — comfortable with `pnpm`, Docker, and reading the schema directly. Tolerance for autonomy is HIGH (auto-apply with undo > review-everything queues), but **trust crisis on first wrong auto-apply is fatal** — undo must be obvious, undoable events must be permanent in the timeline.

**Why "foray":** A campaign is the whole job hunt. Each individual application is a foray — small, scoped, finite. The vocabulary keeps the product honest: this is not a CRM, not a "tracker", not an "applicant management system". Avoid synonyms.

## Constraints

- **Tech stack**: Next.js 16 + Prisma 7 + Postgres in Docker — local-first per ADR-0003
- **Budget**: LLM cost cap $0.50/day — classifier defaults to rules-first
- **Privacy**: Email bodies not stored indefinitely — metadata + ≤500 char excerpt only
- **Security**: API keys in `.env.local`; OAuth refresh token encrypted at rest; HMAC session cookies
- **Testing**: Pre-commit gate is non-negotiable; `--no-verify` is forbidden
- **Architecture**: Vertical Slice (per ADR-0010) — features self-contained under `src/features/<slice>/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lean before Standard before Full (ADR-0007) | Each milestone validates the assumption that the next is needed | ✓ Good — Lean shipped, validates core value |
| Vertical Slice Architecture (ADR-0010) | Single-dev scale — horizontal layering imposes ceremony tax | ✓ Good |
| Rules-first classifier with LLM fallback (ADR-0006) | Predictable cheap path for 80%; LLM only on low confidence | ✓ Good — 314 tests, per-label thresholds |
| Manual capture is primary; automation augments (ADR-0001) | Owner trust built by manual capture working perfectly | ✓ Good |
| Hybrid status (ADR-0005) | Global filtering needs fixed states; per-foray needs free-form stages | ✓ Good |
| Multi-tenant scaffolding for single-user (ADR-0002) | Cheap to bake in early; expensive to retrofit | ✓ Good — RLS + tenantDb active |
| Local-first (ADR-0003) | Privacy + zero cost + no vendor lock | ✓ Good |
| GSD planning + autonomous execution | Bootstrapping `.planning/` for subsequent milestones | ✓ Good — 5 phases autonomously executed |
| v0.2 Standard shipped (phases 6-10) | Bookmarklet, Today dashboard, Tags/Search, UX polish, E2E | ✓ Good — 371 tests, 15 plans |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-10 after v0.2 Standard milestone*
