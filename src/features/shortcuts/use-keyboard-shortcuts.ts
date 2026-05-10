'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

import { SHORTCUTS } from './shortcuts'

/**
 * Returns true when the active element is a text input where shortcuts
 * should be suppressed (input, textarea, contentEditable).
 */
function isInTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (['INPUT', 'TEXTAREA'].includes(el.tagName)) return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Global keyboard shortcut handler.
 *
 * Handles:
 *  - Single-key: n (new foray)
 *  - Combo (g-prefix): g+a, g+i, g+s
 *
 * "/" (focus search) is intentionally NOT handled here — the SearchBar
 * component owns that shortcut via useSearchShortcut.
 */
export function useKeyboardShortcuts() {
  const router = useRouter()
  const pendingG = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPending = useCallback(() => {
    pendingG.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInTextInput(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // If we're waiting for the second key of a g-combo
      if (pendingG.current) {
        clearPending()
        switch (e.key) {
          case SHORTCUTS.goApps.secondKey:
            e.preventDefault()
            router.push(SHORTCUTS.goApps.href!)
            return
          case SHORTCUTS.goInbox.secondKey:
            e.preventDefault()
            router.push(SHORTCUTS.goInbox.href!)
            return
          case SHORTCUTS.goSettings.secondKey:
            e.preventDefault()
            router.push(SHORTCUTS.goSettings.href!)
            return
          default:
            // Not a recognized combo — fall through to single-key check
            break
        }
      }

      // Single-key shortcuts
      switch (e.key) {
        case SHORTCUTS.newApp.key:
          e.preventDefault()
          router.push(SHORTCUTS.newApp.href!)
          return

        case SHORTCUTS.goApps.key:
          // Start g-prefix combo
          pendingG.current = true
          timeoutRef.current = setTimeout(clearPending, 1000)
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearPending()
    }
  }, [router, clearPending])
}
