'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { confirmClassification } from '@/features/inbox/actions'

export function ConfirmClassificationButton({ emailId }: { emailId: number }) {
  const t = useTranslations('actions')
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await confirmClassification(emailId)
        })
      }
      disabled={isPending}
      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {t('confirm')}
    </button>
  )
}
