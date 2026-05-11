// =============================================================================
// foray — Prisma Config (Prisma 7+)
// =============================================================================
// In Prisma 7, the connection URL moved out of schema.prisma. This config
// supplies it to the migrate engine and seed runner.
//
// At runtime, PrismaClient is instantiated with @prisma/adapter-pg using the
// same DATABASE_URL — see src/core/db/client.ts or scripts/seed.ts for the
// pattern.
// =============================================================================

import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx scripts/seed.ts',
  },
})
