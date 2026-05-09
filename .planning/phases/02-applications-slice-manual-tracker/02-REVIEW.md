---
phase: 02-applications-slice-manual-tracker
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/core/domains/ats-domains.ts
  - src/core/domains/ats-domains.test.ts
  - src/features/applications/schema.ts
  - src/features/applications/schema.test.ts
  - src/features/applications/status-transitions.ts
  - src/features/applications/status-transitions.test.ts
  - src/features/applications/service.ts
  - src/features/applications/service.test.ts
  - src/features/applications/queries.ts
  - src/features/applications/stages-service.ts
  - src/features/applications/stages-service.test.ts
  - src/features/applications/notes-service.ts
  - src/features/applications/notes-service.test.ts
  - src/features/applications/actions.ts
  - src/features/applications/components/new-application-form.tsx
  - src/features/applications/components/application-list.tsx
  - src/features/applications/components/application-list.test.ts
  - src/features/applications/components/application-detail.tsx
  - src/features/applications/components/timeline.tsx
  - src/features/applications/components/status-dropdown.tsx
  - src/features/applications/components/stage-editor.tsx
  - src/features/applications/components/notes-editor.tsx
  - src/app/applications/page.tsx
  - src/app/applications/new/page.tsx
  - src/app/applications/[id]/page.tsx
  - tests/integration/applications-rls-isolation.test.ts
  - src/lib/utils.ts
  - scripts/dev/insert-fake-auto-event.ts
  - docs/decisions/0012-status-regression-block-and-auto-update-styling.md
findings:
  critical: 0
  warning: 4
  info: 8
  total: 12
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 29 (including ADR + dev script + utility)
**Status:** issues_found

## Summary

Phase 2 ships a coherent applications slice that earns its existence: branded IDs are constructed at every boundary, every Server Action and Server Component starts with `requireUser()`, every Prisma access goes through `withRls(userId, ...)`, and every fallible operation returns `Result<T, AppError>`. The status-regression block, auto-update Event styling, and the cross-tenant test harness all match what `02-CONTEXT.md` and `ADR-0012` lock in.

Test coverage is strong: 36-cell truth table for `isStatusRegression`, integration tests asserting cross-tenant isolation via real Postgres + RLS, and exhaustive Zod schema coverage with literal field-path assertions.

No critical security issues. No XSS vectors (no `dangerouslySetInnerHTML`, no raw HTML render paths, no unsafe href construction from user input). No console artifacts, no TODO/FIXME, no commented-out code, no hardcoded secrets.

The four warnings below are real correctness gaps worth addressing before Phase 4 lands. The eight info items are documentation drift, deviations from spec that don't risk bugs but should either be reconciled to spec or have the spec updated, and small simplifications.

---

## Warnings

### WR-01: Unsafe `as ListSort` cast on URL `sort` param bypasses validation

