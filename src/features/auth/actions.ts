'use server'

import { redirect } from 'next/navigation'
import { loginSchema } from './schema'
import * as service from './service'

export type LoginState =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> }

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors }

  const result = await service.verifyPasswordAndIssueSession(parsed.data.password)
  if (result.isErr()) {
    return { ok: false, errors: { password: ['Incorrect password'] } }
  }
  redirect('/applications')
}

export async function logout(): Promise<void> {
  await service.destroySession()
  redirect('/login')
}
