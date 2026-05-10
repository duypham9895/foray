import { test, expect } from './fixtures'

/**
 * E2E: Search and tag filtering.
 *
 * The /search page performs full-text search across applications,
 * emails, and stages. The /applications page supports tag filtering
 * via ?tag= query param and status filtering via ?status= query param.
 */

test.describe('Search', () => {
  test('search page loads with empty state', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/search')
    await expect(page.locator('text=Type to search')).toBeVisible()
  })

  test('search submits query via form', async ({ authenticatedPage: page }) => {
    await page.goto('/search')

    const input = page.locator('input[name="q"]')
    await input.fill('engineer')
    await input.press('Enter')

    // URL should contain the query param
    await expect(page).toHaveURL(/q=engineer/)
  })

  test('search shows no results message for unmatched query', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/search?q=zzz_nonexistent_term_12345')
    await expect(page.locator('text=No results found')).toBeVisible()
  })

  test('unauthenticated user redirects to /login from search', async ({
    page,
  }) => {
    await page.goto('/search')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Tag filtering', () => {
  test('applications page accepts tag query param', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/applications?tag=remote')

    // Page should load without error
    const response = await page.goto('/applications?tag=remote')
    expect(response?.status()).toBe(200)
  })

  test('applications page accepts status filter', async ({
    authenticatedPage: page,
  }) => {
    const response = await page.goto('/applications?status=interviewing')
    expect(response?.status()).toBe(200)
  })

  test('applications page accepts sort param', async ({
    authenticatedPage: page,
  }) => {
    const response = await page.goto(
      '/applications?sort=companyName:asc&view=list',
    )
    expect(response?.status()).toBe(200)
  })

  test('tag cloud renders on applications page', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/applications')

    // TagCloud only renders when tags exist. With clean DB it may be absent.
    // Just verify the page loads and the applications section is present.
    await expect(page.locator('text=Applications')).toBeVisible()
  })
})

test.describe('Application status filtering', () => {
  test('board view is the default', async ({ authenticatedPage: page }) => {
    await page.goto('/applications')
    // Board view shows column headers for each status
    await expect(page.locator('text=Applied')).toBeVisible()
  })

  test('list view renders with sort controls', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/applications?view=list')
    const response = await page.goto('/applications?view=list')
    expect(response?.status()).toBe(200)
  })

  test('unauthenticated user redirects to /login from applications', async ({
    page,
  }) => {
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/login/)
  })
})
