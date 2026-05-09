import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],

    // forks pool avoids parallel Postgres-write conflicts while keeping
    // process isolation. maxWorkers=1 ensures a single fork (singleFork
    // equivalent in Vitest 4 — poolOptions was removed in v4).
    // Per Pitfalls #3 + Stack research.
    pool: 'forks',
    maxWorkers: 1,

    // globalSetup boots Testcontainers ONCE per test run, not per file.
    globalSetup: './tests/integration/setup.ts',

    // Integration tests need the real DB; unit tests can stay parallel.
    include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // server-only is a Next.js package that throws when imported outside
      // a server context. In tests we mock it as a no-op.
      'server-only': path.resolve(__dirname, 'src/__mocks__/server-only.ts'),
    },
  },
})
