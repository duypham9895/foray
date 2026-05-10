'use server'

// Server Actions for the applications slice.
//
// Six actions, all following the parse → requireUser → service → return-or-redirect
// pattern from src/features/auth/actions.ts. Each action is a public HTTP entry
// point — every action calls requireUser() and re-validates with Zod via
// safeParse before invoking a service function.
//
// Actions never accept userId from the client; userId is always sourced from
// requireUser() (cookie). Curried actions (addStageAction, updateStageAction,
// completeStageAction, updateNotesAction) receive only domain ids — never userId
// — via .bind(null, ...) at the component callsite.
//
// Per CLAUDE.md §1.3 (surgical) the deliberate duplication of the
// requireUser+errorBridge pattern across six actions is NOT extracted into a
// withAuth wrapper; the contract is clearer inline at each callsite. Sandi Metz
// rule of three: extract on the seventh action, if it ever exists.

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/core/auth/session'
import { ApplicationId, StageId } from '@/core/types/ids'

import {
  createApplicationSchema,
  notesInputSchema,
  stageInputSchema,
  stageOutcomeEnum,
  updateApplicationStatusSchema,
} from './schema'
import {
  applyManualStatusChange,
  createApplication,
} from './service'
import {
  addStage,
  completeStage,
  updateStage,
} from './stages-service'
import { updateApplicationNotes } from './notes-service'

import type { ZodError } from 'zod'

// ---------------------------------------------------------------------------
// ActionState — the discriminated union all six actions return.
// ---------------------------------------------------------------------------

export type ActionState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]>; formError?: string }

const initialOk: ActionState = { ok: true }

function authError(): ActionState {
  return {
    ok: false,
    errors: {},
    formError: 'Unauthorized — please sign in again.',
  }
}

function fieldErrorsFromZod(zerr: ZodError): Record<string, string[]> {
  // z.flatten() returns fieldErrors as Record<string, string[] | undefined>;
  // strip the undefineds for a clean ActionState shape.
  const flat = zerr.flatten().fieldErrors as Record<string, string[] | undefined>
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(flat)) {
    if (v && v.length > 0) out[k] = v
  }
  return out
}

// ---------------------------------------------------------------------------
// createApplicationAction — capture form (CAPT-01 + CAPT-02 + CAPT-03)
// ---------------------------------------------------------------------------

export async function createApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Strip empty-string optionals so Zod's optional()/literal('') unions accept them
  // exactly as the auth/actions.ts pattern does (Object.fromEntries first).
  const raw = Object.fromEntries(formData)
  const parsed = createApplicationSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  const result = await createApplication(userId, parsed.data)
  if (result.isErr()) {
    if (result.error._tag === 'Validation') {
      // Defense-in-depth: if the service-layer parse caught something the action
      // didn't (different schema / different version), surface as field errors.
      const issues = result.error.issues
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of issues) {
        const field = String(issue.path[0] ?? '_')
        if (!fieldErrors[field]) fieldErrors[field] = []
        fieldErrors[field].push(issue.message)
      }
      return { ok: false, errors: fieldErrors }
    }
    return {
      ok: false,
      errors: {},
      formError: 'Could not save the foray. Try again.',
    }
  }

  revalidatePath('/applications')
  redirect(`/applications/${result.value.applicationId}`)
}

// ---------------------------------------------------------------------------
// updateStatusAction — status dropdown (APP-03)
// ---------------------------------------------------------------------------

export async function updateStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateApplicationStatusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  const result = await applyManualStatusChange(
    userId,
    ApplicationId(String(parsed.data.applicationId)),
    parsed.data.newStatus,
  )
  if (result.isErr()) {
    const tag = result.error._tag
    const formError =
      tag === 'NotFound'
        ? 'Foray not found.'
        : 'Could not change status.'
    return { ok: false, errors: {}, formError }
  }

  revalidatePath(`/applications/${parsed.data.applicationId}`)
  revalidatePath('/applications')
  return initialOk
}

// ---------------------------------------------------------------------------
// addStageAction — curried with applicationId (APP-04)
// Components call addStageAction.bind(null, applicationId).
// ---------------------------------------------------------------------------

