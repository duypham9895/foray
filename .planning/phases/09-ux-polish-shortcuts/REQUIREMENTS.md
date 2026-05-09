# Requirements: Phase 9 - UX Polish + Keyboard Shortcuts

**Phase**: Standard-4  
**Derived from**: STANDARD-ROADMAP.md Phase 4  
**Maps to**: Plans 09-01, 09-02, 09-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| KB-01 | Keyboard shortcut `n` opens new application form | 09-01 | Press `n` anywhere → form opens at `/applications/new` |
| KB-02 | Keyboard shortcut `/` focuses search bar | 09-01 | Press `/` → search input receives focus (integrated from Phase 8) |
| KB-03 | Navigation shortcuts: `g+a` (apps), `g+i` (inbox), `g+s` (settings) | 09-01 | Each combo navigates to correct page |
| STALE-01 | Stale badge renders on applications >7 days inactive | 09-02 | Application card shows "Stale — 9 days" badge |
| UNDO-01 | Delete application shows undo toast with 10s timer | 09-02 | After delete, toast appears with "Undo" button + countdown |
| UNDO-02 | Clicking "Undo" within 10s restores deleted application | 09-02 | Click undo → application restored, visible in list |
| UNDO-03 | After 10s timer, application is permanently deleted | 09-02 | No undo → application removed from database |
| HELP-01 | Settings page documents all keyboard shortcuts | 09-03 | `/settings` shows list of available shortcuts |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Keyboard shortcut registration | <5ms per shortcut |
| Usability | Shortcuts don't fire while typing | Skip if input/textarea focused |
| Usability | Shortcut help is discoverable | Visible on settings page + optional tooltip |
| Usability | Stale badge clearly indicates problem | Color red/orange + text "Stale — X days" |
| Reliability | Undo timer accuracy | Within ±500ms of 10 seconds |
| Accessibility | Shortcuts show as `<kbd>` elements | Standard browser styling |
| Mobile | Keyboard shortcuts disabled | Skip registration on touch-only devices |

---

## Boundary Conditions

- **Undo window**: Exactly 10 seconds, non-negotiable for UX consistency
- **Stale threshold**: >7 days (same as Phase 7 dashboard definition)
- **Shortcut conflicts**: Don't override browser shortcuts (Ctrl+S, Cmd+W, etc.)
- **Combo key timeout**: `g` + `a` must be pressed within 500ms of each other
- **Inactive application**: No status change AND no email AND no note for 7+ days

---

## Success Criteria

- [ ] `useKeyboardShortcuts` hook created + tested
- [ ] All 5 keyboard shortcuts working (n, /, g+a, g+i, g+s)
- [ ] Stale indicator badges rendered on matching applications
- [ ] Delete action triggers undo toast
- [ ] Undo restores soft-deleted application within 10s
- [ ] Permanent deletion happens after timeout
- [ ] Settings page lists and explains all shortcuts
- [ ] Shortcuts disabled on mobile devices
- [ ] No browser shortcut conflicts
- [ ] All pre-commit checks pass

---

## Dependencies

- **Standard-1 through Standard-3 complete**: All application features exist
- **Phase 7 (Today Dashboard)**: Uses same stale definition
- **Phase 8 (Tags + Search)**: Search bar must be focusable by `/` shortcut
- **Soft-delete schema**: `applications.deletedAt` timestamp column required
- **No new packages**: Use React hooks + browser KeyboardEvent API

---

## Out of Scope

- Custom shortcut mapping (shortcuts are fixed, not user-configurable)
- Vim mode (full vim keybindings saved for future phase)
- Shortcut cheatsheet modal (only documented in settings)
- Undo for other actions (only for delete in Phase 9, others in future)
- Offline shortcut support

---

## Integration Points

- **Phase 7**: Stale badge definition identical to "stale foray" in today dashboard
- **Phase 8**: Search bar `/` shortcut must integrate with Phase 8 search component
- **Phase 5 E2E tests**: Must test keyboard shortcuts + undo flows
- **Full-6**: Polish phase can enhance undo (multi-action undo stack)
