'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/ui/button'

import {
  generateExtensionTokenAction,
  revokeExtensionTokenAction,
} from '../actions'
import type { ExtensionTokenState } from '../actions'

const initialExtensionTokenState = (
  hasToken: boolean,
): ExtensionTokenState => ({
  ok: true,
  token: null,
  hasToken,
})

export function ExtensionTokenSection({ hasToken }: { hasToken: boolean }) {
  const t = useTranslations('settings.extension')
  const [copied, setCopied] = useState(false)
  const [generateState, generateAction, generatePending] = useActionState(
    generateExtensionTokenAction,
    initialExtensionTokenState(hasToken),
  )
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeExtensionTokenAction,
    initialExtensionTokenState(hasToken),
  )

  const active = generateState.hasToken || revokeState.hasToken
  const token = generateState.ok ? generateState.token : null
  const error =
    (!generateState.ok && generateState.formError) ||
    (!revokeState.ok && revokeState.formError) ||
    null

  async function copyToken() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span
          className={
            active
              ? 'inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground'
              : 'inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
          }
        >
          <span
            className={
              active
                ? 'size-1.5 rounded-full bg-status-offer'
                : 'size-1.5 rounded-full bg-muted-foreground'
            }
            aria-hidden="true"
          />
          {active ? t('active') : t('inactive')}
        </span>

        <form action={generateAction}>
          <Button type="submit" disabled={generatePending}>
            {active ? t('regenerate') : t('generate')}
          </Button>
        </form>

        {active ? (
          <form action={revokeAction}>
            <Button type="submit" variant="outline" disabled={revokePending}>
              {t('revoke')}
            </Button>
          </form>
        ) : null}
      </div>

      {token ? (
        <div className="mt-6 rounded-md border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">{t('tokenLabel')}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {token}
            </code>
            <Button type="button" variant="outline" onClick={copyToken}>
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t('shownOnce')}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
