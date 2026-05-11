// Application detail composition (APP-02 + APP-03 + APP-04). Server Component —
// composes one server-rendered timeline with three client islands (status
// dropdown, stage editor, notes editor) per PRINCIPLES.md §"Default to Server
// Components" + the children-slot pattern.

import { format } from 'date-fns'
import { useTranslations } from 'next-intl'

import { StatusBadge } from '@/components/status-badge'
import { DocumentList } from '@/features/documents/components/document-list'
import { UploadForm } from '@/features/documents/components/upload-form'
import { ApplicationRecruitersSection } from '@/features/recruiters/components/application-recruiters-section'

import type { ApplicationDetail } from '../queries'
import { ClassifierBreadcrumb } from './classifier-breadcrumb'
import { FollowUpEditor } from './follow-up-editor'
import { NotesEditor } from './notes-editor'
import { StageEditor } from './stage-editor'
import { StatusDropdown } from './status-dropdown'
import { TagEditor } from './tag-editor'
import { Timeline } from './timeline'

export function ApplicationDetail({
  detail,
  allTags = [],
}: {
  detail: ApplicationDetail
  allTags?: string[]
}) {
  const t = useTranslations('forayDetail')
  const { application, stages, events, emails, documents, recruiters, recruiterOptions } = detail
  const company = application.company

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-medium tracking-tight">{application.roleTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {company.name}
          {company.domain ? ` · ${company.domain}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <StatusBadge status={application.canonicalStatus} />
          <span className="font-mono text-xs text-muted-foreground">
            {t('appliedOn', { date: format(application.appliedAt, 'MMM d, yyyy') })}
          </span>
          <StatusDropdown
            applicationId={application.id}
            currentStatus={application.canonicalStatus}
          />
        </div>
        <ClassifierBreadcrumb emails={emails} />
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('stages')}</h2>
        <StageEditor applicationId={application.id} stages={stages} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Follow-up</h2>
        <FollowUpEditor
          applicationId={application.id}
          followUpAt={application.followUpAt}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('notes')}</h2>
        <NotesEditor
          applicationId={application.id}
          initialNotes={application.notes ?? ''}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Tags</h2>
        <TagEditor
          applicationId={application.id}
          initialTags={application.tags}
          allTags={allTags}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Recruiters</h2>
        <ApplicationRecruitersSection
          applicationId={application.id}
          recruiters={recruiters}
          recruiterOptions={recruiterOptions}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Documents</h2>
        <UploadForm applicationId={application.id} />
        <DocumentList
          documents={documents.map((d) => ({
            id: d.id,
            kind: d.kind,
            filename: d.filename,
            mimeType: d.mimeType,
            sizeBytes: d.sizeBytes,
            createdAt: d.createdAt,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('timeline')}</h2>
        <Timeline events={events} stages={stages} emails={emails} />
      </section>
    </div>
  )
}
