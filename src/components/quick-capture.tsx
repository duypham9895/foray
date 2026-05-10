'use client'

// Cmd-K quick capture modal — globally available from any authenticated page.
// Mounted in <AppShell>. Submits to the existing createApplicationAction
// server action which redirects on success, so no client-side routing needed.

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import {
  createApplicationAction,
  type ActionState,
} from '@/features/applications/actions'

const initial: ActionState = { ok: true }

function fieldError(state: ActionState, name: string): string | undefined {
  if (state.ok) return undefined
  return state.errors[name]?.[0]
}

export function QuickCapture() {
  const t = useTranslations('quickCapture')
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    createApplicationAction,
    initial,
  )

  // Global keyboard listener — Cmd-K (Mac) or Ctrl-K (others).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="qc-company"
              className="block text-sm text-muted-foreground"
            >
              {t('companyLabel')}
            </label>
            <input
              id="qc-company"
              type="text"
              name="companyName"
              required
              autoFocus
              maxLength={120}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {fieldError(state, 'companyName') ? (
              <p className="text-xs text-destructive">{fieldError(state, 'companyName')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="qc-role"
              className="block text-sm text-muted-foreground"
            >
              {t('roleLabel')}
            </label>
            <input
              id="qc-role"
              type="text"
              name="roleTitle"
              required
              maxLength={160}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {fieldError(state, 'roleTitle') ? (
              <p className="text-xs text-destructive">{fieldError(state, 'roleTitle')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="qc-url"
              className="block text-sm text-muted-foreground"
            >
              {t('urlLabel')}{' '}
              <span className="text-muted-foreground/60">{t('urlOptional')}</span>
            </label>
            <input
              id="qc-url"
              type="url"
              name="roleUrl"
              maxLength={2048}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {fieldError(state, 'roleUrl') ? (
              <p className="text-xs text-destructive">{fieldError(state, 'roleUrl')}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
