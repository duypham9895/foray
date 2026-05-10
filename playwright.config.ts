import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for foray.
 *
 * Tests run against the local Next.js dev server on port 3000.
 * Sequential execution (fullyParallel: false) because DB state is
 * shared across tests within a spec file.
 *
 * Set E2E_APP_PASSWORD env var or it defaults to .env.local APP_PASSWORD.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
