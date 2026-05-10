'use client'

import { type RefObject, useEffect } from 'react'

/**
 * Global "/" keyboard shortcut to focus a search input.
 *
 * Skips when the user is already typing in an input, textarea,
 * or contentEditable element so normal typing is not interrupted.
 */
export function useSearchShortcut(
  searchInputRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      if (isInTextInput(e.target as HTMLElement)) return

      e.preventDefault()
      searchInputRef.current?.focus()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchInputRef])
}

function isInTextInput(el: HTMLElement): boolean {
  if (['INPUT', 'TEXTAREA'].includes(el.tagName)) return true
  if (el.isContentEditable) return true
  return false
}
