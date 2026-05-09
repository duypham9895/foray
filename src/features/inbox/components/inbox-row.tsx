'use client'

import Link from 'next/link'

import type { InboxItem } from '@/features/inbox/queries'
import type { EmailClassification } from '@/generated/prisma/client'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'

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

const CLASSIFICATION_LABELS: Record<EmailClassification, string> = {
  rejection: 'rejection',
  interview_invite: 'interview invite',
  recruiter_outreach: 'recruiter outreach',
  noise: 'noise',
  unmatched: 'unmatched',
}

function ClassificationBadge({
  classification,
}: {
  classification: EmailClassification | null
}) {
  if (!classification) return null
  return (
    <Badge variant="outline" className="font-mono text-[11px] tracking-wide">
      {CLASSIFICATION_LABELS[classification]}
    </Badge>
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
      ? `${item.bodyExcerpt.slice(0, 200)}…`
      : item.bodyExcerpt

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base font-medium">{item.subject}</CardTitle>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono text-xs">{item.from}</span>
          {' · '}
          <span className="font-mono text-xs">
            {item.receivedAt.toLocaleDateString()}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{excerpt}</p>

        <div className="flex flex-wrap items-center gap-3">
          <ClassificationBadge classification={item.classification} />
          <ConfidenceBadge confidence={item.confidence} />
          {item.applicationId && item.applicationRoleTitle && (
            <Link
              href={`/applications/${item.applicationId}`}
              className="text-sm text-foreground underline-offset-4 hover:underline"
            >
              {item.applicationRoleTitle}
              {item.companyName ? ` at ${item.companyName}` : ''}
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
