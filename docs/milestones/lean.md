# Milestone: Lean

> **Goal**: a usable foray by Friday. Owner can manually log applications, Gmail auto-classifies high-confidence emails, ambiguous ones land in a small review queue.

**Estimated effort**: ~1 week
**Status**: ⏳ Not started

---

## In scope

### Capture
- [ ] **Manual application form** at `/applications/new` — fields: company (autocomplete or new), role title, role URL, JD paste (textarea), location, salary range, source (linkedin/direct/referral/recruiter/other), applied date
- [ ] Form validation via Zod (client + server)
- [ ] On submit: create `Application` + `Event(type='created')`

### Gmail ingestion
- [ ] Google OAuth flow at `/api/gmail/auth` and `/api/gmail/callback` (test mode, single user)
- [ ] OAuth refresh token storage (encrypted) on User row
- [ ] Settings page at `/settings` showing connection state + "Connect Gmail" / "Disconnect" / "Sync now"
- [ ] Gmail polling endpoint at `/api/gmail/poll` — fetches threads modified since `User.gmailLastSyncAt`
- [ ] In-process cron (node-cron) firing `/api/gmail/poll` every 15 minutes when app is running

### Classifier (slice: `src/features/classifier/`)
- [ ] Rules-first classifier in `src/features/classifier/service.ts` with regex patterns for: rejection, interview_invite, recruiter_outreach, noise (newsletters, automated digests), unmatched
- [ ] LLM fallback via Claude Haiku for low-confidence cases (Anthropic SDK call wrapped in `Result<…, AppError>`)
- [ ] Rules table externalized to `src/features/classifier/rules.ts` (one file per rule pattern, importable into tests)
- [ ] Classifier returns `{ label, confidence, classifiedBy: 'rules' | 'llm' }`; consumer decides what to act on
- [ ] Threshold from `env.CLASSIFIER_AUTO_THRESHOLD` (already in `src/core/env.ts`)

### Matcher (slice: `src/features/matcher/`)
- [ ] Email→Application matching in `src/features/matcher/service.ts`, returns `Result<{ applicationId: ApplicationId | null }, AppError>`:
  1. Existing thread continuity (`gmailThreadId` already linked to an `Application`)
  2. Sender domain match against `Company.domain`
  3. Falls back to "unmatched" → review queue with no application link
- [ ] All Prisma access via `tenantDb(userId)` from `src/core/db/`

### Auto-update logic
- [ ] When confidence ≥ threshold AND application matched: update `Application.canonicalStatus`, write `Event(type='auto_status_changed', undoable=true)`
- [ ] When confidence < threshold OR unmatched: surface in review queue

### Review queue
- [ ] `/inbox` page showing low-confidence + unmatched emails
- [ ] Per-row: subject, from, body excerpt, suggested classification + confidence, suggested application (if matcher had a guess), action buttons
- [ ] Actions: confirm classification, override classification, link to existing application, ignore (mark `reviewedByUser=true`)

### Application list + detail
- [ ] `/applications` page — table view filterable by canonicalStatus, sortable by appliedAt / lastActivityAt
- [ ] `/applications/[id]` page — detail view with timeline (Stages + Events), email history, edit affordances
- [ ] Quick status change dropdown in detail view
- [ ] Add/edit/complete stages inline
- [ ] Free-form notes field

### Single-user gate (slice: `src/features/auth/`)
- [ ] Wire `src/core/auth/session.ts` `requireUser()` to a real cookie/session check (HMAC over APP_PASSWORD-derived secret)
- [ ] `/login` page with single password field; sets `foray_session` cookie on success
- [ ] Middleware redirects unauthenticated requests to `/login` (defense-in-depth; the real auth check stays in `requireUser()` per PRINCIPLES.md §"Security baseline")

### Foundational (already in place from v0.1.0 scaffold)

These were established before Lean started; tasks here are *enabling* feature work, not building from scratch:

