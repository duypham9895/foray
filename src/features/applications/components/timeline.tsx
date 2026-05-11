// Chronological timeline merging Stages + Events + Emails (APP-02). Server
// Component — pure rendering, no client interactivity.

import { format } from 'date-fns'

import type { Email, Event, Stage, StageOutcome } from '@/generated/prisma/client'

import { eventDataSchemaFor } from '../schema'

type Row =
  | { kind: 'event'; key: string; occurredAt: Date; event: Event }
  | { kind: 'stage'; key: string; occurredAt: Date; stage: Stage }
  | { kind: 'email'; key: string; occurredAt: Date; email: Email }

function stageOccurredAt(stage: Stage): Date {
  return stage.completedAt ?? stage.scheduledAt ?? stage.createdAt
}

function describeEvent(event: Event): string {
  const parsed = eventDataSchemaFor(event.type).safeParse(event.data)
  if (!parsed.success) return `Event #${event.id}`
  const data = parsed.data as Record<string, unknown>

  switch (event.type) {
    case 'created':
      return 'Foray created'
    case 'status_changed': {
      const prev = String(data.previousStatus ?? '')
      const next = String(data.newStatus ?? '')
      return `Status changed: ${prev} → ${next}`
    }
    case 'auto_status_changed': {
      const prev = String(data.previousStatus ?? '')
      const next = String(data.newStatus ?? '')
      return `Status changed: ${prev} → ${next}`
    }
    case 'status_undone': {
      const restored = String(data.restoredStatus ?? '')
      return `Status undone — restored to ${restored}`
    }
    case 'stage_added':
      return `Stage added: ${String(data.stageName ?? '')}`
    case 'stage_completed':
      return `Stage completed (${String(data.outcome ?? '')})`
    case 'note_added':
      return 'Note updated'
    case 'email_received':
      return 'Email received'
    case 'document_uploaded': {
      const filename = String(data.filename ?? 'document')
      const kind = String(data.kind ?? 'other')
      return `Document uploaded: ${filename} (${kind})`
    }
    case 'recruiter_linked':
      return 'Recruiter linked'
    default:
      return `Event #${event.id}`
  }
}

function outcomeLabel(outcome: StageOutcome | null): string | null {
  if (!outcome) return null
  if (outcome === 'no_response') return 'no response'
  return outcome
}

export function Timeline({
  events,
  stages,
  emails,
}: {
  events: Event[]
  stages: Stage[]
  emails: Email[]
}) {
  const rows: Row[] = [
    ...events.map<Row>((event) => ({
      kind: 'event',
      key: `e-${event.id}`,
      occurredAt: event.occurredAt,
      event,
    })),
    ...stages.map<Row>((stage) => ({
      kind: 'stage',
      key: `s-${stage.id}`,
      occurredAt: stageOccurredAt(stage),
      stage,
    })),
    ...emails.map<Row>((email) => ({
      kind: 'email',
      key: `m-${email.id}`,
      occurredAt: email.receivedAt,
      email,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>
  }

  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={row.key}>
          {row.kind === 'event' ? renderEventRow(row.event) : null}
          {row.kind === 'stage' ? renderStageRow(row.stage) : null}
          {row.kind === 'email' ? renderEmailRow(row.email) : null}
        </li>
      ))}
    </ul>
  )
}

function renderEventRow(event: Event) {
  const isAuto = event.type === 'auto_status_changed' && event.undoneAt === null
  const isUndone = event.undoneAt !== null

  let sourceEmailHref: string | null = null
  if (event.type === 'auto_status_changed') {
    const parsed = eventDataSchemaFor('auto_status_changed').safeParse(event.data)
    if (parsed.success) {
      const data = parsed.data as { emailId?: number }
      if (data.emailId != null) {
        sourceEmailHref = `/inbox/${data.emailId}`
      }
    }
  }

  return (
    <div
      className={[
        'rounded-md px-3 py-2.5',
        isAuto ? 'border-l-2 border-primary/50 bg-accent/50' : '',
        isUndone ? 'text-muted-foreground/50 line-through' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="text-sm text-foreground">{describeEvent(event)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {format(event.occurredAt, 'MMM d, yyyy · HH:mm')}
      </p>
      {isAuto ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Auto-updated from email
          {sourceEmailHref ? (
            <>
              {' · '}
              <a
                href={sourceEmailHref}
                className="underline underline-offset-4 hover:text-foreground transition"
              >
                View source email
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

function renderStageRow(stage: Stage) {
  const outcome = outcomeLabel(stage.outcome)
  return (
    <div className="rounded-md px-3 py-2.5">
      <p className="text-sm text-foreground">
        Stage: {stage.name}
        {outcome ? <span className="text-muted-foreground"> ({outcome})</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {format(stageOccurredAt(stage), 'MMM d, yyyy · HH:mm')}
      </p>
    </div>
  )
}

function renderEmailRow(email: Email) {
  return (
    <div className="rounded-md px-3 py-2.5">
      <p className="text-sm text-foreground">
        Email from {email.fromDomain}: {email.subject}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {format(email.receivedAt, 'MMM d, yyyy · HH:mm')}
      </p>
    </div>
  )
}
