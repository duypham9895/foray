import 'server-only'

import { z } from 'zod'

// Zod-validated environment variables. Parsed once at module load; throws
// at startup if invalid, so misconfigured envs fail loud instead of at runtime.
//
// To add a new env var:
//   1. Add to .env.example with a comment
//   2. Add to envSchema below with appropriate constraints + default
//   3. Use as env.MY_VAR throughout the app

export const envSchema = z.object({
  // -- Required at runtime (any environment) --------------------------------
  DATABASE_URL: z.url(),

  // -- Required for security primitives -------------------------------------
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes). Run: openssl rand -hex 32'),

  APP_PASSWORD: z.string().min(12, 'APP_PASSWORD must be at least 12 characters'),

  APP_SESSION_SECRET: z
    .string()
    .min(32, 'APP_SESSION_SECRET must be ≥32 chars per iron-session requirement. Run: openssl rand -hex 32'),

  // -- Optional in v1; required when relevant feature lands -----------------
  ANTHROPIC_API_KEY:   z.string().optional(),
  GOOGLE_CLIENT_ID:    z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.url().default('http://localhost:3000/api/gmail/callback'),

  // -- Tunables --------------------------------------------------------------
  CLASSIFIER_AUTO_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  throw new Error('Invalid environment variables. See .env.example.')
}

export const env = parsed.data
