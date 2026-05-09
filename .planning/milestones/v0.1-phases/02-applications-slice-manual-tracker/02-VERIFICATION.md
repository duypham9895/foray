---
phase: 02
phase_name: Applications Slice (Manual Tracker)
verification_date: 2026-05-09
status: human_needed
total_criteria: 5
verified: 1
partial: 0
human_needed: 4
not_met: 0
pre_commit_gate: pass
re_verification: false
human_verification:
  - test: "UAT-02-01..05 — capture flow under 30 seconds"
    expected: "Form fillable with company / role / source; Save → redirected to /applications/[id]; detail renders Foray-created timeline entry; stopwatch < 30s"
    why_human: "<30s is a stopwatch metric on a real human filling a real form; not testable via grep or unit test. ATS-domain rejection in browser also requires DOM-level inline error display."
  - test: "UAT-02-06 — ATS-domain rejection live"
    expected: "Submitting domain `greenhouse.io` shows the inline ATS error in the form; switching to `greenhouse-inc.com` succeeds"
    why_human: "Server-side Zod is unit-tested (31 schema tests, all green); browser verification confirms the error message actually surfaces below the field rather than as a generic 500."
  - test: "UAT-02-07..09 — status dropdown, stage editor, notes autosave"
    expected: "Status dropdown writes Event + bumps lastActivityAt visibly on list; stage Add + Mark passed flows complete; notes autosave on blur shows Saved indicator + persists across refresh"
    why_human: "Service layer is integration-tested against real RLS Postgres (153/158 tests green); UI interactivity (dropdown menu, click-to-edit blur, autosave indicator) is not exercised by automated tests."
  - test: "UAT-02-10..12 — auto-update visual + chip filter + sort"
    expected: "Auto-update event renders cyan-tinted row + 2px cyan-600 left rail + 'Auto-updated from email' label, no icon, no source-email link (Phase 2 emailId always null); chip toggle adds/removes status from URL; Reset returns to default; sort URL toggle reorders list"
    why_human: "Tailwind class composition + visual hierarchy is reviewed by eye, not by test. Helper toggleStatusInUrl has 6 unit tests; the live URL→component round-trip needs browser verification."
---

# Phase 2: Applications Slice (Manual Tracker) Verification Report

**Phase Goal:** foray is a usable manual tracker — owner can capture a foray in <30 seconds, see all forays in a list, drill into a foray's full timeline, change status, edit stages and notes.
**Verified:** 2026-05-09
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Phase 2 Success Criteria)

