'use client'

import { useState } from 'react'

import {
  confirmClassification,
  overrideClassification,
  linkToApplication,
  ignoreEmail,
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
      <p className="py-12 text-center text-sm text-muted-foreground">
        No emails to review. All caught up.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {emails.map((item) => (
        <InboxRow
          key={item.id}
          item={item}
          applications={applications}
          onConfirm={handleConfirm}
          onOverride={handleOverride}
          onLink={handleLink}
          onIgnore={handleIgnore}
        />
      ))}
    </div>
  )
}
