import 'server-only'

import { ok, type Result } from 'neverthrow'

import { errors, type AppError } from '@/core/errors'
import { UserId } from '@/core/types/ids'

// Single-user gate for v1. Reads APP_PASSWORD from env; the auth slice
// (Lean milestone) wires this to a real session cookie set by /login.
//
// On the public flip (per ADR-0003), replace requireUser's body with
// Clerk's auth() — the rest of the codebase keeps using these helpers
// unchanged. Stable interface, swappable implementation.

export async function requireUser(): Promise<Result<{ id: UserId }, AppError>> {
  // TODO(lean-milestone): replace with real session-cookie check.
  // The auth slice will:
  //   1. Read foray_session cookie
  //   2. Verify HMAC against APP_PASSWORD-derived secret
  //   3. Return the User from DB, or errors.unauthorized()
  const seededOwnerId = 1
  void errors // silence unused-import warning until real check lands
  return ok({ id: UserId(seededOwnerId) })
}

export async function verifySession(): Promise<{ id: UserId } | null> {
  const result = await requireUser()
  return result.isOk() ? result.value : null
}
