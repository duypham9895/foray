---
phase: 09-ux-polish-shortcuts
fixed_at: 2026-05-10T12:30:00Z
review_path: .planning/phases/09-ux-polish-shortcuts/09-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report

**Fixed at:** 2026-05-10T12:30:00Z
**Source review:** .planning/phases/09-ux-polish-shortcuts/09-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `UndoToast` `onTimeout` can fire multiple times (race condition)

**Files modified:** `src/features/applications/components/undo-toast.tsx`
**Commit:** 94aad8d
**Applied fix:** Added `hasTimedOut` ref guard so `onTimeout()` fires exactly once regardless of render batching. The ref is checked and set before calling `onTimeout`, preventing duplicate invocations.

### WR-01: `isInTextInput` only checks the directly focused element, not ancestors

**Files modified:** `src/features/shortcuts/use-keyboard-shortcuts.ts`, `src/features/search/hooks/use-search-shortcut.ts`
**Commit:** 5fb15f6
**Applied fix:** Replaced direct `tagName`/`isContentEditable` checks with `el.closest('input, textarea, [contenteditable="true"]')` in both files. This correctly detects ancestor input contexts for custom contentEditable components.

### WR-02: `ShortcutHintToast` uses non-interactive element for dismiss interaction

**Files modified:** `src/features/shortcuts/shortcut-hint-toast.tsx`
**Commit:** 1922ba3
**Applied fix:** Replaced `<div role="status">` with `<button type="button">`, added `aria-label="Dismiss shortcut hint"`, and removed the manual `onKeyDown` handler. The button provides correct semantics, tab order, and native Enter/Space handling.

### WR-03: `UndoToast` is invisible to screen readers

**Files modified:** `src/features/applications/components/undo-toast.tsx`
**Commit:** 27db855
**Applied fix:** Added `role="alert"` and `aria-live="assertive"` to the toast container for immediate announcement on mount. Added `aria-label` on the countdown span (`{remaining} seconds remaining`) and the Undo button (`Undo: {message}`).

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-05-10T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