| #  | Truth                                                                                                         | Status        | Evidence                                                                                                                                                                                                                                                                                                                              |
|----|---------------------------------------------------------------------------------------------------------------|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | `/applications/new` form captures a foray <30s; ATS domains rejected client+server with helpful error         | human_needed  | Code: `new-application-form.tsx` (273 LOC, datalist autocomplete, salary collapsed by default), `createApplicationSchema` superRefine + service-layer re-parse, `ats-domains.ts` (15-entry block list). Tests: 11 ATS unit tests + 31 schema tests + service integration tests. The <30s stopwatch and inline error display require browser. |
| 2  | Submission creates 1 `Application` row + 1 `Event(type='created', source='manual')` in single `withRls` tx    | human_needed  | Code: `service.ts:createApplication` (lines 52–121) — single `withRls` block creates Application + writes `Event(type:'created', source:'manual', data: eventDataSchemas.created.parse({source:'manual'}))`. Tests: `service.test.ts` integration tests against real Postgres + RLS (CR1 verifies app+event count and tenant isolation via CR6). Browser confirms Foray-created timeline row. |
| 3  | `/applications` filters by `canonicalStatus` (default excludes rejected+withdrawn), sortable, count badges     | human_needed  | Code: `queries.ts:findApplicationsForList` (default `DEFAULT_HIDDEN_STATUSES = {rejected,withdrawn}`), `countApplicationsByStatus` returns all 6 statuses + archived total, `application-list.tsx` renders 6 chips with counts + Reset link + sort toggle, `listSortSchema` validates URL `?sort=` (WR-01 fix). Tests: 6 colocated `toggleStatusInUrl` unit tests. Browser confirms chip toggle round-trip. |
| 4  | `/applications/[id]` chronological timeline (stages+events+emails); status dropdown writes Event+bumps lastActivityAt; stages+notes inline; auto-update Events visually distinct | human_needed  | Code: `application-detail.tsx` composes header + StatusDropdown + StageEditor + NotesEditor + Timeline; `timeline.tsx` merges 3 sources sorted desc by `occurredAt`; auto event styled `bg-cyan-50 dark:bg-cyan-950/30 border-l-2 border-cyan-600` + "Auto-updated from email" label, no icon (DESIGN.md compliant); conditional "View source email" branch present. Service: `applyManualStatusChange`, `addStage`, `updateStage` (saves on blur per WR-02 fix), `completeStage`, `updateApplicationNotes` (autosave-on-blur). All bump `lastActivityAt`. Tests: 11 stage + 5 notes integration tests against RLS Postgres. Browser confirms visual + interactive flow. |
| 5  | `applyAutoStatusChange` and `undoStatusChange` exist as `Result`-returning functions; `Event.data` parsed via Zod schema per `EventType` on read | VERIFIED      | Code: `service.ts:172` `applyAutoStatusChange` returns `Promise<Result<{event:Event\|null}, AppError>>` with status-regression guard via `isStatusRegression`; `service.ts:236` `undoStatusChange` returns `Promise<Result<{event:Event}, AppError>>` and marks linked email `reviewedByUser=true`. `eventDataSchemaFor(type)` exported from `schema.ts:193`; `timeline.tsx:35,136` calls it on every event read. ADR-0012 locks the contract. **No browser interaction required.** Tests: A1–A4 + U1–U4 integration tests + 36-cell `isStatusRegression` truth table + 12 schema dispatch tests (E1–E12). |

**Score:** 1/5 truths verified by code+tests alone; 4/5 require pre-merge browser walkthrough (DEFERRED in 02-UAT.md).

### Required Artifacts

