---
phase: 09-ux-polish-shortcuts
verified: 2026-05-10T13:00:00+07:00
status: gaps_found
score: 2/5 success criteria verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: "Global keyboard shortcuts: j/k (navigate list) and Enter (open detail)"
    status: failed
    reason: "j/k list navigation and Enter-to-open-detail were never implemented. Plans only covered n, /, g+a, g+i, g+s. These shortcuts were listed in ROADMAP success criteria and CONTEXT.md integration points but never entered any plan's scope."
    artifacts: []
    missing:
      - "j/k keyboard navigation for application list items"
      - "Enter key to open selected application detail page"
  - truth: "Page transitions have smooth animations (not jarring)"
    status: failed
    reason: "No page transition animations exist. No loading.tsx, transition components, framer-motion, or route-change animation wrappers found. shadcn/ui components have internal animations (dialog, dropdown) but no page-level transitions were implemented."
    artifacts: []
    missing:
      - "Page transition animation wrapper or loading states"
      - "Route-change animation (fade, slide, or similar)"
  - truth: "Mobile layout is fully functional including keyboard shortcuts disabled on touch devices"
    status: failed
    reason: "Responsive breakpoints exist (sm:, md:, lg:) across pages, so layouts adapt. However, keyboard shortcuts are NOT disabled on mobile/touch devices. No touch detection, pointer:coarse media query, or matchMedia check exists in the shortcut system. REQUIREMENTS.md non-functional requirement: 'Shortcuts disabled on mobile — Skip registration on touch-only devices'."
    artifacts:
      - path: "src/features/shortcuts/use-keyboard-shortcuts.ts"
        issue: "No mobile/touch detection — shortcuts fire on all devices"
    missing:
      - "Touch device detection to skip keyboard shortcut registration"
  - truth: "UndoToast is integrated into application delete flow"
    status: failed
    reason: "UndoToast component exists and is well-built (with countdown, ARIA attributes, hasTimedOut guard) but is orphaned — not imported or used anywhere in the codebase. No delete/soft-delete action triggers it."
    artifacts:
      - path: "src/features/applications/components/undo-toast.tsx"
        issue: "Component exists but zero imports found outside its own file"
    missing:
      - "Integration of UndoToast into application delete/archive flow"
deferred: []
---

# Phase 09: UX Polish + Keyboard Shortcuts Verification Report

**Phase Goal:** Keyboard-driven navigation, smooth animations, responsive refinements, and accessibility improvements.
**Verified:** 2026-05-10T13:00:00+07:00
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Global keyboard shortcuts: n, /, j/k, Enter | PARTIAL | `n` routes to /applications/new, `/` handled by SearchBar, g+a/g+i/g+s work. j/k list navigation and Enter-to-open-detail NOT IMPLEMENTED — never entered any plan. |
| 2 | Focus management follows WAI-ARIA patterns | VERIFIED | Review fixes added role="alert" + aria-live to UndoToast, replaced div with button in ShortcutHintToast, added aria-labels. shadcn/ui components use focus-visible patterns. |
| 3 | Page transitions have smooth animations | FAILED | No page transition animations found. No loading.tsx, no framer-motion, no route-change wrappers. Only shadcn/ui internal component animations exist. |
| 4 | All interactive elements have visible focus states | VERIFIED | shadcn/ui button, input, select, badge, dialog all include focus-visible:border-ring + focus-visible:ring-[3px] classes. Custom inputs (search-bar, login-form, new-application-form) use focus:ring-2 focus:ring-ring. |
| 5 | Mobile layout is fully functional | PARTIAL | Responsive breakpoints (sm:, md:, lg:) used across pages. Layouts adapt. BUT keyboard shortcuts NOT disabled on touch devices — no mobile detection in shortcut system. |

