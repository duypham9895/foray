'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/core/auth/session'
import { ApplicationId, RecruiterId } from '@/core/types/ids'

import {
  createRecruiter,
  linkRecruiterToApplication,
  unlinkRecruiterFromApplication,
  updateRecruiter,
} from './service'
import { linkRecruiterInputSchema, recruiterInputSchema } from './schema'

import type { ZodError } from 'zod'

export type RecruiterActionState =
  | { ok: true; formError?: undefined; errors?: undefined }
  | { ok: false; formError?: string; errors: Record<string, string[]> }

const initialOk: RecruiterActionState = { ok: true }

function authError(): RecruiterActionState {
  return { ok: false, errors: {}, formError: 'Unauthorized. Please sign in again.' }
}

function fieldErrorsFromZod(error: ZodError): Record<string, string[]> {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>
  const out: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(flat)) {
    if (value?.length) out[key] = value
  }
  return out
}

function fieldErrorsFromResult(error: unknown): Record<string, string[]> {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'Validation' &&
    'issues' in error &&
    Array.isArray(error.issues)
  ) {
    const out: Record<string, string[]> = {}
    for (const issue of error.issues) {
      const field = String(issue.path?.[0] ?? '_')
      out[field] ??= []
      out[field].push(String(issue.message))
    }
    return out
  }
  return {}
}

export async function createRecruiterAction(
  _prev: RecruiterActionState,
  formData: FormData,
): Promise<RecruiterActionState> {
  const parsed = recruiterInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()

  const result = await createRecruiter(userResult.value.id, parsed.data)
  if (result.isErr()) {
    return {
      ok: false,
      errors: fieldErrorsFromResult(result.error),
      formError: result.error._tag === 'NotFound'
        ? 'Company not found.'
        : 'Could not save recruiter.',
    }
  }

  revalidatePath('/recruiters')
  return initialOk
}

export async function updateRecruiterAction(
  recruiterId: number,
  _prev: RecruiterActionState,
  formData: FormData,
): Promise<RecruiterActionState> {
  const parsed = recruiterInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()

  const result = await updateRecruiter(
    userResult.value.id,
    RecruiterId(recruiterId),
    parsed.data,
  )
  if (result.isErr()) {
    return {
      ok: false,
      errors: fieldErrorsFromResult(result.error),
      formError: result.error._tag === 'NotFound'
        ? 'Recruiter not found.'
        : 'Could not update recruiter.',
    }
  }

  revalidatePath('/recruiters')
  revalidatePath('/applications')
  return initialOk
}

export async function linkRecruiterAction(
  applicationId: number,
  _prev: RecruiterActionState,
  formData: FormData,
): Promise<RecruiterActionState> {
  const parsed = linkRecruiterInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, errors: fieldErrorsFromZod(parsed.error) }
  }

  const userResult = await requireUser()
  if (userResult.isErr()) return authError()

  const result = await linkRecruiterToApplication(
    userResult.value.id,
    ApplicationId(applicationId),
    parsed.data,
  )
  if (result.isErr()) {
    return {
      ok: false,
      errors: fieldErrorsFromResult(result.error),
      formError: result.error._tag === 'NotFound'
        ? 'Foray or recruiter not found.'
        : 'Could not link recruiter.',
    }
  }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/recruiters')
  return initialOk
}

export async function unlinkRecruiterAction(
  applicationId: number,
  recruiterId: number,
): Promise<void> {
  const userResult = await requireUser()
  if (userResult.isErr()) return

  await unlinkRecruiterFromApplication(
    userResult.value.id,
    ApplicationId(applicationId),
    RecruiterId(recruiterId),
  )

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/recruiters')
}