| Artifact                                                                       | Expected                                            | Status     | Details                                            |
|--------------------------------------------------------------------------------|-----------------------------------------------------|------------|----------------------------------------------------|
| `src/core/domains/ats-domains.ts`                                              | 15-entry blocklist + `isAtsDomain`                  | VERIFIED   | 45 LOC, 11 unit tests; consumed by schema.ts       |
| `src/features/applications/schema.ts`                                          | Zod schemas + per-EventType data + `eventDataSchemaFor` | VERIFIED | 195 LOC, 31 unit tests, 17 exports                 |
| `src/features/applications/service.ts`                                         | createApplication + applyManual + applyAuto + undo  | VERIFIED   | 335 LOC, 20 integration tests, 4 mutations         |
| `src/features/applications/queries.ts`                                         | List + detail + counts queries                      | VERIFIED   | 167 LOC, listSortSchema added per WR-01            |
| `src/features/applications/status-transitions.ts`                              | `STATUS_RANK` + `isStatusRegression`                | VERIFIED   | 52 LOC, 53 tests (36-cell truth table)             |
| `src/features/applications/stages-service.ts`                                  | addStage + updateStage + completeStage              | VERIFIED   | 239 LOC, 11 integration tests                      |
| `src/features/applications/notes-service.ts`                                   | updateApplicationNotes (autosave + no-op)           | VERIFIED   | 88 LOC, 5 integration tests                        |
| `src/features/applications/actions.ts`                                         | 6 Server Actions (parse → auth → service)           | VERIFIED   | 296 LOC, all 6 call requireUser() + safeParse      |
| `src/features/applications/components/new-application-form.tsx`                | Capture form (CAPT-01)                              | VERIFIED   | 273 LOC, useActionState, datalist autocomplete     |
| `src/features/applications/components/application-list.tsx`                    | List + chip filter + sort (APP-01)                  | VERIFIED   | 173 LOC, 6 unit tests on toggleStatusInUrl         |
| `src/features/applications/components/application-detail.tsx`                  | Detail composition (APP-02..04)                     | VERIFIED   | 67 LOC, composes 4 children                        |
| `src/features/applications/components/timeline.tsx`                            | Chronological merge + cyan auto-update visual       | VERIFIED   | 173 LOC, conditional View source email branch      |
| `src/features/applications/components/status-dropdown.tsx`                     | Manual status change UI (APP-03)                    | VERIFIED   | 86 LOC, hidden-form-per-item progressive enhancement |
| `src/features/applications/components/stage-editor.tsx`                        | Inline stage edit + complete buttons (APP-04)       | VERIFIED   | 232 LOC, blur-saves per WR-02 fix                  |
| `src/features/applications/components/notes-editor.tsx`                        | Autosave-on-blur notes textarea (APP-04)            | VERIFIED   | 53 LOC, requestSubmit() on blur                    |
| `src/app/applications/page.tsx`                                                | Server page → list                                  | VERIFIED   | 64 LOC, listSortSchema.safeParse + parallel queries |
| `src/app/applications/new/page.tsx`                                            | Server page → capture form                          | VERIFIED   | withRls company datalist, requireUser              |
| `src/app/applications/[id]/page.tsx`                                           | Server page → detail                                | VERIFIED   | 33 LOC, notFound() on cross-tenant                 |
| `tests/integration/applications-rls-isolation.test.ts`                         | Cross-tenant isolation closeout                     | VERIFIED   | 6 tests covering company/app/event/stage/note isolation |
| `docs/decisions/0012-status-regression-block-and-auto-update-styling.md`        | ADR locking regression block + visual treatment     | VERIFIED   | 247 LOC, 6 Nygard sections, cites status-transitions ×7 + timeline ×7 |
| `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md`              | Pre-merge UAT artifact                              | VERIFIED   | 113 LOC, 21 rows (1 PASS + 20 DEFERRED)            |

### Key Link Verification

| From                            | To                                                | Via                                                 | Status     | Details                                                                       |
|---------------------------------|---------------------------------------------------|-----------------------------------------------------|------------|-------------------------------------------------------------------------------|
| `actions.ts`                    | `service.ts` (createApplication, applyManual)     | direct import + invocation                          | WIRED      | Server Actions call services after parse + requireUser                        |
| `actions.ts`                    | `stages-service.ts`, `notes-service.ts`           | direct import                                       | WIRED      | All four stage/notes mutations exposed to UI via Server Actions               |
| `service.ts`                    | `withRls` (`@/core/db/with-rls`)                  | direct import                                       | WIRED      | All 4 mutations run inside `withRls(userId, async tx => …)`                  |
| `service.ts`                    | `eventDataSchemas` from `schema.ts`               | direct import + parse on every Event.data write    | WIRED      | Including emailId on `auto_status_changed.strictObject` (Phase 4 contract)    |
| `service.ts`                    | `isStatusRegression` from `status-transitions.ts` | direct import + call inside `applyAutoStatusChange` | WIRED      | Single regression-guard call site (line 191)                                  |
| `schema.ts`                     | `isAtsDomain` from `core/domains/ats-domains.ts`  | direct import + superRefine in 2 schemas           | WIRED      | CAPT-02 enforced at schema boundary                                           |
| `app/applications/page.tsx`     | `findApplicationsForList`, `countApplicationsByStatus` | direct import + parallel `Promise.all`         | WIRED      | Server Component reads via tenant-scoped queries                              |
| `app/applications/[id]/page.tsx`| `findApplicationDetail`                           | direct import + `notFound()` on null               | WIRED      | RLS-protected read; cross-tenant maps to 404                                  |
| `application-detail.tsx`        | `Timeline`, `StatusDropdown`, `StageEditor`, `NotesEditor` | composition                                | WIRED      | Server Component renders 1 timeline + 3 client islands                        |
| `timeline.tsx`                  | `eventDataSchemaFor` from `schema.ts`             | direct import + safeParse on every event           | WIRED      | Per-EventType discriminated parsing on read                                   |

