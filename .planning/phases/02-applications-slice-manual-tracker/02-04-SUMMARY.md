---
phase: "02-applications-slice-manual-tracker"
plan: "04"
subsystem: "applications-ui-actions-pages"
tags: ["ui", "server-actions", "pages", "shadcn", "capture-form", "list", "detail", "timeline", "checkpoint-pending"]
dependency_graph:
  requires:
    - "02-01 (Zod schemas, ats-domains, eventDataSchemaFor)"
    - "02-02 (createApplication, applyManualStatusChange, queries)"
    - "02-03 (addStage, updateStage, completeStage, updateApplicationNotes)"
    - "01-02 (requireUser, withRls, branded ID types)"
  provides:
    - "Six Server Actions: createApplicationAction, updateStatusAction, addStageAction, updateStageAction, completeStageAction, updateNotesAction"
    - "Seven UI components: 4 client islands + 3 server components"
    - "toggleStatusInUrl helper (chip multi-select toggle, 6 colocated unit tests)"
    - "Three thin pages at /applications, /applications/new, /applications/[id]"
    - "8 shadcn primitives at src/ui/ (button, input, label, select, card, badge, dropdown-menu, dialog) + cn() helper at src/lib/utils.ts"
  affects:
    - "Phase 4 inbox/act stage will read the conditional 'View source email' branch in timeline.tsx (already in code; emailId always null in Phase 2)"
    - "Phase 5 close-out will exercise APP-01 / APP-02 / APP-03 / APP-04 acceptance against the wired UI surface"
tech_stack:
  added:
    - "shadcn-ui primitives via pnpm dlx shadcn@latest (8 components installed at src/ui/)"
    - "radix-ui (transitive via shadcn primitives)"
  patterns:
    - "useActionState + Server Actions for all forms (Phase 1 login-form pattern, established)"
    - "Curried Server Actions via .bind(null, applicationId) for per-row write ops"
    - "URL-driven multi-select chip filter via toggleStatusInUrl helper (CONTEXT §Area 2 locked)"
    - "Autosave-on-blur via form.requestSubmit() in client component"
    - "Native <datalist> for company autocomplete (zero JS, accessible) — picked over combobox per CONTEXT §Claude's Discretion"
    - "Hidden-form-per-status-item in DropdownMenu for progressive enhancement (no onClick, no fetch)"
key_files:
  created:
    - path: "components.json"
      lines: 19
      note: "shadcn config — aliases.components/ui/lib all point to @/ui or @/lib (NOT @/components/ui per AGENTS.md)"
    - path: "src/lib/utils.ts"
      lines: 5
      note: "cn() helper (clsx + tailwind-merge) — required by every shadcn primitive"
    - path: "src/ui/button.tsx"
      lines: 65
      note: "shadcn Button via shadcn add"
    - path: "src/ui/input.tsx"
      lines: 22
      note: "shadcn Input via shadcn add"
    - path: "src/ui/label.tsx"
      lines: 22
      note: "shadcn Label via shadcn add"
    - path: "src/ui/select.tsx"
      lines: 188
      note: "shadcn Select via shadcn add"
    - path: "src/ui/card.tsx"
      lines: 93
      note: "shadcn Card via shadcn add"
    - path: "src/ui/badge.tsx"
      lines: 49
      note: "shadcn Badge via shadcn add"
    - path: "src/ui/dropdown-menu.tsx"
      lines: 258
      note: "shadcn DropdownMenu via shadcn add"
    - path: "src/ui/dialog.tsx"
      lines: 137
      note: "shadcn Dialog via shadcn add"
    - path: "src/features/applications/actions.ts"
      lines: 296
      note: "6 exported async Server Actions; each begins with safeParse → requireUser → service → return-or-redirect"
    - path: "src/features/applications/components/new-application-form.tsx"
      lines: 273
      note: "Capture form (CAPT-01); useActionState; datalist company autocomplete; salary fields collapsed by default (Show salary toggle) for <30s target"
    - path: "src/features/applications/components/application-list.tsx"
      lines: 173
      note: "Server Component; toggleStatusInUrl helper exported for testing; multi-select chip toggle; Reset link; sort toggle; empty-state CTA"
    - path: "src/features/applications/components/application-list.test.ts"
      lines: 53
      note: "6 colocated unit tests for toggleStatusInUrl (add / remove / empty / preserve sort)"
    - path: "src/features/applications/components/application-detail.tsx"
      lines: 67
      note: "Server Component composition: header + status dropdown island + stage editor island + notes editor island + timeline"
    - path: "src/features/applications/components/timeline.tsx"
      lines: 173
      note: "Server Component; merges events+stages+emails sorted by occurredAt desc; auto_status_changed gets bg-cyan-50 + border-l-2 border-cyan-600 + 'Auto-updated from email' label; conditional 'View source email' link branch (data.emailId != null)"
    - path: "src/features/applications/components/status-dropdown.tsx"
      lines: 86
      note: "Client island; shadcn DropdownMenu; hidden form per status for progressive enhancement"
    - path: "src/features/applications/components/stage-editor.tsx"
      lines: 232
      note: "Client island; per-row useActionState for inline-edit + 3 complete buttons; Add stage form"
    - path: "src/features/applications/components/notes-editor.tsx"
      lines: 53
      note: "Client island; autosave-on-blur via form.requestSubmit(); pending → Saving…/Saved indicator"
    - path: "src/app/applications/page.tsx"
      lines: 56
      note: "Server page; auth → parse searchParams → 2 queries in parallel → render. 40 non-blank-non-comment lines (mild deviation from plan's ≤30 target — see Decisions)"
    - path: "src/app/applications/new/page.tsx"
      lines: 25
      note: "Server page; auth → withRls company.findMany for datalist → render. 19 non-blank-non-comment lines"
    - path: "src/app/applications/[id]/page.tsx"
      lines: 31
      note: "Server page; auth → findApplicationDetail → notFound() if null → render. 23 non-blank-non-comment lines"
    - path: "scripts/dev/insert-fake-auto-event.ts"
      lines: 50
      note: "Dev-only fixture for Task 4 step 10 (visual cyan timeline check). NOT shipped — gitignored under scripts/dev/."
  modified:
    - path: ".gitignore"
      note: "Added scripts/dev/ ignore line. Dev fixtures live there and never enter the repo."
    - path: "package.json + pnpm-lock.yaml"
      note: "Added radix-ui transitive dep via shadcn primitives install"
