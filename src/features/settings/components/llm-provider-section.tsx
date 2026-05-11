'use client'

import { Bot, KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'

import { Button } from '@/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'

import {
  updateLlmProviderAction,
  type LlmProviderState,
} from '../actions'

type LlmProvider = 'anthropic' | 'openai'

type Props = {
  provider: LlmProvider
  anthropicConfigured: boolean
  openAiConfigured: boolean
}

export function LlmProviderSection({
  provider,
  anthropicConfigured,
  openAiConfigured,
}: Props) {
  const t = useTranslations('settings.llm')
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>(provider)
  const [state, formAction, isPending] = useActionState(updateLlmProviderAction, {
    ok: true,
    provider,
  } satisfies LlmProviderState)

  const currentConfigured = selectedProvider === 'anthropic'
    ? anthropicConfigured
    : openAiConfigured

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-medium">
          <Bot className="size-5 text-muted-foreground" aria-hidden="true" />
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="provider" value={selectedProvider} />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedProvider}
            onValueChange={(value) => setSelectedProvider(value as LlmProvider)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">{t('anthropic')}</SelectItem>
              <SelectItem value="openai">{t('openai')}</SelectItem>
            </SelectContent>
          </Select>

          <span
            className={
              currentConfigured
                ? 'inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground'
                : 'inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
            }
          >
            <KeyRound className="size-3" aria-hidden="true" />
            {currentConfigured ? t('configured') : t('missingKey')}
          </span>

          <Button type="submit" disabled={isPending || selectedProvider === state.provider || !currentConfigured}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>

        {!currentConfigured && (
          <p className="text-sm text-muted-foreground">
            {selectedProvider === 'anthropic' ? t('anthropicMissing') : t('openaiMissing')}
          </p>
        )}

        {!state.ok && (
          <p className="text-sm text-destructive">{state.formError}</p>
        )}
      </form>
    </section>
  )
}