export async function addStageAction(
  applicationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = stageInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  const result = await addStage(
    userId,
    ApplicationId(String(applicationId)),
    parsed.data,
  )
  if (result.isErr()) {
    const formError =
      result.error._tag === 'NotFound'
        ? 'Foray not found.'
        : 'Could not add stage.'
    return { ok: false, errors: {}, formError }
  }

  revalidatePath(`/applications/${applicationId}`)
  return initialOk
}

// ---------------------------------------------------------------------------
// updateStageAction — curried with stageId + applicationId (APP-04)
// ---------------------------------------------------------------------------

export async function updateStageAction(
  stageId: number,
  applicationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = stageInputSchema.partial().safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  const result = await updateStage(userId, StageId(String(stageId)), parsed.data)
  if (result.isErr()) {
    const formError =
      result.error._tag === 'NotFound'
        ? 'Stage not found.'
        : 'Could not update stage.'
    return { ok: false, errors: {}, formError }
  }

  revalidatePath(`/applications/${applicationId}`)
  return initialOk
}

// ---------------------------------------------------------------------------
// completeStageAction — curried with stageId + applicationId (APP-04)
// Reads outcome from formData['outcome'] and parses via stageOutcomeEnum.
// ---------------------------------------------------------------------------

export async function completeStageAction(
  stageId: number,
  applicationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawOutcome = formData.get('outcome')
  const parsed = stageOutcomeEnum.safeParse(rawOutcome)
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  const result = await completeStage(userId, StageId(String(stageId)), parsed.data)
  if (result.isErr()) {
    const tag = result.error._tag
    let formError = 'Could not complete stage.'
    if (tag === 'NotFound') formError = 'Stage not found.'
    else if (tag === 'Conflict') formError = 'Stage already completed.'
    return { ok: false, errors: {}, formError }
  }

  revalidatePath(`/applications/${applicationId}`)
  return initialOk
}

// ---------------------------------------------------------------------------
// updateNotesAction — curried with applicationId (APP-04)
// Autosave-on-blur target. Returns notesChanged from the service so the action
// only revalidates on actual change (defensive — service is also a no-op on
// blank-to-blank).
// ---------------------------------------------------------------------------

export async function updateNotesAction(
  applicationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = notesInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  const result = await updateApplicationNotes(
    userId,
    ApplicationId(String(applicationId)),
    parsed.data,
  )
  if (result.isErr()) {
    const formError =
      result.error._tag === 'NotFound'
        ? 'Foray not found.'
        : 'Could not save notes.'
    return { ok: false, errors: {}, formError }
  }

  if (result.value.notesChanged) {
    revalidatePath(`/applications/${applicationId}`)
  }
  return initialOk
}

// ---------------------------------------------------------------------------
// updateTagsAction — curried with applicationId
// Receives tags as JSON string from the TagEditor component.
// ---------------------------------------------------------------------------

export async function updateTagsAction(
  applicationId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawTags = formData.get('tags')
  if (typeof rawTags !== 'string') {
    return { ok: false, errors: {}, formError: 'Tags data missing.' }
  }

  let tags: string[]
  try {
    tags = JSON.parse(rawTags)
    if (!Array.isArray(tags)) throw new Error()
  } catch {
    return { ok: false, errors: {}, formError: 'Invalid tags data.' }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()
  const userId = userResult.value.id

  // Normalize: lowercase, trim, deduplicate, filter empty
  const cleaned = [...new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean))]

  // Fetch current tags to compute diff
  const { withRls } = await import('@/core/db/with-rls')
  const { ApplicationId: AppId } = await import('@/core/types/ids')

  const result = await withRls(userId, async (tx) => {
    const appId = Number(applicationId)
    const app = await tx.application.findUnique({
      where: { id: appId },
      select: { id: true, userId: true, tags: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    const updated = await tx.application.update({
      where: { id: appId },
      data: { tags: { set: cleaned } },
      select: { tags: true },
    })

    return { tags: updated.tags }
  })

  if (result.isErr()) {
    // Translate throw-bridge: withRls wraps thrown errors as Db; unwrap
    // NOT_FOUND: prefix to produce the correct _tag for the check below.
    const err = result.error
    const isNotFound =
      err._tag === 'NotFound' ||
      (err._tag === 'Db' && err.cause instanceof Error && err.cause.message.startsWith('NOT_FOUND:'))
    const formError = isNotFound
      ? 'Foray not found.'
      : 'Could not save tags.'
    return { ok: false, errors: {}, formError }
  }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/applications')
  return initialOk
}
