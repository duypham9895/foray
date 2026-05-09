// Chronological timeline merging Stages + Events + Emails (APP-02). Server
// Component — pure rendering, no client interactivity.
//
// Auto-update Event styling (DESIGN.md exact spec, locked in CONTEXT §"Area 3"):
//   - Tinted background row: bg-cyan-50 (light), dark:bg-cyan-950/30 (dark)
//   - 2px left rail: border-l-2 border-cyan-600
//   - Label "Auto-updated from email" — text-sm text-stone-500 — NO icon
//   - Conditional "View source email" link when data.emailId is non-null
//     (Phase 2 won't exercise this branch; emailId is always null on real data
//     until Phase 4 wires Gmail. The branch must exist in code so Phase 4 can
//     wire /inbox/[emailId] without re-editing this file.)
//
// Undone events render with line-through + muted text per CONTEXT §"Area 3"
// reference to status_undone semantics from Plan 02.
//
// Per DESIGN.md: rejection rendered in muted gray (NOT red), no decorative
// icons anywhere, calm tone of voice.

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
    return <p className="text-sm text-stone-500">No activity yet.</p>
  }

  return (
    <ul className="space-y-2">
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
  const baseClass = 'pl-3 py-2 rounded'
  const autoClass = isAuto
    ? 'bg-cyan-50 dark:bg-cyan-950/30 border-l-2 border-cyan-600'
    : ''
  const undoneClass = isUndone ? 'text-stone-400 line-through' : ''

  // Conditional "View source email" link — Phase 2 path always renders nothing
  // because no real data carries emailId yet (Phase 4 wires Gmail). The branch
  // exists so Phase 4 can flip /inbox/[emailId] live without re-editing this file.
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
    <div className={`${baseClass} ${autoClass} ${undoneClass}`.trim()}>
      <p className="text-base">{describeEvent(event)}</p>
      <p className="text-xs text-stone-500 mt-1">
        {format(event.occurredAt, 'MMM d, yyyy · HH:mm')}
      </p>
      {isAuto ? (
        <p className="text-sm text-stone-500 mt-1">
          Auto-updated from email
          {sourceEmailHref ? (
            <>
              {' · '}
              <a
                href={sourceEmailHref}
                className="text-sm text-stone-500 hover:text-stone-700 underline"
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
    <div className="pl-3 py-2 rounded">
      <p className="text-base">
        Stage: {stage.name}
        {outcome ? <span className="text-sm text-stone-500"> ({outcome})</span> : null}
      </p>
      <p className="text-xs text-stone-500 mt-1">
        {format(stageOccurredAt(stage), 'MMM d, yyyy · HH:mm')}
      </p>
    </div>
  )
}

function renderEmailRow(email: Email) {
  return (
    <div className="pl-3 py-2 rounded">
      <p className="text-base">
        Email from {email.fromDomain}: {email.subject}
      </p>
      <p className="text-xs text-stone-500 mt-1">
        {format(email.receivedAt, 'MMM d, yyyy · HH:mm')}
      </p>
    </div>
  )
}