**File:** `src/app/applications/page.tsx:25`
**Issue:** `const activeSort: ListSort = (params.sort as ListSort) ?? 'lastActivityAt:desc'` casts an arbitrary URL string to the four-value `ListSort` union with no runtime validation. The string flows into `findApplicationsForList(userId, { sort })` which does `sort.split(':')` and uses the parts as Prisma `orderBy` keys (`queries.ts:76-90`). A request like `/applications?sort=garbage:invalid` produces a malformed `orderBy: { garbage: 'invalid' }` that Prisma will reject at runtime, surfacing as a 500 (the Page's `if (listResult.isErr())` branch hides the cause as "Could not load forays. Try refreshing"). Worse, `?sort=salaryMin:desc` would let an attacker order by an arbitrary indexed column — a small information-disclosure smell, even if the rows themselves are tenant-scoped.

This violates PRINCIPLES.md §"Zod at every boundary" — every input from outside the trust boundary, including URL params, must go through `safeParse`.

**Fix:** Validate against a Zod enum in the page (or add a guard in `findApplicationsForList`):

```ts
// in queries.ts — export the enum
export const listSortSchema = z.enum([
  'lastActivityAt:desc',
  'lastActivityAt:asc',
  'appliedAt:desc',
  'appliedAt:asc',
])
export type ListSort = z.infer<typeof listSortSchema>

// in page.tsx
const sortParse = listSortSchema.safeParse(params.sort)
const activeSort: ListSort = sortParse.success ? sortParse.data : 'lastActivityAt:desc'
```

---

### WR-02: Stage name inline edit drops user input on click-away (CONTEXT spec violation)

**File:** `src/features/applications/components/stage-editor.tsx:95-110`
**Issue:** The click-to-edit input renders `defaultValue={stage.name}` inside a `<form action={...}>` whose `action` only fires on submit. CONTEXT.md §"Specifics" → "Inline stage edit" specifies *"single text input replaces label, **blur or Enter** saves via Server Action"*. The current implementation only saves on Enter (form submit). On blur, nothing happens — the user's edit is silently discarded if they click outside the field. Because `setEditing(false)` is called inside the form action, blurring the input also leaves the row stuck in edit mode until a submit happens.

Two related issues compound this:
- No `onBlur` handler triggers `formRef.current?.requestSubmit()` (the pattern that `notes-editor.tsx:31-35` correctly uses).
- No `onKeyDown` handler exits edit mode on Escape (so a user who started editing and changes their mind can only escape by pressing Enter with the original value).

**Fix:** Mirror the notes-editor pattern:

```tsx
const formRef = useRef<HTMLFormElement>(null)
// ...
<form
  ref={formRef}
  action={(fd: FormData) => {
    updateFormAction(fd)
    setEditing(false)
  }}
>
  <input
    name="name"
    defaultValue={stage.name}
    autoFocus
    required
    onBlur={() => formRef.current?.requestSubmit()}
    onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
  />
</form>
```

---

### WR-03: Sort toggle ignores the `:asc` half of the four-value `ListSort` union

**File:** `src/features/applications/components/application-list.tsx:89-90`
**Issue:** `nextSort` only flips between `appliedAt:desc` and `lastActivityAt:desc`. The `ListSort` union exports four values (`lastActivityAt:desc | lastActivityAt:asc | appliedAt:desc | appliedAt:asc`), but only the two `:desc` values are reachable via the UI toggle. The `:asc` variants are dead code in practice — the user can only set them by typing in the URL bar. Either the union is wrong (only two values are needed) or the UI is incomplete (there's no asc/desc flip).

This is a CONTEXT.md fidelity issue: §"Area 2" says *"two sort axes — `appliedAt` and `lastActivityAt`, **each asc/desc**"*. The UI promised four sort states; it ships two.

**Fix:** Either (a) drop `:asc` from the union and from `findApplicationsForList`'s switch, OR (b) add a second toggle (or a separate "↓ ↑" affordance per axis) so all four states are reachable. Recommendation: drop the `:asc` variants for Lean — defer the asc/desc flip to Standard milestone when bulk filtering becomes a UX need. Update CONTEXT.md §"Area 2" to match.

---

### WR-04: `withdrawn` count never surfaced in UI; "archived" suffix only attached to `rejected` chip

**File:** `src/features/applications/components/application-list.tsx:102-105`
**Issue:** The archived-count suffix is hardcoded to render only when `status === 'rejected'`. `withdrawn` chips never carry their archived count even though `countApplicationsByStatus` returns one global `archived` total covering both terminal statuses. CONTEXT.md §"Area 2" said *"Per-status count + hidden-archived count rendered as text labels"* without specifying which chip carries the archived suffix.

The placement is arbitrary — a user looking at the `withdrawn` chip wouldn't know archived rows exist. The deeper bug: `counts.archived` is the count of `archivedAt IS NOT NULL` rows across **all** statuses, not just rejected — so attaching it specifically to the rejected chip is semantically misleading.

**Fix:** Render the archived total as a separate small text label adjacent to (not inside) the chip strip. Example:

```tsx
<div className="flex flex-wrap items-center gap-2">
  {ALL_STATUSES.map((status) => /* ...chip without archived suffix... */)}
  <Link href="/applications" className="text-sm text-stone-500 hover:text-stone-700">
    Reset
  </Link>
  {counts.archived > 0 ? (
    <span className="text-sm text-stone-500">· {counts.archived} archived</span>
  ) : null}
</div>
```

---

## Info

### IN-01: `scripts/dev/insert-fake-auto-event.ts` claims "gitignored" but is not

**File:** `scripts/dev/insert-fake-auto-event.ts:5`
**Issue:** The header comment reads *"Do NOT ship — gitignored under scripts/dev/."* — `.gitignore` does not list `scripts/dev/`. The file IS tracked by git (it appears in the file_to_review list). This is a documentation lie that could mislead a future contributor into committing other "dev-only" scripts there.
**Fix:** Either (a) add `scripts/dev/` to `.gitignore` and remove this file from the index (`git rm --cached scripts/dev/insert-fake-auto-event.ts`), OR (b) update the comment to reflect reality: *"Dev-only fixture, intentionally tracked for fellow contributors. Do not run against prod."*

---

### IN-02: Status badges in list + detail use uniform `variant="secondary"` — DESIGN.md status palette never reaches the user

**File:** `src/features/applications/components/application-list.tsx:108,159` and `src/features/applications/components/application-detail.tsx:41`
**Issue:** DESIGN.md §"Color palette" → "Status colors" defines six distinct colors per `canonical_status` (`#737373` neutral gray for `applied`, `#0891b2` cyan-600 for `screening`, `#ca8a04` amber-600 for `interviewing`, `#16a34a` green-600 for `offer`, `#a8a29e` warm gray for `rejected` + `withdrawn`). The `<Badge variant="secondary">` used for every status renders identically — the palette never reaches the user in the list cards or the detail header. The status DOTs in `status-dropdown.tsx` correctly apply per-status background colors; the badges do not.

This is intentional minimalism per DESIGN.md §"What 'feels right'" → *"colors don't change as state changes; only the content does"* — but the explicit status palette in DESIGN.md suggests SOMETHING should be colored. Either the palette is aspirational and the secondary-badge choice is correct (then DESIGN.md should clarify "status colors are reserved for the dropdown dot only"), or the badges should pull per-status classes (matching the dot colors).

**Fix:** Decide and document. Recommended: keep badges uniform, add a one-line clarification to DESIGN.md noting the palette is reserved for the dropdown indicator and timeline tint.

---

### IN-03: Timeline shows duplicated stage rows + stage events for the same action

**File:** `src/features/applications/components/timeline.tsx:84-103`
**Issue:** When a user adds a stage, both a `Stage` row (rendered via `renderStageRow` with text "Stage: {name}") AND a `stage_added` Event row (rendered via `renderEventRow` with text "Stage added: {name}") appear in the timeline. They have similar `occurredAt` values so they cluster together, creating visual duplication. Same for `stage_completed`. The audit-trail value is real (the events outlive stage deletes via the cascade) but the user-facing duplication might be confusing.

**Fix:** Either (a) suppress `stage_added` and `stage_completed` events in the timeline render (the underlying Stage row carries the same information), OR (b) acknowledge both serve different purposes and document why duplication is intentional. No code change required if (b) — just an inline comment in `Timeline()`.

---

### IN-04: `currentParams` reconstruction in `page.tsx` discards everything except `status` + `sort`

**File:** `src/app/applications/page.tsx:27-29`
**Issue:** `currentParams` is rebuilt from scratch with only `status` and `sort` keys. If a future plan adds other URL params (e.g., `?archived=true`, `?q=stripe`), they'll be silently dropped when the chip toggle constructs new URLs. The `URLSearchParams` API allows constructing from the raw record directly: `new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][])` — but that adds noise.

**Fix:** Optional. Add a comment explaining the deliberate scope, or refactor to preserve all params.

---

### IN-05: `companyDomain` validation diverges between the two schemas

**File:** `src/features/applications/schema.ts:51-64,70-110`
**Issue:** `companyInputSchema` (the standalone company schema) uses field path `domain`; `createApplicationSchema` (the form schema) uses field path `companyDomain`. Two schemas, two error message paths, two `.superRefine` bodies — the comment at line 44 acknowledges this and explains the intent (DRY one error message + one superRefine body, inlined twice). The `atsRejectionMessage` helper deduplicates the message but the structural duplication remains.

This is fine for two callers per Sandi Metz (extract on the third). Flagging only because the next plan that needs ATS validation should reach for the helper, not paste a third copy.

**Fix:** No change required. Add a comment in `actions.ts` if/when a third caller emerges.

---

### IN-06: `eventDataSchemaFor` returns `genericPassthrough` for `manual_classification`, `document_uploaded`, `recruiter_linked`, `archived`, `unarchived`

**File:** `src/features/applications/schema.ts:177-191`
**Issue:** Five `EventType` values map to the loose-passthrough fallback. This is intentional per the comment on line 173-175 (*"Phase 2 in isolation — timeline rendering can fall back to 'Event #{id}' gracefully"*), but the timeline's `describeEvent` (`timeline.tsx:64-66`) hits the `default` arm for any of these five and renders just `Event #{id}`. A user adding a document later (Standard milestone) will see "Event #42" in their timeline until someone wires the schema + describe arm. The Phase 2 fallback is correct; flagging so it's on the radar for whoever adds the first of these features.

**Fix:** No change required for Phase 2. Add a TODO marker in the timeline's default arm pointing at the five EventType values awaiting wiring.

---

### IN-07: Two intentional throw-bridge translator duplicates — the third copy needs a shared helper

**File:** `src/features/applications/service.ts:321-335`, `src/features/applications/stages-service.ts:225-239`, `src/features/applications/notes-service.ts:80-87`
**Issue:** `translateThrowBridge` (service.ts), `translateBridge` (stages-service.ts), and the inline `if (result.isErr() && result.error._tag === 'Db')` block (notes-service.ts) all do the same thing: catch `Db` errors with `NOT_FOUND:` or `CONFLICT:` prefixes and translate. The headers correctly cite Sandi Metz's rule of three — three implementations exist, all in one slice, all with the same shape. The notes-service version is even partial (only handles `NOT_FOUND`, not `CONFLICT`). Per CLAUDE.md §1.2 the time to extract is now: extract a private helper into a `_throw-bridge.ts` (or top of one of the existing files) that all three import.

**Fix:** Extract to `src/features/applications/_throw-bridge.ts`:

```ts
import { err, type Result } from 'neverthrow'
import { errors, type AppError } from '@/core/errors'

export function translateThrowBridge<T>(result: Result<T, AppError>): Result<T, AppError> {
  if (!result.isErr()) return result
  if (result.error._tag !== 'Db') return result
  const cause = result.error.cause
  if (!(cause instanceof Error)) return result
  if (cause.message.startsWith('NOT_FOUND:')) {
    const [, resource, id] = cause.message.split(':')
    return err(errors.notFound(resource ?? 'Unknown', id ?? ''))
  }
  if (cause.message.startsWith('CONFLICT:')) {
    return err(errors.conflict(cause.message.split(':')[1] ?? 'CONFLICT'))
  }
  return result
}
```

Then service.ts, stages-service.ts, notes-service.ts all import it. The notes-service partial-translator gets the conflict path "for free" (no current caller, but matches the contract).

---

### IN-08: Tests use `_unsafeUnwrap()` ~30+ times — pattern OK but worth a vitest helper

**File:** Throughout `*.test.ts` (service.test.ts:90+, stages-service.test.ts:107+, notes-service.test.ts:67+)
**Issue:** Tests call `_unsafeUnwrap()` extensively (correct usage — neverthrow exposes it for tests). Most calls are immediately preceded by an `expect(result.isOk()).toBe(true)` assertion, but some unwrap without first asserting (e.g., `service.test.ts:174,210,238`). When unwrapping fails the error message is opaque (`UnwrapErr: ...`) and lacks test context. A small `unwrapOk(result, 'context')` helper that asserts and unwraps in one call would tighten failure messages and reduce noise. Not blocking — just nicer ergonomics.

**Fix:** Optional. Add to `src/test/helpers.ts` if/when tests proliferate:

```ts
export function unwrapOk<T, E>(r: Result<T, E>, context = 'expected ok'): T {
  if (r.isErr()) throw new Error(`${context} — got err: ${JSON.stringify(r.error)}`)
  return r.value
}
```

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