### Data-Flow Trace (Level 4)

| Artifact                       | Data Variable               | Source                                                         | Produces Real Data | Status     |
|--------------------------------|------------------------------|----------------------------------------------------------------|--------------------|------------|
| `application-list.tsx`         | `items`                     | `findApplicationsForList` → `tx.application.findMany` (RLS)    | Yes                | FLOWING    |
| `application-list.tsx`         | `counts`                    | `countApplicationsByStatus` → `tx.application.groupBy` + `count` | Yes              | FLOWING    |
| `application-detail.tsx`       | `detail`                    | `findApplicationDetail` → 1 findUnique + 3 parallel findMany   | Yes                | FLOWING    |
| `timeline.tsx`                 | `events`, `stages`, `emails`| props from detail                                              | Yes (emails empty until Phase 4) | FLOWING |
| `stage-editor.tsx`             | `stages`                    | props from detail                                              | Yes                | FLOWING    |
| `notes-editor.tsx`             | `initialNotes`              | `application.notes` from detail                                | Yes                | FLOWING    |
| `status-dropdown.tsx`          | `currentStatus`             | `application.canonicalStatus` from detail                      | Yes                | FLOWING    |

No artifacts are HOLLOW. The "View source email" link branch in `timeline.tsx` is intentionally a no-op until Phase 4 wires Gmail (`emailId` is always null on real Phase 2 data); this is documented in ADR-0012 and KNOWN STUBS in 02-04-SUMMARY.md.

### Behavioral Spot-Checks

| Behavior                                          | Command                                                                    | Result                                | Status |
|---------------------------------------------------|----------------------------------------------------------------------------|---------------------------------------|--------|
| Pre-commit lint passes                            | `pnpm lint`                                                                | "ESLint: No issues found"             | PASS   |
| Pre-commit typecheck passes                       | `pnpm typecheck`                                                           | clean (`tsc --noEmit`, 0 errors)      | PASS   |
| Pre-commit tests pass                             | `pnpm test:run`                                                            | "12 passed (12) / 158 passed | 4 todo (162)" | PASS |
| Pre-commit build passes                           | `pnpm build`                                                               | "Compiled successfully", 6 routes (`/`, `/_not-found`, `/applications`, `/applications/[id]`, `/applications/new`, `/login`) | PASS |
| Dependency graph clean                            | `pnpm depcheck`                                                            | 0 errors, 1 warning (`src/middleware.ts` orphan, pre-existing carry-forward) | PASS |
| Phase 4 service contract grep                     | `grep -c "applyAutoStatusChange\|undoStatusChange" src/features/applications/service.ts` | 2 matches                | PASS   |
| ATS-domain wiring grep                            | `grep -n "isAtsDomain" src/features/applications/schema.ts`                | 3 matches (import + 2 superRefine sites) | PASS  |
| Auto-update visual classes grep                   | `grep -n "bg-cyan-50\|border-cyan-600\|Auto-updated from email\|View source email" src/features/applications/components/timeline.tsx` | 8 matches (impl + comments) | PASS |
| Single `withRls` per service mutation             | `grep -n "withRls" src/features/applications/service.ts`                   | 4 mutation sites + 1 import          | PASS   |
| `eventDataSchemaFor` used on read                 | `grep -n "eventDataSchemaFor" src/features/applications/components/timeline.tsx` | 2 calls (describeEvent + source-email branch) | PASS |

### Requirements Coverage

