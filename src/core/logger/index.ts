import 'server-only'

import pino from 'pino'

// Structured JSON logger. Every log line carries enough context (slice,
// requestId, userId) to reconstruct a request's flow from a grep.
//
// Usage:
//   const log = logger.child({ slice: 'inbox' })
//   log.info({ phase: 'sync_start', userId, syncId }, 'starting sync')
//
// See PRINCIPLES.md §"Observability" for the AsyncLocalStorage request-context
// wiring that lands in the Lean milestone.

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      '*.authorization',
      '*.cookie',
      '*.refreshToken',
      '*.refresh_token',
      '*.gmailRefreshTokenEncrypted',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    },
  }),
})
