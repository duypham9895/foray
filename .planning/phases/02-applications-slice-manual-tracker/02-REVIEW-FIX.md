---
phase: 02-applications-slice-manual-tracker
fixed_at: 2026-05-09T18:14:00Z
review_path: .planning/phases/02-applications-slice-manual-tracker/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-05-09
**Source review:** `.planning/phases/02-applications-slice-manual-tracker/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (all warnings; 8 info findings deferred per scope = `critical_warning`)
- Fixed: 4
- Skipped: 0
- Pre-commit gate: `pnpm lint`, `pnpm typecheck`, `pnpm test:run` (158 passed, 4 todo), `pnpm build` — all green; no follow-up commit needed.

## Fixed Issues

### WR-01: Unsafe `as ListSort` cast on URL `sort` param bypasses validation

**Files modified:** `src/features/applications/queries.ts`, `src/app/applications/page.tsx`
**Commit:** `139349c`
**Applied fix:** Added `listSortSchema` Zod enum next to the `ListSort` type in `queries.ts`. Replaced the `(params.sort as ListSort) ?? 'lastActivityAt:desc'` cast in `page.tsx` with `listSortSchema.safeParse(params.sort)`, falling back to `lastActivityAt:desc` on parse failure. Also tightened the URL-state forwarding so unknown `?sort=` values are dropped (not echoed back into chip-toggle URLs).

### WR-02: Stage name inline edit drops user input on click-away (CONTEXT spec violation)

**Files modified:** `src/features/applications/components/stage-editor.tsx`
**Commit:** `aae7bcc`
**Applied fix:** Mirrored the `notes-editor.tsx` pattern in `StageRow`: added `useRef<HTMLFormElement>` for the edit form, attached `onBlur={() => formRef.current?.requestSubmit()}` to the input (so blur saves), and added `onKeyDown` to exit edit mode on Escape without writing. Comment explicitly cites CONTEXT §"Specifics" → "Inline stage edit" and the notes-editor parallel.

### WR-03: Sort toggle ignores the `:asc` half of the four-value `ListSort` union

**Files modified:** `src/features/applications/queries.ts`, `src/features/applications/components/application-list.tsx`, `.planning/phases/02-applications-slice-manual-tracker/02-CONTEXT.md`
**Commit:** `f4a3381`
**Applied fix:** Took the reviewer-recommended Lean path — narrowed `listSortSchema` to the two `:desc` literals (`lastActivityAt:desc`, `appliedAt:desc`) so unreachable UI states stop existing per CLAUDE.md §1.2. Updated CONTEXT.md §"Area 2" sort line to note the deferral with a back-reference to WR-03. Added a clarifying comment to the `toggleSortInUrl` helper. Existing `findApplicationsForList` `sort.split(':')` destructure left intact (no behavior change there; surgical edit per Karpathy §1.3).

### WR-04: `withdrawn` count never surfaced in UI; "archived" suffix only attached to `rejected` chip

**Files modified:** `src/features/applications/components/application-list.tsx`
**Commit:** `7bb86a3`
**Applied fix:** Removed the per-chip `archivedSuffix` (which was hardcoded to `status === 'rejected'` and was semantically misleading because `counts.archived` covers both terminal statuses). Now renders `· N archived` as a single sibling label after the Reset link, only when `counts.archived > 0`. Inline comment explains the placement choice and back-references WR-04.

## Skipped Issues

None.

---

_Fixed: 2026-05-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
