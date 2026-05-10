---
phase: 09-ux-polish-shortcuts
plan: 01
subsystem: ui
tags: [keyboard-shortcuts, react, nextjs, navigation, i18n]

# Dependency graph
requires:
  - phase: 08-tags-search
    provides: search shortcut (/) pattern and SearchBar component
provides:
  - Centralized keyboard shortcut registry
  - useKeyboardShortcuts hook with g-prefix combo support
  - Keyboard shortcuts documentation in Settings page
affects: [layout, settings, search]

# Tech tracking
tech-stack:
  added: []
  patterns: [g-prefix-vim-style-shortcuts, client-provider-for-server-layout]

key-files:
  created:
    - src/features/shortcuts/shortcuts.ts
    - src/features/shortcuts/use-keyboard-shortcuts.ts
    - src/features/shortcuts/use-keyboard-shortcuts.test.ts
    - src/features/shortcuts/keyboard-shortcuts-provider.tsx
    - src/features/shortcuts/keyboard-shortcuts-section.tsx
  modified:
    - src/app/layout.tsx
    - src/app/settings/page.tsx

key-decisions:
  - "Excluded / (search) from global hook — already handled by useSearchShortcut in SearchBar to avoid double-fire"
  - "Used string literals in switch cases instead of Record indexing to satisfy strict TypeScript"
  - "KeyboardShortcutsProvider renders no DOM — pure side-effect client component mounted in server layout"

patterns-established:
  - "g-prefix combo pattern: press g, then second key within 1s timeout"
  - "Client provider pattern: null-rendering client component for hooks in server layouts"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 9 Plan 01: Keyboard Shortcuts Summary

**Centralized keyboard shortcut system with vim-style g-prefix combos (n, g+a, g+i, g+s) mounted globally via client provider, with settings documentation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T05:20:00Z
- **Completed:** 2026-05-10T05:32:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Created keyboard shortcut registry with 5 shortcuts (n, /, g+a, g+i, g+s)
- Built useKeyboardShortcuts hook with g-prefix combo support (1s timeout window)
- Shortcuts disabled in text inputs, contentEditable, and with modifier keys (Cmd/Ctrl/Alt)
- Mounted globally in root layout via KeyboardShortcutsProvider (zero-DOM client component)
- Added keyboard shortcuts documentation section to Settings page with kbd-styled keys
- 10 unit tests covering all shortcut paths, edge cases, and cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shortcut registry** - `e6bfbd9` (feat)
2. **Task 2: Add to layout** - `6713340` (feat)
3. **Task 3: Document shortcuts** - `a8ef248` (feat)

## Files Created/Modified
- `src/features/shortcuts/shortcuts.ts` - Shortcut registry with SHORTCUTS record and SHORTCUT_LIST
- `src/features/shortcuts/use-keyboard-shortcuts.ts` - Global keyboard shortcut hook with g-prefix combos
- `src/features/shortcuts/use-keyboard-shortcuts.test.ts` - 10 unit tests for hook behavior
- `src/features/shortcuts/keyboard-shortcuts-provider.tsx` - Client provider component (renders no DOM)
- `src/features/shortcuts/keyboard-shortcuts-section.tsx` - Settings section with kbd-styled shortcut docs
- `src/app/layout.tsx` - Mounted KeyboardShortcutsProvider
- `src/app/settings/page.tsx` - Added KeyboardShortcutsSection import and rendering

## Decisions Made
- Excluded "/" (search) from the global hook — the existing useSearchShortcut in SearchBar already handles it. Adding it to both would cause double-fire.
- Used string literals in switch cases instead of indexing through the SHORTCUTS Record, because TypeScript's Record<string, T> means values could be undefined.
- KeyboardShortcutsProvider renders no DOM (returns null) — pure side-effect client component for mounting hooks in a server layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript error on Record indexing**
- **Found during:** Task 2 (layout integration)
- **Issue:** SHORTCUTS is typed as Record<string, ShortcutDef>, so indexing returns `ShortcutDef | undefined`, causing TS18048 errors on `.href!` and `.secondKey`
- **Fix:** Replaced Record indexing with string literals in switch cases
- **Files modified:** src/features/shortcuts/use-keyboard-shortcuts.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 6713340 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type fix necessary for build to pass. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Keyboard shortcut infrastructure complete, ready for remaining phase 09 plans
- Stale indicator and undo toast can reference shortcut patterns if needed

---
*Phase: 09-ux-polish-shortcuts*
*Completed: 2026-05-10*