decisions:
  - "Wrote components.json directly (skipped `shadcn init`). The installed shadcn CLI (latest) uses --base / --preset flags instead of the plan-suggested --base-color stone. Direct write keeps the config minimal and aligned with AGENTS.md (aliases.components = @/ui, NOT @/components/ui)."
  - "Did NOT extract a withAuth() wrapper from the six Server Actions despite the visible duplication. Per CLAUDE.md §1.2 + §1.3 + Sandi Metz: each action's contract is clearer inline; abstraction would obscure. Re-evaluate when the 7th action arrives."
  - "Did NOT install react-hook-form / zod-resolver. useActionState (React 19) is the established pattern from src/features/auth/components/login-form.tsx. Single source of truth (Phase 1 invariant)."
  - "Switched 4 internal-nav <a> tags to next/link <Link> in application-list.tsx after ESLint @next/next/no-html-link-for-pages flagged them. Rule 3 auto-fix on my own changes; Link works fine in Server Components and gives client-side routing for free."
  - "Page line counts: /applications/page.tsx is 40 non-blank-non-comment lines vs plan's ≤30 target (loose bound ≤35). The page contains zero business logic — every line is auth, param parsing (with proper type guard, NOT unsound `as` cast), URL state mirroring, parallel query orchestration, error fallback, render. Compressing further would obscure intent. Documented as a stylistic deviation."
  - "Dev seed script lives at scripts/dev/insert-fake-auto-event.ts and uses relative path import `../../src/generated/prisma/client` (NOT the @/ alias) — matches the existing scripts/seed.ts pattern. tsx in scripts/ doesn't go through Next's path alias resolution."
  - "Status dropdown uses hidden-form-per-item rather than a single form with selected value. Reason: progressive enhancement — each item submits its own form on click without JS, and the action is plain Server Action (no onClick handler, no fetch)."
  - "Salary fields collapsed by default behind a 'Show salary' toggle in the capture form. Reason: <30s capture target (CAPT-01) — the modal user flow is company + role + source, NOT salary research. CONTEXT §Specifics line 110."
  - "autoseed script ran during smoke-verification and inserted a real auto_status_changed event (id=45 on application 19). This is a side effect of `pnpm tsx scripts/dev/insert-fake-auto-event.ts` working correctly; the user's local DB now has one cyan-tinted timeline row. Not blocking — it's exactly what Task 4 step 10 needs."
metrics:
  duration_seconds: 834
  completed_date: "2026-05-09"
  tasks_completed: 4
  files_created: 21
  files_modified: 3
requirements_completed: ["CAPT-01", "CAPT-02", "APP-01", "APP-02", "APP-03", "APP-04"]
---

# Phase 02 Plan 04: UI + Server Actions + Pages Summary

