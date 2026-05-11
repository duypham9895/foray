// AppError taxonomy + Result re-export.
//
// All expected-failure boundaries (Server Actions, services, external APIs)
// return Result<T, AppError>. Throw is reserved for genuine programmer errors.
//
// See PRINCIPLES.md §"Error handling" for full philosophy.

import type { ZodIssue } from 'zod'

export type AppError =
  | { _tag: 'NotFound';     resource: string; id: string }
  | { _tag: 'Unauthorized' }
  | { _tag: 'Forbidden';    reason: string }
  | { _tag: 'Validation';   issues: ZodIssue[] }
  | { _tag: 'ExternalApi';  service: 'gmail' | 'calendar' | 'llm'; cause: unknown }
  | { _tag: 'Db';           cause: unknown }
  | { _tag: 'RateLimited';  retryAfterSeconds: number }
  | { _tag: 'Conflict';     reason: string }

// Re-export neverthrow primitives so consumers import from @/core/errors only.
export {
  ok,
  err,
  okAsync,
  errAsync,
  Result,
  ResultAsync,
  fromPromise,
  fromThrowable,
} from 'neverthrow'

// Convenience constructors. Use these instead of inline object literals so
// changes to the taxonomy surface as type errors at the construction site.
export const errors = {
  notFound:     (resource: string, id: string): AppError => ({ _tag: 'NotFound', resource, id }),
  unauthorized: (): AppError => ({ _tag: 'Unauthorized' }),
  forbidden:    (reason: string): AppError => ({ _tag: 'Forbidden', reason }),
  validation:   (issues: ZodIssue[]): AppError => ({ _tag: 'Validation', issues }),
  externalApi:  (service: 'gmail' | 'calendar' | 'llm', cause: unknown): AppError => ({ _tag: 'ExternalApi', service, cause }),
  db:           (cause: unknown): AppError => ({ _tag: 'Db', cause }),
  rateLimited:  (retryAfterSeconds: number): AppError => ({ _tag: 'RateLimited', retryAfterSeconds }),
  conflict:     (reason: string): AppError => ({ _tag: 'Conflict', reason }),
}

// Exhaustiveness helper — call in the default branch of an AppError switch
// to get a compile-time error if a new variant is added without a handler.
export function assertNeverError(x: never): never {
  throw new Error(`Unhandled AppError variant: ${JSON.stringify(x)}`)
}
