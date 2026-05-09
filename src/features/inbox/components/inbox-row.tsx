'use client'

import Link from 'next/link'

import type { InboxItem } from '@/features/inbox/queries'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import type { EmailClassification } from '@/generated/prisma/client'

import { ClassificationSelect } from './classification-select'
import { ConfidenceBadge } from './confidence-badge'
import { LinkApplicationDialog } from './link-application-dialog'

type Application = {
  id: number
  roleTitle: string
  companyName: string
}

type Props = {
  item: InboxItem
  applications: Application[]
  onConfirm: (emailId: number) => void
  onOverride: (emailId: number, classification: EmailClassification) => void
  onLink: (emailId: number, applicationId: number) => void
  onIgnore: (emailId: number) => void
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  rejection: 'bg-gray-200 text-gray-700',
  interview_invite: 'bg-green-100 text-green-800',
  recruiter_outreach: 'bg-blue-100 text-blue-800',
  noise: 'bg-gray-100 text-gray-600',
  unmatched: 'bg-yellow-100 text-yellow-800',
}

function ClassificationBadge({
  classification,
}: {
  classification: EmailClassification | null
}) {
  if (!classification) return null
  const color =
    CLASSIFICATION_COLORS[classification] ?? 'bg-gray-100 text-gray-600'
  const label = classification.replace(/_/g, ' ')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  )
}

export function InboxRow({
  item,
  applications,
  onConfirm,
  onOverride,
  onLink,
  onIgnore,
}: Props) {
  const excerpt =
    item.bodyExcerpt.length > 200
      ? `${item.bodyExcerpt.slice(0, 200)}...`
      : item.bodyExcerpt

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{item.subject}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {item.from} · {item.receivedAt.toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{excerpt}</p>

        <div className="flex flex-wrap items-center gap-3">
          <ClassificationBadge classification={item.classification} />
          <ConfidenceBadge confidence={item.confidence} />
          {item.applicationId && item.applicationRoleTitle && (
            <Link
              href={`/applications/${item.applicationId}`}
              className="text-sm text-primary underline"
            >
              {item.applicationRoleTitle}
              {item.companyName ? ` at ${item.companyName}` : ''}
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => onConfirm(item.id)}>
            Confirm
          </Button>
          <ClassificationSelect
            emailId={item.id}
            currentClassification={item.classification}
            onOverride={onOverride}
          />
          <LinkApplicationDialog
            emailId={item.id}
            applications={applications}
            onLink={onLink}
          />
          <Button variant="ghost" size="sm" onClick={() => onIgnore(item.id)}>
            Ignore
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