| Requirement | Source Plan(s)        | Description                                                                                              | Status     | Evidence                                                                                          |
|-------------|----------------------|----------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| CAPT-01     | 02-04                | Manual capture <30s via /applications/new                                                                | needs_human| Form code complete; <30s requires browser stopwatch (UAT-02-05).                                  |
| CAPT-02     | 02-01, 02-04         | ATS domains rejected client+server                                                                       | needs_human| Schema-layer Zod superRefine + service re-parse + 11 ATS unit tests; inline error display in browser (UAT-02-06). |
| CAPT-03     | 02-02                | Submission creates Application + Event(created) in one transaction                                       | VERIFIED   | `service.ts:createApplication` integration-tested (CR1, single-tx + tenant isolation via CR6).    |
| APP-01      | 02-04                | List view filter+sort+counts                                                                             | needs_human| Code complete; 6 toggleStatusInUrl unit tests + listSortSchema; chip round-trip needs browser (UAT-02-11..12). |
| APP-02      | 02-04                | Detail timeline + auto-update visual distinction                                                         | needs_human| `timeline.tsx` rendering branches grep-verified; cyan visual needs eye check (UAT-02-10).         |
| APP-03      | 02-02, 02-04         | Status dropdown                                                                                          | needs_human| `applyManualStatusChange` integration-tested (M1–M4); dropdown UI behavior browser (UAT-02-07).   |
| APP-04      | 02-03, 02-04         | Add/edit/complete stages inline + notes; lastActivityAt bumps                                            | needs_human| Stage + notes services 16 tests green; inline edit+autosave UX needs browser (UAT-02-08..09).     |

