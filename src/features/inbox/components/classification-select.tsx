'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import type { EmailClassification } from '@/generated/prisma/client'

const CLASSIFICATIONS: { value: EmailClassification; label: string }[] = [
  { value: 'rejection', label: 'Rejection' },
  { value: 'interview_invite', label: 'Interview invite' },
  { value: 'recruiter_outreach', label: 'Recruiter outreach' },
  { value: 'noise', label: 'Noise' },
  { value: 'unmatched', label: 'Unmatched' },
]

type Props = {
  emailId: number
  currentClassification: EmailClassification | null
  onOverride: (emailId: number, newClassification: EmailClassification) => void
}

export function ClassificationSelect({
  emailId,
  currentClassification,
  onOverride,
}: Props) {
  return (
    <Select
      value={currentClassification ?? undefined}
      onValueChange={(value) =>
        onOverride(emailId, value as EmailClassification)
      }
    >
      <SelectTrigger size="sm">
        <SelectValue placeholder="Override" />
      </SelectTrigger>
      <SelectContent>
        {CLASSIFICATIONS.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
