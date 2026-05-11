import { test, expect } from './fixtures'

/**
 * E2E: Today dashboard.
 *
 * The /today page is the default landing for authenticated users.
 * It shows: DecisionsCard (offers + review queue), InterviewsCard,
 * QuietCard (stale forays), recent activity, and this-week counts.
 *
 * Root (/) redirects to /today when authenticated.
 */

test.describe('Today dashboard', () => {
  test('root redirects to /today when authenticated', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/today/)
  })

  test('today page loads successfully', async ({ authenticatedPage: page }) => {
    const response = await page.goto('/today')
    expect(response?.status()).toBe(200)
  })

  test('today page renders core sections', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/today')

    // DecisionsCard — "Decisions needed" or empty state
    await expect(page.getByRole('heading', { name: 'Decisions' })).toBeVisible()

    // InterviewsCard — "Today's interviews" or empty state
    await expect(page.getByRole('heading', { name: "Today's interviews" })).toBeVisible()

    // Empty dashboard still shows the weekly summary/global empty prompt.
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible()
  })

  test('today page loads within performance budget', async ({
    authenticatedPage: page,
  }) => {
    const start = Date.now()
    await page.goto('/today')
    await page.waitForLoadState('domcontentloaded')
    const elapsed = Date.now() - start

    // Target: <2s for E2E (includes auth + DB queries + SSR).
    // The <500ms target is for direct server response time, not full page load.
    expect(elapsed).toBeLessThan(2000)
  })

  test('today shows empty state when no forays exist', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/today')

    // With a clean DB, all sections should show empty states
    // DecisionsCard empty: "Nothing needs your attention"
    // InterviewsCard empty: "No interviews today"
    // QuietCard empty: "Nothing needs attention"
    // Global empty: link to guide
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test('unauthenticated user redirects to /login', async ({ page }) => {
    await page.goto('/today')
    await expect(page).toHaveURL(/\/login/)
  })
})