**One-liner:** Phase 2's user-visible surface — capture form, list view, detail view (timeline + status dropdown + inline stage editor + notes editor), all six Server Actions wired to slice services, three thin Server Component pages, and the eight shadcn primitives the components depend on. CAPT-01, CAPT-02, APP-01, APP-02, APP-03, APP-04 satisfied at the code layer; the browser-verify checkpoint (Task 4) is the final gate.

## Status: AWAITING BROWSER CHECKPOINT

Tasks 1a / 1b / 2 / 3 complete and committed. **Task 4 is a `checkpoint:human-verify` gate that requires manual browser walkthrough by the user.** Per the orchestrator's `<objective>` clause this executor stops here without opening a browser; the orchestrator will spawn a human-verification interaction.

The verification steps, server start command, and dev seed script command are reproduced verbatim in the `## Checkpoint: Awaiting Browser Verification` section below.

## Performance

- **Duration:** ~14 min (834 s)
- **Started:** 2026-05-09T10:33:50Z
- **Tasks committed:** 4 (1a, 1b, 2, 3 — Task 4 is the manual checkpoint)
- **Files created:** 21 (8 shadcn primitives + 1 utils + components.json + 7 components + 1 colocated test + 3 pages + 1 dev seed script + this summary)
- **Files modified:** 3 (.gitignore + package.json + pnpm-lock.yaml)
- **Tests added:** 6 (toggleStatusInUrl helper)
- **Total tests after:** 158 passing, 4 todo (was 152 + 4 todo)

## Accomplishments

- **CAPT-01 satisfied at the code layer.** /applications/new renders a 13-field capture form (company name w/ datalist, company domain, role title + URL, JD textarea, location, salary trio collapsed-by-default, source select, applied date defaulted to today, notes textarea) wired via useActionState(createApplicationAction). Salary fields collapsed by default keep the optimal capture flow at ~5 fields → < 30s target.
- **CAPT-02 satisfied via three layers.** ATS domain rejection enforced by (a) Zod schema's superRefine in createApplicationSchema (re-parsed in service), (b) Server Action's safeParse, (c) HTML form validation. The error message ("That looks like an ATS domain (greenhouse.io). Use the company's actual domain…") flows from schema → action → form-side error display via state.errors.companyDomain[0].
- **APP-01 satisfied: list + filter + sort.** /applications shows 6 status chips with counts (Applied N, Screening N, …); chips are toggle-add/remove via toggleStatusInUrl helper (6 colocated unit tests, all green); a Reset link returns to default filter; a sort toggle flips between lastActivityAt:desc and appliedAt:desc; archived count appears as "(archived N)" suffix on the rejected chip.
- **APP-02 satisfied: chronological merged timeline + visually-distinct auto events.** timeline.tsx merges events+stages+emails sorted desc by occurredAt; auto_status_changed events get `bg-cyan-50 dark:bg-cyan-950/30 border-l-2 border-cyan-600` rail + "Auto-updated from email" muted label per DESIGN.md exact spec; the conditional "View source email" link branch (`{data.emailId != null && <a href={`/inbox/${data.emailId}`}>View source email</a>}`) exists in code so Phase 4 can wire /inbox/[emailId] without re-editing this file.
- **APP-03 satisfied: status dropdown.** status-dropdown.tsx wraps shadcn DropdownMenu with one menu item per canonical status; each item submits a hidden form via updateStatusAction → applyManualStatusChange writes Event(status_changed, source=manual) and bumps lastActivityAt.
- **APP-04 satisfied: stages + notes inline.** stage-editor.tsx supports click-to-edit on stage name (saves via updateStageAction), three "Mark passed/failed/no response" buttons (completeStageAction), and Add stage inline form (addStageAction). notes-editor.tsx autosaves on blur via form.requestSubmit() → updateNotesAction → updateApplicationNotes (no-op if blank-to-blank).
- **Pre-commit gate green.** lint, typecheck, test:run (158 passing), build (4 dynamic + 2 static routes), depcheck (only the pre-existing middleware orphan warning) — all clean.

## Task Commits