- ✅ Prisma schema with all entities (User, Company, Application, Stage, Event, Email + Recruiter + Document defined but unused this milestone)
- ✅ Initial migration applied; seed script working
- ✅ `src/core/db/{client,tenant,index}.ts` (Prisma singleton + tenantDb wrapper)
- ✅ `src/core/types/ids.ts` (branded ID types)
- ✅ `src/core/errors/index.ts` (AppError + neverthrow re-export)
- ✅ `src/core/logger/index.ts` (pino with redaction)
- ✅ `src/core/env.ts` (Zod-validated process.env)
- [ ] **NEW for Lean**: extend `tenantDb` with all CRUD methods needed by the slices below (currently only `application.findMany/findUnique/findFirst/count` are wrapped)
- [ ] **NEW for Lean**: add Postgres RLS policies in a migration (one policy per tenant-scoped table; `SET LOCAL app.user_id` per transaction via Prisma client extension)
- [ ] **NEW for Lean**: write tests — `pnpm test:run` passes ≥30 tests covering classifier rules, matcher tiebreak, env validation, tenantDb safety
- [ ] All pre-commit checks pass (`pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck`)

---

## Out of scope (explicitly deferred)

- Bookmarklet (Standard milestone)
- "Today" dashboard (Standard milestone)
- Native Chrome MV3 extension (Full milestone)
- Document upload / storage (Full milestone)
- Recruiter entity UI (Full milestone)
- Google Calendar sync (Full milestone)
- Analytics view (Full milestone)
- Follow-up reminders (Full milestone)
- Tags + cross-record search (Standard milestone)

---

## Acceptance criteria

Milestone is done when **all** of these are true:

1. Owner can create a new Application via the manual form in <30 seconds
2. Connecting Gmail and clicking "Sync now" pulls emails from the past 7 days
3. A canonical rejection email ("we regret to inform you...") is auto-classified as `rejection` with confidence ≥0.85, auto-updates the matched Application's `canonicalStatus` to `rejected`, and the change is undoable from the timeline
4. An ambiguous recruiter outreach ("are you open to opportunities?") lands in `/inbox` review queue without auto-applying any change
5. The `/applications` list shows all Applications with correct counts per canonicalStatus
6. The `/applications/[id]` detail view shows the full timeline (Stages + Events + Emails) in chronological order
7. `pnpm test:run` passes with ≥30 tests across classifier, matcher, and env modules
8. `pnpm build` produces a successful production build
9. **`pnpm depcheck` passes — no module boundary violations** (PRINCIPLES.md §"Module boundaries")
10. **No direct `prisma.*` imports outside `src/core/db/`** (verified by depcheck rule `no-direct-prisma`)
11. **Every Server Action returns `Result<T, AppError>`** (verified by code review checklist item #6)
12. Owner has used foray to log ≥3 real applications and seen at least one auto-classification trigger correctly

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Gmail OAuth verification headache | Stay in Test mode (only owner's email allowed); document this clearly in SETUP.md |
| Classifier rules too brittle (false positives) | Start with conservative patterns; real test set built from real emails after first sync |
| LLM cost surprise | Log every Anthropic call with token counts; alert if daily total > $0.50 |
| Matcher misattributes emails | Default to "unmatched → review queue" when uncertain; never auto-apply on weak match |
| Auto-update creates trust crisis on first wrong call | Undo affordance is prominent (toast for ~10s + permanent in event timeline); first 50 emails go to review queue regardless to build user-corrected ground truth |

---

## Definition of done

When all acceptance criteria pass + a quick demo session walks through:

1. Connect Gmail → see "Connected as ..." in settings
2. Click "Sync now" → emails appear
3. Open `/inbox` → review at least one low-confidence email, click confirm
4. Open `/applications/[id]` for an auto-rejected app → see status change event with undo button
5. Add a new manual application → see it in the list
