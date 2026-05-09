// Application detail composition (APP-02 + APP-03 + APP-04). Server Component —
// composes one server-rendered timeline with three client islands (status
// dropdown, stage editor, notes editor) per PRINCIPLES.md §"Default to Server
// Components" + the children-slot pattern.

import { format } from 'date-fns'

import { Badge } from '@/ui/badge'

import type { ApplicationDetail } from '../queries'
import { NotesEditor } from './notes-editor'
import { StageEditor } from './stage-editor'
import { StatusDropdown } from './status-dropdown'
import { Timeline } from './timeline'

const STATUS_LABELS = {
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
} as const

export function ApplicationDetail({ detail }: { detail: ApplicationDetail }) {
  const { application, stages, events, emails } = detail
  const company = application.company

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl">{application.roleTitle}</h1>
        <p className="text-sm text-stone-500">
          {company.name}
          {company.domain ? ` · ${company.domain}` : ''}
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
        <span>Applied {format(application.appliedAt, 'MMM d, yyyy')}</span>
        <Badge variant="secondary">
          {STATUS_LABELS[application.canonicalStatus]}
        </Badge>
        <StatusDropdown
          applicationId={application.id}
          currentStatus={application.canonicalStatus}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Stages</h2>
        <StageEditor applicationId={application.id} stages={stages} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Notes</h2>
        <NotesEditor
          applicationId={application.id}
          initialNotes={application.notes ?? ''}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Timeline</h2>
        <Timeline events={events} stages={stages} emails={emails} />
      </section>
    </div>
  )
}
