'use client'

import { useEffect, useState } from 'react'

import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'foray-shortcut-hint-dismissed'

/**
 * One-time hint toast that teaches users about keyboard shortcuts.
 * Shows on first visit, dismissed after 6 seconds or on click.
 * Persists dismissal in localStorage.
 */
export function ShortcutHintToast() {
  const t = useTranslations('shortcutHint')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return

    const dismissTimer = setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }, 6000)

    return () => clearTimeout(dismissTimer)
  }, [visible])

  if (!visible) return null

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  return (
    <div
      role="status"
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleDismiss()
      }}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-lg transition-opacity hover:opacity-80"
    >
      <span className="text-muted-foreground">{t('toast')}</span>
    </div>
  )
}
