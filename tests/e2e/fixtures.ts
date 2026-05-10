/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from "@playwright/test";

/**
 * Extended Playwright test with foray-specific fixtures.
 *
 * - `authenticatedPage`: a Page that has already logged in via /login
 * - `resetDb`: truncates tenant-scoped tables between tests
 */

const APP_PASSWORD = process.env.APP_PASSWORD ?? "correct-horse-battery-staple";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("#password", APP_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/applications", { timeout: 10_000 });
}

export const test = base.extend<{
  /** A Page already authenticated as the test user. */
  authenticatedPage: Page;
  /** Truncates application + email tables before the test runs. */
  resetDb: void;
}>({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },

  resetDb: [
    async ({}, use) => {
      // Reset via internal API or direct DB call.
      // Uses the e2e:reset-db script which truncates tenant-scoped tables.
      const { execSync } = await import("node:child_process");
      try {
        execSync("pnpm e2e:reset-db", { stdio: "pipe" });
      } catch {
        // If the script doesn't exist yet, we silently continue.
        // Tests will fail naturally if the DB state is wrong.
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