**Score:** 2/5 success criteria fully verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/shortcuts/shortcuts.ts` | Shortcut registry with 5 shortcuts | VERIFIED | SHORTCUTS record with newApp, search, goApps, goInbox, goSettings. 39 lines. |
| `src/features/shortcuts/use-keyboard-shortcuts.ts` | Global keyboard shortcut hook | VERIFIED | Handles n, g+a, g+i, g+s. Uses refs for g-prefix combo (1s timeout). closest() for input detection. 87 lines. |
| `src/features/shortcuts/use-keyboard-shortcuts.test.ts` | Unit tests | VERIFIED | 10 tests covering all shortcut paths, edge cases, cleanup. All passing. |
| `src/features/shortcuts/keyboard-shortcuts-provider.tsx` | Client provider for server layout | VERIFIED | Zero-DOM client component, mounts useKeyboardShortcuts. Wired in layout.tsx. |
| `src/features/shortcuts/keyboard-shortcuts-section.tsx` | Settings documentation section | VERIFIED | Renders kbd-styled shortcut list with i18n. Wired in settings/page.tsx line 160. |
| `src/features/shortcuts/shortcut-hint-toast.tsx` | One-time first-visit hint | VERIFIED | localStorage persistence, 2s delay, 6s auto-dismiss, button semantics (post WR-02 fix). Wired in layout.tsx. |
| `src/features/applications/components/stale-indicator.tsx` | Stale badge on application cards | VERIFIED | 7-day threshold, computes days, returns null when not stale. Wired in application-list.tsx line 164. |
| `src/features/applications/components/undo-toast.tsx` | Undo toast with countdown | STUB | Component is well-built (hasTimedOut guard, ARIA attributes) but ORPHANED — zero imports outside its own file. Not integrated into any delete flow. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| layout.tsx | KeyboardShortcutsProvider | import + render | WIRED | Line 2: import, line renders `<KeyboardShortcutsProvider />` |
| layout.tsx | ShortcutHintToast | import + render | WIRED | import + `<ShortcutHintToast />` |
| settings/page.tsx | KeyboardShortcutsSection | import + render | WIRED | Line 16: import, line 160: `<KeyboardShortcutsSection />` |
| application-list.tsx | StaleIndicator | import + render | WIRED | Line 18: import, line 164: `<StaleIndicator lastActivityAt={item.lastActivityAt} />` |
| ??? | UndoToast | import + render | NOT_WIRED | No imports found outside undo-toast.tsx itself |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| StaleIndicator | lastActivityAt | application-list.tsx props | Yes — from application query data | FLOWING |
| UndoToast | message, onUndo, onTimeout | props | N/A — component not used | DISCONNECTED |
| ShortcutHintToast | localStorage key | browser API | Yes — real persistence | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `pnpm typecheck` | No errors found | PASS |
| All tests pass | `pnpm test:run` | 32 files, 396 passed, 4 todo | PASS |
| Build succeeds | `pnpm build` | Build complete | PASS |
| Shortcut registry has 5 entries | `grep -c "key:" src/features/shortcuts/shortcuts.ts` | 5 matches | PASS |
| isInTextInput uses closest() | `grep "closest" src/features/shortcuts/use-keyboard-shortcuts.ts` | Found: el.closest('input, textarea, [contenteditable="true"]') | PASS |

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| KB-01 | Phase REQUIREMENTS.md | Shortcut n opens new application form | SATISFIED | use-keyboard-shortcuts.ts line 69: router.push('/applications/new') |
| KB-02 | Phase REQUIREMENTS.md | Shortcut / focuses search bar | SATISFIED | Handled by existing useSearchShortcut (intentionally not duplicated) |
| KB-03 | Phase REQUIREMENTS.md | Navigation shortcuts g+a, g+i, g+s | SATISFIED | use-keyboard-shortcuts.ts lines 48-58 |
| STALE-01 | Phase REQUIREMENTS.md | Stale badge on applications >7d inactive | SATISFIED | StaleIndicator wired in application-list.tsx |
| UNDO-01 | Phase REQUIREMENTS.md | Delete shows undo toast with timer | NOT SATISFIED | UndoToast exists but not integrated into any delete flow |
| UNDO-02 | Phase REQUIREMENTS.md | Clicking Undo restores application | NOT SATISFIED | Depends on UNDO-01 integration |
| UNDO-03 | Phase REQUIREMENTS.md | Permanent deletion after timeout | NOT SATISFIED | Depends on UNDO-01 integration |
| HELP-01 | Phase REQUIREMENTS.md | Settings documents all shortcuts | SATISFIED | KeyboardShortcutsSection in settings/page.tsx |

**Note on requirement IDs:** The task specified KBD-01, KBD-02, ANIM-01, A11Y-01, RESP-01 — these IDs do not exist in the project's REQUIREMENTS.md. The actual phase 09 requirement IDs are KB-01, KB-02, KB-03, STALE-01, UNDO-01/02/03, HELP-01. Verification used the actual IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/applications/components/undo-toast.tsx` | whole file | Orphaned component — zero imports | Warning | Component built but never integrated; delete flow has no undo |

### Human Verification Required

### 1. j/k List Navigation Behavior

**Test:** Open the applications list, press j to move down, k to move up
**Expected:** Selected application highlights, j/k moves selection, Enter opens detail
**Why human:** j/k navigation was never implemented — this is a gap, not a test. Needs product decision: implement or defer.

### 2. Page Transition Smoothness

**Test:** Navigate between pages (applications, settings, inbox)
**Expected:** Smooth fade or slide transition, no jarring white flash
**Why human:** No page transition code exists. Visual assessment needed to confirm if Next.js default transitions are acceptable or if custom animations are required.

### 3. Mobile Keyboard Shortcut Behavior

**Test:** Open the app on a mobile device or with touch emulation
**Expected:** Keyboard shortcuts should not fire; no visual artifacts from shortcut system
**Why human:** No touch detection code exists. Need to verify shortcuts don't cause issues on mobile even though they technically fire.

### 4. Undo Toast Integration

**Test:** Delete an application, verify undo toast appears with countdown
**Expected:** Toast appears bottom-right, countdown from 10s, Undo restores application
**Why human:** UndoToast is not wired into any delete flow — this is a gap. Needs integration before it can be tested.

### Gaps Summary

The phase delivered solid keyboard shortcut infrastructure (registry, hook, provider, tests, settings docs, hint toast) and visual feedback components (StaleIndicator, UndoToast). However, 4 of 5 roadmap success criteria have gaps:

1. **j/k + Enter shortcuts** were listed in ROADMAP success criteria and CONTEXT.md but never entered any plan's scope. The plans focused on n, /, and g-prefix combos only. This is a planning omission.

2. **Page transitions** were listed as a success criterion but no plan addressed them. No animation wrappers, loading states, or route-change handlers exist.

3. **Mobile shortcut disabling** is a non-functional requirement in REQUIREMENTS.md but was not implemented. The shortcut hook fires unconditionally on all devices.

4. **UndoToast orphaned** — the component is well-built (post review-fix with hasTimedOut guard and ARIA attributes) but has zero integration points. No delete/archive action in the codebase imports or renders it.

The 2 fully verified criteria are: focus management (WAI-ARIA patterns, largely thanks to review fixes) and visible focus states (shadcn/ui foundation).

---

_Verified: 2026-05-10T13:00:00+07:00_
_Verifier: Claude (gsd-verifier)_
