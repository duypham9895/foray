# Research: Phase 9 - UX Polish + Keyboard Shortcuts

**Phase**: Standard-4  
**Goal**: Power-user keyboard navigation + visual polish (stale indicator, undo toast)  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Users must use mouse for every action (click tag button, click delete, etc.). No visual indicators for old applications. Accidental deletions have no undo.

**Friction points**:
- Repetitive mouse movement between applications list and detail views
- No keyboard shortcuts for power users
- Cannot tell at a glance which applications are stale (no activity >7 days)
- Accidental delete with no recovery option
- No help text for available shortcuts

**Solution**:
- Global keyboard registry: `n` (new app), `/` (search), `g+a` (go to apps), `g+i` (go to inbox), `g+s` (go to settings)
- Stale foray visual indicator on application cards
- Undo toast with 10-second countdown timer before permanent deletion
- In-app shortcut documentation in settings

---

## Keyboard Shortcut Registry

**Global shortcuts** (work everywhere):
```
n        → New application (open /applications/new modal)
/        → Focus search bar (already created in Phase 8)
g+a      → Go to Applications page
g+i      → Go to Inbox (review queue)
g+s      → Go to Settings
```

**Navigation pattern**:
- `g` prefix is "go to" (vim-style)
- Single letters are quick actions
- Shortcuts work unless user is typing (inside input field)

**Implementation**:
```typescript
// hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  const shortcuts = {
    'n': () => router.push('/applications/new'),
    '/': () => searchInputRef.current?.focus(),
    'g+a': () => router.push('/applications'),
    'g+i': () => router.push('/inbox'),
    'g+s': () => router.push('/settings'),
  };
  
  // Listen for keydown, dispatch shortcuts
  // Skip if user is in input/textarea
}
```

---

## Stale Foray Visual Indicator

**Definition**: Application with no movement (status change, email, note) in >7 days

**Visual treatment**:
- Red badge on application card: "Stale — 9 days inactive"
- Badge placement: Top-right corner of application card
- Click badge → shows when last activity was

**Logic**:
```sql
SELECT *,
  CASE 
    WHEN (NOW() - GREATEST(
      lastStatusChangeAt,
      lastEmailAt,
      lastNoteAt
    )) > INTERVAL '7 days' THEN true
    ELSE false
  END AS isStale
FROM applications
```

---

## Undo Toast Architecture

**UX Flow**:
1. User clicks "Delete" on application
2. Toast appears: "Application deleted" + "Undo" button + 10s countdown
3. User clicks "Undo" OR timer expires
4. If "Undo" clicked: restore application (soft-delete by marking as deleted=false)
5. If timer expires: permanently delete

**Toast component**:
```typescript
<UndoToast 
  message="Application deleted"
  action="Undo"
  onUndo={() => restoreApplication(appId)}
  timeoutMs={10000}
/>
```

**Backend change**:
- Add `deletedAt` timestamp to applications table (soft-delete)
- `GET /api/applications` filters out `deletedAt IS NOT NULL` by default
- `POST /api/applications/:id/restore` unsets `deletedAt` within 10 seconds

**Permanent deletion**: After 10 seconds, run cleanup job that hard-deletes applications with old `deletedAt` timestamps (e.g., >1 hour old).

---

## useKeyboardShortcuts Hook

The hook handles:
1. **Registration**: User defines shortcuts in an object
2. **Prevention**: Skips shortcuts if user is typing in input/textarea
3. **Combo keys**: Supports `g+a` style two-key combinations
4. **Cleanup**: Removes event listeners on unmount
5. **Conflict avoidance**: Warns if shortcuts conflict with browser defaults

```typescript
export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName))
        return;
      
      // Match shortcuts (handle g+a style)
      // Call matching function
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
```

---

## Shortcut Documentation Strategy

**In-app help**:
1. Settings page lists all available shortcuts
2. Tooltip on hover (optional): "Press ? for help"
3. First-time user gets optional hint: "Tip: Press 'n' to create new application"

**Persistence**:
- Store user preference in localStorage: `showKeyboardHints=true/false`
- After first visit, disable hints (don't spam)
- User can re-enable in settings

---

## Stale Indicator Integration

The stale badge connects to Phase 7 (Today Dashboard):
- Today dashboard already queries "recent activity" for sorting
- Stale check uses same `lastActivityAt` calculation
- Consistent definition across product

---

## Visual Polish Points

- **Accessibility**: All shortcuts display as `<kbd>` tags (browser default styling)
- **Mobile**: Keyboard shortcuts gracefully disabled on mobile (no physical keyboard)
- **Conflict handling**: If browser captures shortcut (e.g., Ctrl+S), app doesn't fight it
- **Feedback**: When shortcut activates, provide visual feedback (small flash or navigation)

---

*Phase 9 is about reducing friction for power users and safety nets for destructive actions. No data model changes — purely UX and interaction.*
