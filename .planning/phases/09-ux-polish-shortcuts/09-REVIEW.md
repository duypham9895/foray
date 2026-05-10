---
phase: 09-ux-polish-shortcuts
reviewed: 2026-05-10T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/features/shortcuts/shortcuts.ts
  - src/features/shortcuts/use-keyboard-shortcuts.ts
  - src/features/shortcuts/keyboard-shortcuts-provider.tsx
  - src/features/shortcuts/shortcut-hint-toast.tsx
  - src/features/applications/components/undo-toast.tsx
  - src/features/applications/components/stale-indicator.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-05-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the keyboard shortcuts system (registry, hook, provider, hint toast), undo toast, and stale indicator. The shortcut registry and provider are clean. One critical bug: a race condition in `UndoToast` that can fire `onTimeout` twice. Three warnings: `isInTextInput` only checks the directly focused element (not ancestors), hint toast uses a non-interactive `<div>` for dismiss interaction, and undo toast is invisible to screen readers. Two minor info items about duplicated utility and missing dismiss mechanism.

## Critical Issues

### CR-01: `UndoToast` `onTimeout` can fire multiple times (race condition)

**File:** `src/features/applications/components/undo-toast.tsx:22-40`
**Issue:** Two independent mechanisms drive `onTimeout`: (1) the `setInterval` counts down `remaining` to 0, and (2) a separate `useEffect` watches `remaining` and calls `onTimeout()` when it reaches 0. When `setRemaining` transitions from 1 to 0, the interval updater calls `clearInterval` internally, then the re-render triggers the `onTimeout` effect. If React batches renders or the component re-renders for another reason while `remaining` is already 0, `onTimeout` fires again. There is no guard against repeated invocations.

**Fix:**
```tsx
export function UndoToast({
  message,
  onUndo,
  onTimeout,
  timeoutMs = 10_000,
}: UndoToastProps) {
  const [remaining, setRemaining] = useState(Math.ceil(timeoutMs / 1000))
  const hasTimedOut = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval)
          return 0
        }
        return r - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (remaining <= 0 && !hasTimedOut.current) {
      hasTimedOut.current = true
      onTimeout()
    }
  }, [remaining, onTimeout])

  // ... rest unchanged
```

The `hasTimedOut` ref ensures `onTimeout` fires exactly once regardless of render timing.

## Warnings

### WR-01: `isInTextInput` only checks the directly focused element, not ancestors

**File:** `src/features/shortcuts/use-keyboard-shortcuts.ts:10-15`
**Issue:** The `isInTextInput` function checks `e.target` directly for `INPUT`, `TEXTAREA`, or `contentEditable`. If a custom component renders a `<div contentEditable>` containing a `<span>`, and the user focuses the inner `<span>`, `e.target` is the `<span>` (not contentEditable), so the check returns `false` and the shortcut fires while the user is typing. The same issue exists in `src/features/search/hooks/use-search-shortcut.ts:28-32`.

**Fix:**
```ts
function isInTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.closest('input, textarea, [contenteditable="true"]') !== null
}
```

`Element.closest()` walks up the DOM tree, correctly detecting ancestor input contexts.

### WR-02: `ShortcutHintToast` uses non-interactive element for dismiss interaction

**File:** `src/features/shortcuts/shortcut-hint-toast.tsx:44-54`
**Issue:** The toast is a `<div>` with `role="status"`, `onClick`, and `onKeyDown` handlers. A `<div>` with click handlers is not semantically interactive — screen readers do not announce it as clickable, and it is not in the tab order by default. The `onKeyDown` handler for Enter/Space tries to emulate button behavior, but without `tabIndex={0}` the element is never focused by keyboard navigation, so the handler never fires for keyboard-only users.

**Fix:**
```tsx
return (
  <button
    type="button"
    onClick={handleDismiss}
    aria-label="Dismiss shortcut hint"
    className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-lg transition-opacity hover:opacity-80"
  >
    <span className="text-muted-foreground">{t('toast')}</span>
  </button>
)
```

Using `<button>` provides correct semantics, tab order, and Enter/Space handling natively. Remove the `onKeyDown` handler and `role="status"`.

### WR-03: `UndoToast` is invisible to screen readers

**File:** `src/features/applications/components/undo-toast.tsx:46-59`
**Issue:** The undo toast is a plain `<div>` with no ARIA attributes. When it appears after an undoable action, screen reader users get no announcement. The countdown timer text ("10s") is not descriptive, and the "Undo" button has no label tying it to the specific action being undone.

**Fix:**
```tsx
return (
  <div
    role="alert"
    aria-live="assertive"
    className="fixed bottom-4 right-4 z-50 flex items-center gap-4 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg"
  >
    <span>{message}</span>
    <span className="tabular-nums text-background/60" aria-label={`${remaining} seconds remaining`}>
      {remaining}s
    </span>
    <Button
      variant="secondary"
      size="sm"
      onClick={handleUndo}
      className="font-semibold"
      aria-label={`Undo: ${message}`}
    >
      Undo
    </Button>
  </div>
)
```

`role="alert"` with `aria-live="assertive"` ensures the toast is announced immediately on mount. The `aria-label` on the countdown provides context for screen readers, and the button label ties the undo action to the specific message.

## Info

### IN-01: `isInTextInput` duplicated across two files

**File:** `src/features/shortcuts/use-keyboard-shortcuts.ts:10-15` and `src/features/search/hooks/use-search-shortcut.ts:28-32`
**Issue:** The same utility function is defined independently in both files. They have slightly different signatures (`EventTarget | null` vs `HTMLElement`) but identical logic. Per PRINCIPLES.md "Earn each abstraction" this is the second occurrence — acceptable to leave duplicated.

**Fix:** No action needed now. If a third usage appears, extract to a shared utility. If WR-01 is fixed in both files, the shared `closest()` logic strengthens the case for extraction.

### IN-02: `UndoToast` has no cancel/dismiss mechanism before timeout

**File:** `src/features/applications/components/undo-toast.tsx:14-59`
**Issue:** Once mounted, the toast cannot be dismissed early by the user — only "Undo" or wait for timeout. This is a UX observation, not a bug. The component is not yet used anywhere (no import sites found), so the interaction pattern may be refined at integration time.

**Fix:** Consider adding a close button or Escape key handler when integrating.

---

_Reviewed: 2026-05-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
