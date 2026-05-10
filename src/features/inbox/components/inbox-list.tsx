'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import {
  confirmClassification,
  ignoreEmail,
  linkToApplication,
  overrideClassification,
} from '@/features/inbox/actions'
import type { InboxItem } from '@/features/inbox/queries'
import type { EmailClassification } from '@/generated/prisma/client'

import { InboxRow } from './inbox-row'

type Application = {
  id: number
  roleTitle: string
  companyName: string
}

type Props = {
  items: InboxItem[]
  applications: Application[]
}

export function InboxList({ items, applications }: Props) {
  const t = useTranslations('inbox')
  const [emails, setEmails] = useState(items)

  const handleConfirm = async (emailId: number) => {
    const result = await confirmClassification(emailId)
    if (result.ok) {
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
    }
  }

  const handleOverride = async (
    emailId: number,
    classification: EmailClassification,
  ) => {
    const result = await overrideClassification(emailId, classification)
    if (result.ok) {
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
    }
  }

  const handleLink = async (emailId: number, applicationId: number) => {
    const result = await linkToApplication(emailId, applicationId)
    if (result.ok) {
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
    }
  }

  const handleIgnore = async (emailId: number) => {
    const result = await ignoreEmail(emailId)
    if (result.ok) {
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
    }
  }

  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
        <p className="text-base text-foreground">{t('emptyTitle')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('emptyBody')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {emails.map((item) => (
        <li key={item.id}>
          <InboxRow
            item={item}
            applications={applications}
            onConfirm={handleConfirm}
            onOverride={handleOverride}
            onLink={handleLink}
            onIgnore={handleIgnore}
          />
        </li>
      ))}
    </ul>
  )
}
