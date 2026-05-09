# foray

## What This Is

`foray` is a single-user, local-first job-application tracker that pairs manual capture with automatic Gmail classification. Each application — a "foray" against a single role at a single company — is logged once, then enriched as recruiter and ATS emails arrive: high-confidence classifications auto-update status with a one-click undo; ambiguous emails land in a tight review queue. The active job hunt as a whole is a "campaign" — never a stored entity, always a UI concept.

## Core Value

**One screen tells the owner what's actually happening today** — what's stale, what got rejected silently, what needs a follow-up — without manual spreadsheet maintenance and without LLM hallucination changing the record without consent.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — Lean milestone is the first ship to validate)

### Active

<!-- Lean milestone (v0.1) — single-week scope, deliver a usable foray. -->

#### Capture

- [ ] **CAPT-01**: Owner can manually create a new Application via `/applications/new` form (company autocomplete, role title, role URL, JD paste, location, salary range, source, applied date) in <30 seconds
- [ ] **CAPT-02**: Form validation via Zod runs on both client and server with parsed/branded types
- [ ] **CAPT-03**: Submission creates `Application` + `Event(type='created')` in one transaction

#### Gmail Ingestion

- [ ] **GMAIL-01**: Owner completes Google OAuth flow (test mode, single user) at `/api/gmail/auth` and `/api/gmail/callback`; refresh token stored encrypted on User row
- [ ] **GMAIL-02**: Settings page at `/settings` shows connection state with "Connect Gmail" / "Disconnect" / "Sync now" actions
- [ ] **GMAIL-03**: Polling endpoint `/api/gmail/poll` fetches threads modified since `User.gmailLastSyncAt` and persists Email metadata + ≤500 char body excerpt
- [ ] **GMAIL-04**: In-process `node-cron` fires `/api/gmail/poll` every 15 minutes while app is running

#### Classifier

- [ ] **CLASS-01**: Rules-first classifier in `src/features/classifier/service.ts` recognizes `rejection`, `interview_invite`, `recruiter_outreach`, `noise`, `unmatched` with regex patterns externalized in `rules.ts`
- [ ] **CLASS-02**: LLM fallback (Claude Haiku) handles low-confidence rule cases; SDK call wrapped in `Result<…, AppError>`
- [ ] **CLASS-03**: Returns `{ label, confidence, classifiedBy: 'rules' | 'llm' }`; threshold sourced from `env.CLASSIFIER_AUTO_THRESHOLD`
- [ ] **CLASS-04**: All Anthropic calls logged to `data/classifier-log.jsonl` with token counts; alert if daily total >$0.50

#### Matcher

- [ ] **MATCH-01**: Email→Application matcher in `src/features/matcher/service.ts` returns `Result<{ applicationId: ApplicationId | null }, AppError>`
- [ ] **MATCH-02**: Tiebreak order: thread continuity (`gmailThreadId` linked) → sender domain match against `Company.domain` → unmatched
- [ ] **MATCH-03**: All Prisma access via `tenantDb(userId)` — zero direct `prisma.*` imports outside `src/core/db/`

#### Auto-Update + Review Queue

- [ ] **AUTO-01**: confidence ≥ threshold AND application matched → update `Application.canonicalStatus`, write `Event(type='auto_status_changed', undoable=true)`
- [ ] **AUTO-02**: confidence < threshold OR unmatched → surface in `/inbox` review queue (no auto-apply)
- [ ] **AUTO-03**: First 50 emails after Gmail connect bypass auto-update and go to review queue regardless (build user-corrected ground truth)
- [ ] **AUTO-04**: Auto-applied changes show prominent undo (toast ~10s + permanent in event timeline)

#### Review Queue

- [ ] **REVIEW-01**: `/inbox` page shows low-confidence + unmatched emails (subject, from, body excerpt, suggested classification + confidence, suggested application)
- [ ] **REVIEW-02**: Per-row actions: confirm classification, override classification, link to existing Application, ignore (mark `reviewedByUser=true`)

#### Application Views

- [ ] **APP-01**: `/applications` list — table view filterable by `canonicalStatus`, sortable by `appliedAt` / `lastActivityAt`, count per status
- [ ] **APP-02**: `/applications/[id]` detail — chronological timeline (Stages + Events + Emails), edit affordances
- [ ] **APP-03**: Quick `canonicalStatus` change dropdown in detail view
- [ ] **APP-04**: Add/edit/complete Stages inline; free-form notes field

#### Auth

- [ ] **AUTH-01**: `src/core/auth/session.ts` `requireUser()` wired to real cookie/session check (HMAC over `APP_PASSWORD`-derived secret)
- [ ] **AUTH-02**: `/login` page with single password field; sets `foray_session` cookie on success
- [ ] **AUTH-03**: Middleware redirects unauthenticated requests to `/login` (defense-in-depth; real auth check stays in `requireUser()`)

#### Foundational Hardening

