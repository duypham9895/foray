# Phase 2: Applications Slice (Manual Tracker) - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Mode:** Auto-generated (`--auto` — Claude picked recommended defaults; user can override during plan-phase)

<domain>
## Phase Boundary

foray becomes a usable manual tracker. The owner can:
1. Capture a foray in <30 seconds via `/applications/new` (CAPT-01..03)
2. See all forays in `/applications` filtered by canonicalStatus, sorted, with per-status counts (APP-01)
3. Drill into `/applications/[id]` to view a chronological timeline merging Stages + Events + Emails (APP-02)
4. Change `canonicalStatus` via dropdown (APP-03)
5. Edit Stages and notes inline (APP-04)
6. Auto-update Events render visually distinct from manual edits (APP-02 per DESIGN.md)

**Requirements covered:** CAPT-01, CAPT-02, CAPT-03, APP-01, APP-02, APP-03, APP-04

**Out of scope:** Gmail wiring (Phase 4), classifier (Phase 3), `/inbox` review queue (Phase 5), bookmarklet (Standard milestone).

**Hard contract for Phase 4:** `applyAutoStatusChange` and `undoStatusChange` services exist as `Result`-returning functions in `applications/service.ts`; `Event.data` is parsed via Zod schema per `EventType` on read.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Form pattern (capture + edit + status)

- [auto] **Form library:** React 19 `useActionState` + Server Actions — consistent with `src/features/auth/components/login-form.tsx` (Phase 1 established pattern). No `react-hook-form` install.
- [auto] **Validation:** Single Zod schema in `applications/schema.ts` — server is canonical via `safeParse` in the action; client-side validation reuses the same schema for inline hints (no parallel rules).
- [auto] **Error rendering:** Per-field errors below input; top-of-form `AppError` message for service-level failures (e.g., `STATUS_REGRESSION_REQUIRES_REVIEW`).
- [auto] **Success behavior:** `redirect('/applications/[id]')` on successful create; `revalidatePath('/applications/[id]')` after edits (no full page reload).

### Area 2: List + detail rendering strategy

- [auto] **Server Components by default:** `/applications` and `/applications/[id]` are Server Components reading via `tenantDb(userId).application.findMany/findUnique`. Client islands only for interactive bits (status dropdown, inline stage edit, notes editor).
- [auto] **Filter state:** URL-driven (`?status=applied,screening&sort=lastActivityAt:desc`). Server reads `searchParams`, no client filter state. Default filter excludes `rejected` + `withdrawn`.
- [auto] **Sort:** URL-driven, two sort axes — `appliedAt` and `lastActivityAt`, **`:desc` only for Lean** (the UI toggle has no asc/desc affordance). Default: `lastActivityAt:desc`. Asc variants deferred to the Standard milestone when bulk filtering becomes a UX need (decided in Phase 2 review WR-03).
- [auto] **Empty state:** `/applications` empty → "No forays yet — capture your first" CTA linking `/applications/new`. `/applications/[id]` not-found → 404 page with "Back to forays". Tone per DESIGN.md (calm, not exclamatory).
- [auto] **Count badges:** Per-status count + hidden-archived count rendered as text labels (DESIGN.md: no decorative icons).

### Area 3: Auto-update Event visual distinction (APP-02 + DESIGN.md)

- [auto] **Strategy:** Tinted background row + 2px left rail + label "Auto-updated from email" rendered in `text-sm` muted secondary. Manual events get a plain row with no rail.
- [auto] **Color:** Cyan-600 left rail (`#0891b2`, the `screening` status hue per DESIGN.md). Avoids loud reds/greens; consistent with "in-progress signal" semantics.
- [auto] **Icon use:** Text label only (DESIGN.md §"Less icons, more humanity"). No icon next to "Auto-updated from email".
- [auto] **Source-email link:** If `Event.emailId` exists, render "View source email" as a text link (defers cleanly to Phase 5 when `/inbox/[emailId]` exists). For Phase 2 in isolation, `emailId` will be null on every Event (no Gmail yet) — link is conditional.

### Area 4: Service contracts for Phase 4 hooks

