/**
 * Centralized keyboard shortcut registry.
 *
 * Single-key shortcuts fire immediately.
 * Multi-key shortcuts use a "g prefix" pattern (vim-style):
 *   press g, then within 1 s press the second key.
 *
 * All shortcuts are disabled when the user is focused in a text input,
 * textarea, or contentEditable element.
 *
 * Note: "/" (focus search) is handled by useSearchShortcut in the search
 * feature and is NOT duplicated here.
 */

export interface ShortcutDef {
  /** Single key (e.g. "n") or first key of a combo (e.g. "g"). */
  key: string
  /** Second key for combo shortcuts. */
  secondKey?: string
  label: string
  /** Keyboard hint displayed in UI. */
  displayKey: string
  /** Navigation target. */
  href?: string
  /** Named action (for non-navigation shortcuts like focusing search). */
  action?: string
}

export const SHORTCUTS: Record<string, ShortcutDef> = {
  newApp: { key: 'n', label: 'New foray', displayKey: 'N', href: '/applications/new' },
  search: { key: '/', label: 'Search', displayKey: '/', action: 'focusSearch' },
  goApps: { key: 'g', secondKey: 'a', label: 'Go to Forays', displayKey: 'G A', href: '/applications' },
  goInbox: { key: 'g', secondKey: 'i', label: 'Go to Inbox', displayKey: 'G I', href: '/inbox' },
  goSettings: { key: 'g', secondKey: 's', label: 'Go to Settings', displayKey: 'G S', href: '/settings' },
}

/** Flat list for documentation / display purposes. */
export const SHORTCUT_LIST = Object.values(SHORTCUTS)
