// Application slice — notes service.
//
// One mutation function — the autosave-on-blur target for the per-foray
// notes <textarea> in Plan 04. Free-form text up to 10_000 chars (per
// notesInputSchema in Plan 02-01).
//
// Two intentional behaviors:
//   - Blank-to-blank no-op: if the existing notes match the new notes,
//     write nothing. Avoids timeline spam from idle blur events on an
//     untouched textarea (T-02-03-04 mitigation).
//   - Append-event-on-change: every actual change writes Event(note_added).
//     The data shape is intentionally empty ({}) — the timeline component
//     renders the snippet from the application row directly, not from the
//     event payload (avoids storing notes twice).
//
// Same throw-bridge pattern as service.ts + stages-service.ts. The
// translator is inlined here (single function — would only become a
// shared helper on the third caller per Sandi Metz; see stages-service.ts
// header for the rationale).

import 'server-only'
import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, UserId } from '@/core/types/ids'

import { eventDataSchemas, notesInputSchema } from './schema'

export async function updateApplicationNotes(
  userId: UserId,
  applicationId: ApplicationId,
  rawInput: unknown,
): Promise<Result<{ notesChanged: boolean }, AppError>> {
  const parsed = notesInputSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))
  const newNotes = parsed.data.notes

  const numericUserId = Number(userId)
  const numericAppId = Number(applicationId)

  const result = await withRls(userId, async (tx): Promise<{ notesChanged: boolean }> => {
    const app = await tx.application.findUnique({
      where: { id: numericAppId },
      select: { userId: true, notes: true },
    })
    if (!app || app.userId !== numericUserId) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    // Blank-to-blank no-op: treat null and "" as equivalent on both sides.
    const existingNotes = app.notes ?? ''
    if (existingNotes === newNotes) {
      return { notesChanged: false }
    }

    await tx.application.update({
      where: { id: numericAppId },
      data: {
        notes: newNotes === '' ? null : newNotes,
        lastActivityAt: new Date(),
      },
    })

    const eventData = eventDataSchemas.note_added.parse({})
    await tx.event.create({
      data: {
        userId: numericUserId,
        applicationId: numericAppId,
        type: 'note_added',
        source: 'manual',
        data: eventData,
        undoable: false,
      },
    })

    return { notesChanged: true }
  })

  if (result.isErr() && result.error._tag === 'Db') {
    const cause = result.error.cause
    if (cause instanceof Error && cause.message.startsWith('NOT_FOUND:')) {
      const [, resource, id] = cause.message.split(':')
      return err(errors.notFound(resource ?? 'Unknown', id ?? ''))
    }
  }
  return result
}