- [auto] **`applyAutoStatusChange` signature:** `(userId, applicationId, change: { newStatus: CanonicalStatus, source: EventSource, emailId?: number, classifierConfidence?: number, classifiedBy?: ClassifiedBy }) => Promise<Result<{ event: Event }, AppError>>`. Wraps single `withRls` tx that updates `Application.canonicalStatus + lastActivityAt` and inserts `Event(type='auto_status_changed', source: change.source, undoable: true, data: { previousStatus, newStatus, classifierConfidence, classifiedBy })`.
- [auto] **Status-regression block at service layer:** Yes. `applications/service.ts` rejects regressions (e.g., `interviewing → rejected`, `offer → screening`) with `errors.statusRegressionRequiresReview()`. Phase 4 callers route the email to the review queue instead. Manual user changes via the status dropdown bypass this guard (`applyManualStatusChange` ≠ `applyAutoStatusChange`).
- [auto] **`undoStatusChange` semantics:** Restores `Application.canonicalStatus` from `Event.data.previousStatus`, marks the original event `undoneAt = now()`, writes `Event(type='status_undone', source='manual', data: { undoneEventId, restoredStatus })`, AND if the original event has `emailId`, sets `Email.reviewedByUser = true` (idempotency per Pitfalls #8 — prevents next cron tick from re-acting). All in one `withRls` tx.
- [auto] **Stage CRUD service surface:** `addStage(userId, applicationId, input)`, `updateStage(userId, stageId, patch)`, `completeStage(userId, stageId, outcome)`. Each: returns `Result<Stage, AppError>`, runs in `withRls`, writes a corresponding `Event(type='stage_added' | 'stage_completed')`, and updates `Application.lastActivityAt`. Notes edits write `Event(type='note_added')`.

### Area 5: ATS-domain rejection (CAPT-02)

- [auto] **Source list:** Hardcoded TS const at `src/core/domains/ats-domains.ts` — shared with Phase 3 matcher per MATCH-02 skip rule. No env var, no DB table. Initial list: `greenhouse.io, lever.co, workday.com, myworkdayjobs.com, linkedin.com, ashbyhq.com, smartrecruiters.com, jobvite.com, icims.com, taleo.net, recruitee.com, breezy.hr, bamboohr.com, indeed.com, glassdoor.com`.
- [auto] **Match strategy:** `isAtsDomain(input)` lowercases, strips protocol/path, extracts apex (`endsWith` against the list). Reject if matched.
- [auto] **Where applied:** Zod `.superRefine` inside `companySchema` (the autocomplete-or-create field). Same schema runs client-side (instant feedback) and server-side (canonical).
- [auto] **Error wording:** "That looks like an ATS domain (`{domain}`). Use the company's actual domain (e.g., `stripe.com`) — ATS platforms aren't the company you're applying to." Tone matches DESIGN.md (warm, explanatory, not scolding).

### Claude's Discretion

- Exact Tailwind classes for the auto-update event row tint — pick a low-saturation cyan-50 background that satisfies the cyan-600 rail rule.
- Whether `applications/queries.ts` exposes a single `findApplicationsForList(userId, filters, sort)` or returns the raw Prisma result — recommend single typed query function so the Server Component stays thin.
- Stage `order` strategy on insert — recommend `MAX(order) + 1` per application.
- Whether `/applications/new` company picker is a `<datalist>` (zero JS, accessible) or a custom combobox — recommend `<datalist>` for Lean; can upgrade to `cmdk` in Standard milestone if friction surfaces.
- shadcn primitives to add now: `button`, `input`, `label`, `select`, `card`, `badge`, `dropdown-menu`, `dialog`. Skip `combobox` until truly needed.
- Whether the timeline is a single SQL query (UNION ALL of stages/events/emails by `occurredAt`) or three Prisma queries merged in service — recommend three queries + in-memory sort for clarity at Lean scale (≤200 rows expected).

</decisions>

<code_context>
## Existing Code Insights

### Reusable assets (Phase 1 deliverables)

- `src/core/auth/session.ts` → `requireUser()` — call on line 1 of every Server Action and Server Component reading user data.
- `src/core/db/with-rls.ts` → `withRls(userId, async tx => …)` — wrap multi-statement writes (create + event insert).
- `src/core/db/tenant.ts` → `tenantDb(userId)` — wraps single-row reads (`findMany`, `findUnique`, `findFirst`, `count`) for `application`. Phase 2 will need to extend this wrapper to support `company`, `event`, `stage` reads (or read via `withRls` if simpler; see ADR-0011 for the rationale on why we don't `$extends`).
- `src/core/errors/index.ts` → `errors.*()` factory + `Result` re-export.
- `src/core/types/ids.ts` → `UserId`, `ApplicationId` branded types. Add `CompanyId`, `StageId`, `EventId` here in Phase 2.
- `src/features/auth/components/login-form.tsx` → reference `useActionState` pattern.

### Established patterns (don't reinvent)

- Server Actions: `parse → authorize → service` (see `auth/actions.ts:login`).
- All fallible operations: `Result<T, AppError>` (neverthrow) — `eslint-plugin-neverthrow` enforces no unwrapped reads.
- Prisma access: only via `tenantDb` or `withRls`. Direct `prisma.*` blocked by ESLint `no-direct-prisma`.
- Module boundaries: `applications/` may import from `core/` and `ui/`, NEVER from other slices. CI-enforced via dependency-cruiser.
- DESIGN.md: no decorative icons, generous whitespace, `text-3xl/xl/base/sm/xs` only, status colors used sparingly, rejection rendered in muted gray (NEVER red).

### Integration points (Phase 2 will create)

- `src/app/applications/page.tsx` — list view (Server Component, ≤5 lines: parses searchParams, calls slice service, renders).
- `src/app/applications/new/page.tsx` — create form (delegates to `<NewApplicationForm />` client island).
- `src/app/applications/[id]/page.tsx` — detail view (Server Component, renders timeline + client islands for edits).
- `src/features/applications/{actions,service,queries,schema,components/}.ts` — full slice anatomy.
- `src/core/domains/ats-domains.ts` — shared ATS list (consumed by Phase 3 matcher).
- ADR-0012 candidate: status-regression block + auto-update-event styling (write during planning).

</code_context>

<specifics>
## Specific Ideas

- **Capture flow target:** real <30s timing. Optimize: company autocomplete via `<datalist>` populated server-side from existing `Company.name` rows (no fetch); applied date defaulted to today; salary fields optional/collapsed by default.
- **Status dropdown semantics:** dropdown shows all 6 canonical statuses; selecting one writes `Event(type='status_changed', source='manual', data: { previousStatus, newStatus })` and updates `Application.canonicalStatus + lastActivityAt`. No regression block on manual changes (user knows what they're doing).
- **Inline stage edit:** click-to-edit on stage name and notes (single text input replaces label, blur or Enter saves via Server Action). Outcome is a small toggle: `passed | failed | no_response | (clear)`.
- **Notes field:** application-level free-form `<textarea>` with autosave-on-blur Server Action.
- **`Event.data` Zod schemas:** one schema per `EventType` exported from `applications/schema.ts`. On read, the timeline component does `eventDataSchemaFor(event.type).safeParse(event.data)` and renders via a discriminated-union switch. Bad data logs a warning + falls back to a generic "Event #{id}" line.
- **Server Component data flow:** detail page fetches `application + stages + events + emails` in 3 Prisma calls inside one `withRls` (or via tenantDb if read-only), merges + sorts in memory by `occurredAt`, renders timeline.

</specifics>

<deferred>
## Deferred Ideas

- Bookmarklet / Chrome extension capture (Standard + Full milestones — explicitly out of Lean scope per `docs/milestones/lean.md`).
- Document upload (resume/JD/take-home) — schema field exists but UI is Standard milestone scope.
- Recruiter linking UI (Standard milestone — service surface stays minimal).
- Search/full-text on notes + JD — no need at Lean scale.
- Optimistic UI for status dropdown — recommend deferring; Server Component refresh is fast at this scale.
- "Stale foray" surfacing (≥7 days no activity) — that's a Today-view concept, lives in Phase 5 or a future Today phase.
- Bulk actions (archive multiple, status-change multiple) — Standard milestone.
- Salary currency normalization / multi-currency — single string field, user types currency code.

</deferred>
