import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { fromPromise, type Result, type ResultAsync } from '@/core/errors'
import { errors, type AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'

import { prisma } from './client'

/**
 * Open an interactive transaction with `app.user_id` set so RLS policies fire.
 * All Prisma calls inside the callback use `tx`, NOT the global `prisma`.
 *
 * The `, true` arg to `set_config` makes it transaction-local (equivalent to
 * `SET LOCAL`) — required so the value does not leak to the next request that
 * reuses the connection from the pool.
 *
 * Use for any multi-statement operation that must be atomic AND tenant-checked.
 * For single-row reads where atomicity is not required, `tenantDb(userId)` is
 * still preferred (no transaction overhead).
 *
 * Returns `ResultAsync<T, AppError>` (a `Promise`-like from neverthrow that
 * resolves to `Result<T, AppError>`). Callers `await` it to get the inner
 * `Result`.
 */
export function withRls<T>(
  userId: UserId,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): ResultAsync<T, AppError> {
  return fromPromise(
    prisma.$transaction(async (tx) => {
      // CRITICAL: the third arg to set_config (`true`) makes it transaction-local.
      // The second arg to current_setting (`true`) makes it return NULL when unset
      // instead of throwing — the policy then denies all rows, which is correct.
      await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`
      return fn(tx)
    }),
    (cause) => errors.db(cause),
  )
}
