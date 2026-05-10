'use client'

import { useKeyboardShortcuts } from './use-keyboard-shortcuts'

/**
 * Client component that activates global keyboard shortcuts.
 * Mount once in the root layout — it renders no DOM.
 */
export function KeyboardShortcutsProvider() {
  useKeyboardShortcuts()
  return null
}