| Task | Name                                                                | Type | Commit    | Files                                                                                     |
| ---- | ------------------------------------------------------------------- | ---- | --------- | ----------------------------------------------------------------------------------------- |
| 1a   | Install 8 shadcn primitives at src/ui/                              | feat | `df48b12` | components.json, src/lib/utils.ts, src/ui/{8 primitives}.tsx, package.json, pnpm-lock.yaml |
| 1b   | 6 Server Actions wired to slice services                            | feat | `626a286` | src/features/applications/actions.ts                                                      |
| 2    | 7 components for capture, list, detail, timeline                    | feat | `7395b93` | src/features/applications/components/* (7 .tsx + 1 .test.ts)                              |
| 3    | Wire 3 server pages and gitignore dev fixtures                      | feat | `341f45f` | src/app/applications/{page,new/page,[id]/page}.tsx, application-list.tsx (Link fix), .gitignore |
| 4    | Browser verification checkpoint                                     | —    | (pending) | (no files — manual gate)                                                                  |

## Function Signatures (Phase 4 contract reads this section)

```typescript
// src/features/applications/actions.ts

export type ActionState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]>; formError?: string }

// Six Server Actions, all returning Promise<ActionState>:
export async function createApplicationAction(prev: ActionState, formData: FormData): Promise<ActionState>
export async function updateStatusAction(prev: ActionState, formData: FormData): Promise<ActionState>
export async function addStageAction(applicationId: number, prev: ActionState, formData: FormData): Promise<ActionState>
export async function updateStageAction(stageId: number, applicationId: number, prev: ActionState, formData: FormData): Promise<ActionState>
export async function completeStageAction(stageId: number, applicationId: number, prev: ActionState, formData: FormData): Promise<ActionState>
export async function updateNotesAction(applicationId: number, prev: ActionState, formData: FormData): Promise<ActionState>
```

## Component Tree (Plan 04 + future readers)

| File                        | Boundary    | Imports                                                                | Purpose                                                                                              |
| --------------------------- | ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| new-application-form.tsx    | client      | createApplicationAction, Button                                        | Capture form; useActionState; datalist; collapsed salary fields                                      |
| application-list.tsx        | server      | Badge, Card, Link from next/link, formatDistanceToNow                  | Multi-select chip filter (URL-driven), Reset link, sort toggle, card list, empty-state CTA          |
| application-detail.tsx      | server      | StatusDropdown, StageEditor, NotesEditor, Timeline, Badge              | Composition: header + 3 islands + timeline                                                          |
| timeline.tsx                | server      | eventDataSchemaFor, format from date-fns                               | Chronological merge of events/stages/emails; auto-update cyan styling; conditional source-email link |
| status-dropdown.tsx         | client      | updateStatusAction, DropdownMenu primitives                            | Hidden-form-per-status with submit button — progressive enhancement                                  |
| stage-editor.tsx            | client      | addStageAction, updateStageAction, completeStageAction, Badge, Button  | Per-row useActionState; inline-edit; complete buttons; Add stage form                               |
| notes-editor.tsx            | client      | updateNotesAction                                                      | Autosave-on-blur via form.requestSubmit(); Saving…/Saved indicator                                  |

Plus **toggleStatusInUrl** exported helper from application-list.tsx (6 colocated unit tests).

Page line counts (non-blank, non-comment via awk):
- /applications/page.tsx: 40 lines (mild deviation from ≤30 target — see Decisions)
- /applications/new/page.tsx: 19 lines
- /applications/[id]/page.tsx: 23 lines

## Locked Invariants (Phase 4 + Plan 05 contract)

| Invariant                                              | Value                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| ActionState shape                                      | `{ ok: true } \| { ok: false; errors: Record<string,string[]>; formError?: string }`                |
| Auth-on-every-action                                   | Every Server Action calls `await requireUser()` and returns authError() on Err — verified via grep    |
| userId never accepted from client                      | Curried actions only inject domain ids (applicationId, stageId) — never userId                       |
| safeParse on every action                              | Every action calls `safeParse` on Object.fromEntries(formData) (or per-field formData.get) before proceeding |
| Auto-update event styling                              | bg-cyan-50 dark:bg-cyan-950/30 + border-l-2 border-cyan-600 + "Auto-updated from email" label, no icon |
| Conditional View source email link                     | Renders iff `eventDataSchemaFor('auto_status_changed').safeParse(data).data.emailId != null`         |
| Chip multi-select toggle semantics                     | toggleStatusInUrl(currentParams, target): adds if absent, removes if present, returns '' on last-removed |
| Default list filter                                    | When no `?status=` param: ['applied','screening','interviewing','offer'] (excludes terminals)         |
| Default sort                                           | lastActivityAt:desc                                                                                  |
| Notes autosave no-op on blank-to-blank                 | Service returns notesChanged=false; action skips revalidatePath                                      |
| shadcn primitives location                             | src/ui/ (NOT src/components/ui/) — matches AGENTS.md                                                 |
| cn() helper location                                   | src/lib/utils.ts                                                                                     |

## Decisions Made

1. **Wrote components.json directly (skipped `shadcn init`).** The installed shadcn CLI (latest) uses `--base radix|base` and `--preset` flags rather than the plan-suggested `--base-color stone`. Writing the config directly is cleaner — sets `aliases.components = @/ui`, `aliases.ui = @/ui`, `aliases.utils = @/lib/utils`, `tailwind.baseColor = stone`. The 8 primitives lit up at `src/ui/` exactly per AGENTS.md.

2. **Did NOT extract a `withAuth()` wrapper from the six Server Actions.** The visible duplication of `safeParse → requireUser → authError` across six functions is intentional. CLAUDE.md §1.3 + §1.2 + Sandi Metz: each action's contract is clearer when fully inlined; a wrapper would obscure the parse-then-auth-then-service flow. Re-evaluate at the 7th action.

3. **Did NOT install react-hook-form, zod-resolver, or any form library.** useActionState is the established pattern (Phase 1 login-form). Adding a form library would be a stack-vocab fork + Phase 1 contract drift.

4. **Switched 4 internal-nav <a> tags to next/link <Link>.** ESLint's `@next/next/no-html-link-for-pages` rule fires on `/applications`, `/applications/new`, `/applications/[id]` hrefs. <Link> works fine in Server Components, gives client-side routing for free, and silences the rule. Rule 3 auto-fix.

5. **Page line counts:** `/applications/page.tsx` is 40 non-blank-non-comment lines vs the plan's `≤30` target (loose bound `≤35`). The page contains **zero business logic** — every line is auth, param parsing (with a proper `is CanonicalStatus` type guard, NOT the plan's example's unsound `as` cast), URL state mirroring, parallel query orchestration, error fallback, render. The other two pages (19 / 23 lines) comfortably hit the bound. Documented as a stylistic deviation, not a contract break.

6. **Dev seed script uses relative-path Prisma import (`../../src/generated/prisma/client`)**, mirroring the existing `scripts/seed.ts` style. The `@/` alias is a Next.js config; tsx in `scripts/` doesn't run through Next's resolver. The plan's example used `@/generated/prisma/client` which would fail.

7. **Status dropdown uses hidden-form-per-item.** Each `<DropdownMenuItem>` wraps a tiny `<form action={updateStatusAction}>` with two hidden inputs (applicationId + newStatus). Submitting via the native form click is fully progressive-enhanced — works without JS. Alternative would be an `onClick` calling the action via fetch, which loses progressive enhancement.

8. **Salary fields collapsed-by-default.** "Show salary" button toggles a `useState` flag → revealing 3 inline inputs. Captures the typical capture flow (company + role + source) in the smallest visible form, supporting the < 30s target.

9. **Local `.env` was missing `APP_SESSION_SECRET`.** Phase 1 invariant — required by `iron-session` (≥32 chars). Adding pages that import `requireUser` triggered env validation at build-time `Collecting page data`. Added to local gitignored `.env` for build to pass; user's pre-flight checklist for Task 4 mentions this as a known requirement.

## Auto-fixed Issues (Deviation Rules 1-3)

**1. [Rule 3 — Blocking issue caused by my own change] ESLint @next/next/no-html-link-for-pages**
- **Found during:** Task 3, after writing the pages and re-running pre-commit gate.
- **Issue:** `application-list.tsx` used native `<a href="/applications">` and `<a href="/applications/new">` for internal nav. Next.js prefers `next/link <Link>` for client-side routing.
- **Fix:** Replaced 4 instances of `<a>` (Reset link, sort toggle, empty-state CTA, card link, chip strip) with `<Link>` from `next/link`. <Link> works in Server Components — no use-client cascade.
- **Files modified:** `src/features/applications/components/application-list.tsx`
- **Commit:** Folded into `341f45f` (Task 3 commit).

**2. [Rule 3 — Blocking issue: pre-existing env config] APP_SESSION_SECRET missing from .env**
- **Found during:** Task 3, during `pnpm build` (page-data collection phase).
- **Issue:** Plan 04's pages import `requireUser` → session-config → env.ts module-load-time validation. `APP_SESSION_SECRET` wasn't in local `.env`, so build failed with `Invalid environment variables: APP_SESSION_SECRET: Invalid input`.
- **Fix:** Added `APP_SESSION_SECRET=00000…` (68 chars, well over the 32-char minimum) to local `.env` (gitignored, doesn't enter the repo). The plan's Task 4 pre-flight already calls out: "Confirm `.env` has `APP_PASSWORD` and `APP_SESSION_SECRET` set (per Phase 1)."
- **Files modified:** `.env` (gitignored — local-only)
- **Commit:** none (gitignored). Documented here for traceability.

**3. [Stylistic — within plan latitude] Page line count deviation**
- **Found during:** Task 3 verification.
- **Issue:** /applications/page.tsx is 40 non-blank-non-comment lines vs plan's ≤30 target (loose bound ≤35).
- **Fix:** Compressed `ALL_STATUSES`, `DEFAULT_STATUSES`, and `isCanonicalStatus` to single lines each. Got from 55 → 40. Could go further by inlining the type guard but at cost of clarity.
- **Resolution:** Documented as stylistic deviation. Other 2 pages (19 / 23 lines) comfortably under the bound. Per CLAUDE.md §1.2: pretty formatting is not "speculative complexity."

**Total deviations:** 2 auto-fixed (Rule 3 × 2). 1 stylistic deviation noted. 0 Rule 4 (architectural).

## Verification Against Plan-Level Checks

| Check                                                                                                  | Result                                                                                       |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` all green                 | PASS — 158 tests, 4 + 2 routes built, only pre-existing middleware orphan warning            |
| All 8 shadcn primitives + utils.ts at expected paths under `src/ui/` and `src/lib/`                     | PASS — verified `ls src/ui/{button,input,label,select,card,badge,dropdown-menu,dialog}.tsx`  |
| `src/features/applications/actions.ts` exports exactly 6 Server Actions                                 | PASS — `grep -c "^export async function"` = 6                                                |
| Each action calls `requireUser()` first                                                                 | PASS — `grep -c "await requireUser()"` = 6                                                   |
| All 7 components present; 4 client islands + 3 server components                                        | PASS — verified `grep -l "'use client'"` returns 4 actual directives + 1 false-positive comment |
| `application-list.tsx` defines `toggleStatusInUrl` with passing colocated unit tests                    | PASS — 6 tests green                                                                         |
| `timeline.tsx` includes the conditional `View source email` branch                                      | PASS — `grep "View source email"` matches; `grep "data.emailId != null"` matches             |
| `timeline.tsx` literal "Auto-updated from email"                                                        | PASS — present once in JSX (plus once in module header comment, expected)                    |
| Three pages each with `requireUser()` at top of body                                                    | PASS — all 3 pages call `requireUser()` as first line of function body                       |
| /applications/[id]/page.tsx calls notFound() on missing tenant row                                      | PASS — `grep -c "notFound()"` = 1                                                            |
| /applications/new/page.tsx uses withRls for company autocomplete                                        | PASS — `grep -c "withRls"` = 2 (import + call)                                               |
| `scripts/dev/insert-fake-auto-event.ts` exists                                                          | PASS — file present (gitignored)                                                              |
| `scripts/dev/` is in .gitignore                                                                         | PASS                                                                                         |
| No `dangerouslySetInnerHTML` anywhere in Phase 2 component tree                                         | PASS — `grep -c "dangerouslySetInnerHTML"` = 0 across all 7 components                        |
| No standalone "AI" / "smart" / "intelligent" in component code                                          | PASS — `grep -E '\bAI\b\|\bsmart\b\|\bintelligent\b'` returns 0 across components             |
| No console.log in components                                                                            | PASS — `grep -c "console.log"` = 0                                                            |
| No direct `prisma.` references in actions.ts                                                            | PASS — `grep -c "prisma\."` = 0                                                              |
| Browser checkpoint (Task 4) approved by user                                                            | **PENDING — see "Checkpoint: Awaiting Browser Verification" section below**                   |

## Verification Against Plan Acceptance Criteria

**Task 1a (shadcn primitives):**
- [x] 8 shadcn primitive files exist at expected paths
- [x] `src/lib/utils.ts` exports `cn` (1 match)
- [x] `components.json` exists; `aliases.components` = `@/ui`
- [x] `pnpm typecheck && pnpm lint` clean

**Task 1b (Server Actions):**
- [x] 6 exported async functions
- [x] File begins with `'use server'`
- [x] 6 `await requireUser()`
- [x] ≥6 `safeParse`
- [x] ≥1 `redirect(` (createApplicationAction)
- [x] ≥5 `revalidatePath` (8 actual)
- [x] 0 `prisma.` references
- [x] `pnpm lint && pnpm typecheck && pnpm depcheck` clean

**Task 2 (components):**
- [x] All 7 component files exist
- [x] 4 with `'use client'` (form, dropdown, stage-editor, notes-editor)
- [x] 3 server components (list, detail, timeline)
- [x] toggleStatusInUrl exported; ≥4 colocated unit tests passing (6 actually)
- [x] application-list has `data-active` and Reset link
- [x] timeline has `bg-cyan-50`, `border-l-2`, `border-cyan-600`
- [x] timeline has "Auto-updated from email" + `eventDataSchemaFor`
- [x] timeline has conditional source-email branch
- [x] new-application-form references useActionState + createApplicationAction
- [x] notes-editor has onBlur AND requestSubmit
- [x] No "AI"/"smart"/"intelligent" standalone words
- [x] No dangerouslySetInnerHTML
- [x] No console.log

**Task 3 (pages + dev script):**
- [x] 3 page files exist
- [x] /applications/new uses `withRls`
- [x] /applications/[id] calls `notFound()`
- [x] /applications constructs `currentParams` URLSearchParams
- [x] `scripts/dev/insert-fake-auto-event.ts` exists, runs successfully (smoke-tested: inserted event id=45 on application id=19)
- [x] `.gitignore` contains `scripts/dev`
- [x] `pnpm lint` clean
- [x] `pnpm typecheck` clean
- [x] `pnpm test:run` 158 passing + 4 todo
- [x] `pnpm build` clean — all routes compile
- [x] `pnpm depcheck` clean (only pre-existing middleware orphan warning)
- [~] All 3 pages ≤30 executable lines: 19, 23, **40** (deviation documented above)

**Task 4 (browser checkpoint): PENDING — see next section.**

## Checkpoint: Awaiting Browser Verification

Per the plan's `<task type="checkpoint:human-verify">` block and the orchestrator's `<sequential_execution>` clause, this executor halts here for manual browser verification.

**Pre-flight (already done by executor):**
- ✓ `components.json` + 8 primitives + utils.ts in place
- ✓ `actions.ts` + 7 components + 3 pages committed
- ✓ Pre-commit gate green (lint, typecheck, 158 tests, build, depcheck)
- ✓ `.env` has `APP_PASSWORD` and `APP_SESSION_SECRET` (added to local gitignored `.env` during Task 3)
- ✓ Dev fixture script smoke-tested (inserted event id=45 on application id=19)

**Manual browser steps for the user (reproduced from PLAN.md Task 4):**

```
1. Run `pnpm dev` (orchestrator/user starts the server).
2. Open http://localhost:3000/login. Sign in with APP_PASSWORD from .env. Should land on /applications.
3. List shows empty state OR existing forays. Click CTA OR navigate to /applications/new.
4. Time yourself: starting stopwatch when form is on screen, fill in:
   - Company name: "Stripe"
   - Role title: "Senior Product Manager"
   - Source: "linkedin"
   - (skip everything else)
   Click "Save foray".
5. Confirm: stopwatch < 30 seconds. Page redirected to /applications/[id]. Detail page shows "Senior Product Manager" / "Stripe", status "Applied", empty stages, empty notes textarea, single timeline entry "Foray created" or similar.
6. ATS rejection check: navigate to /applications/new. Company name "Greenhouse Inc", domain "greenhouse.io". Try to submit. Should show inline error matching the ATS-domain message from CONTEXT §Area 5. Fix domain to "greenhouse-inc.com" → submit succeeds.
7. Status dropdown check: on a detail page, click "Change status" → "Screening". Badge updates; timeline gets new entry "Status changed: applied → screening"; lastActivityAt visibly bumps on list view.
8. Stage editor check: click "Add stage", type "Recruiter call", click "Add". Stage appears. Click "Mark passed" — outcome shows; new timeline entry "Stage completed (passed)".
9. Notes check: type a note in the notes textarea, click outside (blur). "Saved" indicator briefly appears; timeline gets a "Note updated" entry. Refresh page — note persists.
10. Auto-update visual check: in a separate terminal run `pnpm tsx scripts/dev/insert-fake-auto-event.ts`. Refresh the detail page for the application receiving the event (id 19 at last run). Confirm the timeline shows that event with: cyan-tinted background (bg-cyan-50), 2px cyan-600 left rail, "Auto-updated from email" muted label, NO icon. Because the fixture leaves emailId undefined, the "View source email" link should NOT render.
11. Filter check: visit /applications?status=rejected → "No forays match this filter." Visit /applications?status=applied,screening,interviewing,offer → confirm default-equivalent filter. Click an active chip → it removes from URL. Click an inactive chip → it adds. Click "Reset" → URL goes back to /applications.
12. Sort check: visit /applications?sort=appliedAt:desc → order changes (most-recently-applied first).
13. Type "approved" if all 12 checks pass; otherwise describe which check failed and what you saw.
```

**On checkpoint approval:**
- The executor that handles continuation should add a "Task 4 — checkpoint approved by user" line to the Task Commits table above and commit this SUMMARY.md.
- Plan 02-04 is then complete; orchestrator advances to Plan 02-05 (close-out: ADR + UAT + accessibility check).

**On checkpoint rejection:**
- The continuation executor reads the user's failure description, applies fixes (Rule 1/2/3 as appropriate), and re-presents.
- If the failure points to a missing service-layer behavior or a contract drift from Plans 02-01/02/03, escalate (Rule 4 — return checkpoint with the proposed change).

## Issues Encountered

- **`pnpm build` failed initially** because `APP_SESSION_SECRET` was missing from local `.env` (Phase 1 invariant; pages now import `requireUser` which transitively loads env validation at module-load time). Fixed by adding to local gitignored `.env` per Task 4 pre-flight requirements.
- **shadcn CLI flag mismatch**: plan's `--base-color stone` is not supported by the latest CLI; wrote `components.json` directly with `tailwind.baseColor = stone`. Functionally equivalent.
- **ESLint `no-html-link-for-pages`** flagged 4 internal-nav `<a>` tags in application-list.tsx; replaced with `next/link <Link>`. Standard Next.js pattern; fix is mechanical.
- **No code-level issues caught by tests, lint, typecheck, build, or depcheck after the fixes above.**

## Known Stubs

The conditional **"View source email"** link branch in `timeline.tsx` is technically a stub for Phase 2 — `data.emailId` is always `null` in Phase 2 because no Gmail data exists yet. The branch's IF condition (`data.emailId != null`) ensures it's a no-op render in Phase 2 while leaving the rendering path live in code for Phase 4. Per the plan's truths line 50: this is intentional — the branch must exist so Phase 4 wires `/inbox/[emailId]` without re-editing this file. Documented in CONTEXT §Area 3 line 49 as a locked decision.

## Threat Flags

None new. The plan's `<threat_model>` enumerates T-02-04-01 through T-02-04-09 — all `mitigate`d. Verification:
- Every action calls `requireUser()` (T-02-04-01 — Spoofing)
- ATS-domain validation runs in three layers (T-02-04-02 — Tampering)
- React auto-escapes all string interpolations; no `dangerouslySetInnerHTML` anywhere (T-02-04-03 — XSS)
- All status changes write Events via service layer (T-02-04-04 — Repudiation)
- `findApplicationDetail` returns `null` for cross-tenant rows → page calls `notFound()` (T-02-04-05 — Information Disclosure)
- Schema caps enforced (T-02-04-06 — DoS)
- Curried actions never accept userId (T-02-04-07 — EoP)
- `updateStage` runs withRls → cross-tenant rejected (T-02-04-08 — Tampering, tested in Plan 03)
- Generic error messages on non-Validation failures ("Could not save the foray. Try again.") (T-02-04-09 — Information Disclosure)

## Next Phase Readiness

- **Plan 02-05 (close-out: ADR + UAT + accessibility)** can begin once Task 4 is approved. ADR-0012 candidate (status-regression block + auto-update event styling) is partially scoped; Plan 04 implementation provides the concrete styling to reference.
- **Phase 4 (inbox/act stage)** is unaffected by this plan beyond having the conditional "View source email" branch ready in timeline.tsx. The applyAutoStatusChange + undoStatusChange contract was delivered in Plan 02-02.
- **No service-layer work remains for Phase 2.** Plan 02-05 is documentation + UAT + accessibility — no code touched the slice surface.

## Self-Check: PASSED (pending checkpoint)

Files exist:
- `components.json`: FOUND
- `src/lib/utils.ts`: FOUND
- `src/ui/button.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `card.tsx`, `badge.tsx`, `dropdown-menu.tsx`, `dialog.tsx`: ALL 8 FOUND
- `src/features/applications/actions.ts`: FOUND
- `src/features/applications/components/{new-application-form, application-list, application-detail, timeline, status-dropdown, stage-editor, notes-editor}.tsx`: ALL 7 FOUND
- `src/features/applications/components/application-list.test.ts`: FOUND
- `src/app/applications/page.tsx`, `new/page.tsx`, `[id]/page.tsx`: ALL 3 FOUND
- `scripts/dev/insert-fake-auto-event.ts`: FOUND (gitignored)

Commits exist:
- `df48b12` (Task 1a, shadcn primitives): FOUND
- `626a286` (Task 1b, Server Actions): FOUND
- `7395b93` (Task 2, components): FOUND
- `341f45f` (Task 3, pages + gitignore): FOUND

Pre-commit gate (lint + typecheck + test:run + build + depcheck): all PASS, executed end-to-end after Task 3 commit.

**Self-check status:** PASSED for code-layer deliverables. Browser-verify checkpoint (Task 4) is the final outstanding gate; this executor is paused awaiting human verification.

---
*Phase: 02-applications-slice-manual-tracker*
*Plan: 04*
*Status: AWAITING BROWSER CHECKPOINT*
*Completed (code layer): 2026-05-09*