All 7 Phase 2 requirements are satisfied at the code+test layer. 6 of 7 require browser confirmation per the UAT-02 deferral decision (mirrors Phase 1's pattern).

### Anti-Patterns Found

None. Spot-checked Phase 2 source files for:

| Pattern                            | Match Count    | Severity | Notes                                                                                              |
|------------------------------------|----------------|----------|----------------------------------------------------------------------------------------------------|
| TODO/FIXME/XXX/HACK                | 0              | —        | (Searched all `src/features/applications/**` + `src/app/applications/**`)                          |
| `console.log` in components        | 0              | —        | Verified by 02-04 plan check                                                                       |
| `dangerouslySetInnerHTML`          | 0              | —        | No raw HTML rendering paths                                                                        |
| Direct `prisma.*` imports          | 0              | —        | All Prisma access via `withRls`/`tenantDb` (ESLint-enforced)                                       |
| Empty handlers `() => {}`          | 0              | —        | Hidden-form-per-item progressive enhancement instead                                               |
| Hardcoded empty data in renders    | 0              | —        | All renders consume Server Component query results (Level 4 trace confirms FLOWING)                |
| "View source email" stub branch    | 1 (intentional)| ℹ️ Info  | Documented in ADR-0012; renders no-op until Phase 4 wires Gmail data (emailId always null in Phase 2). Not a defect — locked decision. |

The previous code review (02-REVIEW.md) flagged 4 warnings (WR-01..04) which were all addressed in 02-REVIEW-FIX.md (commits 139349c, aae7bcc, f4a3381, 7bb86a3). 8 info-level findings remain as documented stylistic / future-extraction notes; none block the goal.

### Human Verification Required

12 items deferred to pre-merge UAT walkthrough — already structured in `.planning/phases/02-applications-slice-manual-tracker/02-UAT.md`. Reproduced for the verifier's convenience:

1. **UAT-02-01 — `pnpm dev` boots without errors**
   - Run `pnpm dev`. Server should start on http://localhost:3000 with no errors.

2. **UAT-02-02 — Sign in via /login lands on /applications**
   - Visit `/login`, enter `APP_PASSWORD` from local `.env`. Should redirect to `/applications`.

3. **UAT-02-03 — Empty state CTA reachable**
   - Empty `/applications` → see "No forays yet — Capture your first foray" CTA. CTA links to `/applications/new`.

4. **UAT-02-04 — Capture form fillable**
   - On `/applications/new`, fill: Company "Stripe", Role "Senior Product Manager", Source "linkedin", click Save foray.

5. **UAT-02-05 — <30s capture + redirect + detail renders (CAPT-01)**
   - Stopwatch from form-on-screen to redirect: must be < 30s. Detail renders header, status badge "Applied", empty stages, empty notes, single timeline entry "Foray created".

6. **UAT-02-06 — ATS-domain rejection (CAPT-02)**
   - On `/applications/new`, set companyDomain to `greenhouse.io`. Submit → inline error matches ATS-domain message ("That looks like an ATS domain (greenhouse.io). Use the company's actual domain..."). Change to `greenhouse-inc.com` → submits.

7. **UAT-02-07 — Status dropdown writes Event + bumps lastActivityAt (APP-03)**
   - On a detail page, click "Change status" → "Screening". Badge updates; timeline gains row "Status changed: applied → screening". Return to `/applications`; the foray's lastActivityAt visibly updated.

8. **UAT-02-08 — Stage editor Add + Mark passed (APP-04)**
   - On detail page, click "Add stage", type "Recruiter call", click Add → stage appears. Click "Mark passed" → outcome shown; new timeline entry "Stage completed (passed)".

9. **UAT-02-09 — Notes autosave on blur + persistence (APP-04)**
   - Type a note in textarea. Click outside (blur) → "Saved" indicator briefly appears; timeline gains "Note updated" entry. Refresh page → note persists.

10. **UAT-02-10 — Auto-update visual: cyan rail + label, no icon, no source-email link (APP-02 + ADR-0012)**
    - Run `pnpm tsx scripts/dev/insert-fake-auto-event.ts`. Refresh detail page for the application receiving the event. Confirm row has: cyan-tinted background (`bg-cyan-50`), 2px cyan-600 left rail, "Auto-updated from email" label in muted secondary, NO icon, NO "View source email" link (because emailId is undefined).

11. **UAT-02-11 — Chip filter toggle + Reset (APP-01)**
    - `/applications?status=rejected` → "No forays match this filter." Click an active chip → it removes from URL. Click an inactive chip → adds. Click Reset → URL goes back to `/applications`.

12. **UAT-02-12 — Sort URL toggle (APP-01)**
    - `/applications?sort=appliedAt:desc` → order changes (most-recently-applied first). Click sort label → flips back to `lastActivityAt:desc`.

### Gaps Summary

No code-layer gaps. All 5 ROADMAP success criteria are wired through the code; criterion 5 (Phase 4 service contracts) is fully VERIFIED automatically. Criteria 1–4 require pre-merge browser walkthrough — this is the agreed Phase 2 close-out shape (mirrors Phase 1's `01-HUMAN-UAT.md`, where 12/14 items verified automatically and 2 deferred to pre-merge).

The 4 review warnings (WR-01 through WR-04) are all closed:
- **WR-01** (unsafe `as ListSort` cast) → fixed via `listSortSchema` Zod enum (commit 139349c).
- **WR-02** (stage editor blur drops input) → fixed by mirroring notes-editor pattern (commit aae7bcc).
- **WR-03** (sort `:asc` dead code) → narrowed to `:desc` only per Lean scope (commit f4a3381) + CONTEXT updated.
- **WR-04** (archived count miswired) → archived rendered as sibling label, not per-chip suffix (commit 7bb86a3).

The 8 info findings (IN-01..IN-08) are documented stylistic/future-extraction notes; none block the goal and per the review's `critical_warning` scope are intentionally deferred.

## Recommendation

**Run pre-merge UAT.** Phase 2 is code-complete and pre-commit-gate-green: 158 tests pass, lint + typecheck + build + depcheck all clean, every artifact exists at the expected path, every key link is wired, and every data flow produces real data. The remaining gate is owner-driven browser verification of 12 visual/interactive items — already structured in 02-UAT.md.

After UAT approval (flip 20 DEFERRED rows to PASS in 02-UAT.md), Phase 2 is mergeable to `main` and Phase 3 (Classifier + Matcher) can begin (its only Phase 2 dependency, `applyAutoStatusChange` + `Event.data` Zod schemas, is criterion-5-VERIFIED right now).

---

_Verified: 2026-05-09_
_Verifier: Claude (gsd-verifier)_