- [ ] **FND-01**: Extend `tenantDb` with all CRUD methods needed by Lean slices (currently only `application.findMany/findUnique/findFirst/count` are wrapped)
- [ ] **FND-02**: Add Postgres RLS policies in a migration (one policy per tenant-scoped table; `SET LOCAL app.user_id` per transaction via Prisma client extension)
- [ ] **FND-03**: ≥30 tests across classifier, matcher, env validation, tenantDb safety; `pnpm test:run` green
- [ ] **FND-04**: Pre-commit gate green: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck`

### Out of Scope

<!-- Lean explicitly defers these — re-evaluated after Lean ships. -->

- **Bookmarklet** — Standard milestone; manual form is enough for v0.1
- **"Today" dashboard** — Standard milestone; `/applications` list serves the daily glance for now
- **Native Chrome MV3 extension** — Full milestone; bookmarklet + manual form cover v0.1
- **Document upload / storage** — Full milestone; resume PDFs live in Drive for now
- **Recruiter entity UI** — Full milestone; recruiter is a free-text field in v0.1
- **Google Calendar sync** — Full milestone; calendar invites stay in Gmail/Calendar manually
- **Analytics view** — Full milestone; no funnel/cohort metrics until owner has ≥30 forays of real data
- **Follow-up reminders** — Full milestone; manual nudge from `lastActivityAt` is enough for v0.1
- **Tags + cross-record search** — Standard milestone; canonicalStatus filter is enough for v0.1
- **Multi-user / SaaS deployment** — Multi-tenant patterns are baked in (tenantDb, branded IDs, RLS) but only single-user is shipped; SaaS is a separate decision

## Context

**Stack & scaffold (already in place from v0.1.0):**
- Next.js 15 App Router + React 19 + TypeScript (strict)
- Prisma 7 + PostgreSQL (Docker), tenant-scoped via `tenantDb(userId)` wrapper
- Zod-validated `env.ts`, branded ID types (`UserId`, `ApplicationId`, `EmailId`)
- `AppError` + `neverthrow` `Result<T, E>` for fallible operations
- Pino with redaction for logs; classifier prompt/response logged to `data/classifier-log.jsonl` (gitignored)
- Vertical Slice Architecture under `src/features/<slice>/{actions,service,queries,schema,components}.ts` with thin `src/core/`

**Established by ADRs (read in `docs/decisions/`):**
- ADR-0001: Track and capture (manual capture is the entry point; automation augments, never replaces)
- ADR-0002: Multi-tenant ready from day one (tenantDb wrapper + branded IDs even though only one user ships)
- ADR-0003: Local-first (Docker Postgres, no cloud DB until SaaS decision)
- ADR-0005: Hybrid stages (canonical status + free-form per-foray stages — never collapse to one)
- ADR-0006: Hybrid trust classifier (rules first, LLM only on low confidence — protects against silent record corruption)
- ADR-0007: Lean → Standard → Full milestone progression
- ADR-0010: VSA over Clean/Hexagonal (no horizontal layering tax for single-dev project)

**Owner profile:** Single user (Duy / Edward Pham). Built to escape spreadsheet-and-Notion pain during active job search. Owner is technical (PM with prior SWE background) — comfortable with `pnpm`, Docker, and reading the schema directly. Tolerance for autonomy is HIGH (auto-apply with undo > review-everything queues), but **trust crisis on first wrong auto-apply is fatal** — undo must be obvious, undoable events must be permanent in the timeline.

**Why "foray":** A campaign is the whole job hunt. Each individual application is a foray — small, scoped, finite. The vocabulary keeps the product honest: this is not a CRM, not a "tracker", not an "applicant management system". Avoid synonyms.

## Constraints

- **Tech stack**: Next.js 15 + Prisma 7 + Postgres in Docker — no cloud DB, no Vercel deploy in Lean (local-first per ADR-0003)
- **Timeline**: Lean = ~1 week of focused effort; ship Friday or cut scope, never extend
- **Budget**: LLM cost cap $0.50/day — alert if exceeded; classifier defaults to rules-first to keep this honest
- **Privacy**: Email **bodies are not stored indefinitely** — metadata + ≤500 char excerpt only; full body fetched from Gmail API on demand for review queue display
- **Security**: API keys in `.env.local` (gitignored, never `.env.example`); OAuth refresh token encrypted at rest via `ENCRYPTION_KEY`; HMAC session cookies, not JWT
- **Testing**: Pre-commit gate (`lint && typecheck && test:run && build && depcheck`) is non-negotiable; `--no-verify` is forbidden — fix the hook, not the workaround
- **Architecture**: Vertical Slice (per ADR-0010) — features stay self-contained under `src/features/<slice>/`; cross-cutting work lives in `src/core/`; no horizontal "service layer" or "repository pattern"
- **Multi-tenant safety enforced by types**: `tenantDb(userId)` wrapper is the only way to query tenant-scoped tables; ESLint `no-direct-prisma` rule blocks the escape hatch; Postgres RLS is the second line

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lean before Standard before Full (per ADR-0007) | Each milestone validates the assumption that the next is needed; Standard or Full may be skipped if Lean covers ≥90% of real use | — Pending (Lean ships first) |
| Vertical Slice Architecture (per ADR-0010) | Single-dev scale — horizontal layering imposes ceremony tax that never pays out | ✓ Good (committed in `603e7e7`, refined in `dc760bf`) |
| Rules-first classifier with LLM fallback (per ADR-0006) | Predictable cheap path for 80% of email; LLM only when rules can't decide; bounds cost and latency | — Pending (Lean ships classifier) |
| Manual capture is primary; automation augments (per ADR-0001) | Owner trust is built by manual capture working perfectly; auto-classification is bonus, not foundation | — Pending |
| Hybrid status (canonical enum + free-form stages) (per ADR-0005) | Global filtering needs 6 fixed states; per-foray reality needs free-form stage names; resist collapsing them | ✓ Good (committed in schema) |
| Multi-tenant scaffolding even for single-user (per ADR-0002) | Cheap to bake in early via tenantDb wrapper + branded IDs + RLS; expensive to retrofit later if SaaS is ever needed | ✓ Good (committed in `603e7e7`) |
| Local-first (Docker Postgres, no cloud) (per ADR-0003) | Owner privacy + zero monthly cost + no vendor lock until SaaS pivot | ✓ Good |
| GSD planning + autonomous execution from Lean | Bootstrapping `.planning/` artifacts so subsequent milestones (Standard, Full) reuse the same workflow | — Pending (this commit) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-09 after initialization (Lean milestone bootstrap)*
