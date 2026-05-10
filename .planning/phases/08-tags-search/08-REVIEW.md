---
status: issues_found
depth: standard
files_reviewed: 10
critical: 0
warning: 3
info: 5
total: 8
---

# Code Review: Phase 08 — Tags + Search

## Warnings

### WR-01: NOT_FOUND error dead code — always wrapped as Db by withRls
- **Files:** tags-service.ts:67, tags-service.ts:105, actions.ts:339, actions.ts:353
- **Issue:** `addTag`/`removeTag` throw `NOT_FOUND` errors inside `withRls` callback, but `withRls` wraps all thrown errors as `errors.db(cause)`. Consumer checks `error._tag === 'NotFound'` which is never true.
- **Fix:** Return `err(errors.notFound(...))` instead of throwing.

### WR-02: Dead useEffect in TagEditor
- **File:** tag-editor.tsx:32-35
- **Issue:** useEffect watches `state` but body is a no-op comment. Dead code.
- **Fix:** Remove the effect entirely.

### WR-03: Search page silently swallows errors
- **File:** search/page.tsx:52-158
- **Issue:** When `fullTextSearch` returns error, no feedback shown to user.
- **Fix:** Add error state display outside the `results?.isOk()` block.

## Info

- IN-01: Misplaced import in tags-service.ts:127 (should be at top)
- IN-02: Unnecessary dynamic import for `ok` in search.ts:55
- IN-03: No result limit on `findApplicationsByTag`
- IN-04: Mixed-case autocomplete UX observation
- IN-05: `updateTagsAction` doesn't update `lastActivityAt`
