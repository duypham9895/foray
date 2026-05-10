import { test, expect } from './fixtures'

/**
 * E2E: Bookmarklet capture flow.
 *
 * The bookmarklet POSTs { title, url, selectedText } to /api/capture,
 * which returns a redirect URL with base64-encoded prefill data.
 * The user lands on /applications/new with the form auto-populated.
 *
 * These tests exercise the API endpoint directly (the bookmarklet itself
 * is a thin JS shim that calls fetch), then verify the form prefill.
 */

test.describe('Bookmarklet capture flow', () => {
  test('POST /api/capture returns redirect URL with prefill data', async ({
    request,
  }) => {
    const res = await request.post('/api/capture', {
      data: {
        title: 'Senior Frontend Engineer',
        url: 'https://example.com/careers/senior-frontend',
        selectedText: 'React, TypeScript, 5+ years experience',
      },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.redirectUrl).toMatch(/^\/applications\/new\?prefilled=/)

    // Decode and verify prefill data
    const encoded = body.redirectUrl.split('prefilled=')[1]
    const prefill = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    expect(prefill.roleTitle).toBe('Senior Frontend Engineer')
    expect(prefill.roleUrl).toBe('https://example.com/careers/senior-frontend')
    expect(prefill.companyDomain).toBe('example.com')
    expect(prefill.companyName).toBe('example.com')
    expect(prefill.notes).toBe('React, TypeScript, 5+ years experience')
  })

  test('capture form prefills from base64 query param', async ({
    authenticatedPage: page,
    request,
  }) => {
    // First, get the redirect URL from the capture API
    const res = await request.post('/api/capture', {
      data: {
        title: 'Staff Backend Engineer',
        url: 'https://acme.org/jobs/staff-backend',
        selectedText: '',
      },
    })
    const { redirectUrl } = await res.json()

    // Navigate to the prefilled form
    await page.goto(redirectUrl)

    // Verify form is prefilled
    const roleTitle = page.locator('input[name="roleTitle"]')
    await expect(roleTitle).toHaveValue('Staff Backend Engineer')

    const roleUrl = page.locator('input[name="roleUrl"]')
    await expect(roleUrl).toHaveValue('https://acme.org/jobs/staff-backend')
  })

  test('capture rejects ATS domains', async ({ request }) => {
    const res = await request.post('/api/capture', {
      data: {
        title: 'Engineer',
        url: 'https://boards.greenhouse.io/acme/jobs/12345',
      },
    })

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/ATS/i)
  })

  test('capture rejects non-JSON content type', async ({ request }) => {
    const res = await request.post('/api/capture', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not json',
    })

    expect(res.status()).toBe(415)
  })

  test('capture rejects missing url', async ({ request }) => {
    const res = await request.post('/api/capture', {
      data: { title: 'Engineer' },
    })

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/url/i)
  })

  test('capture handles empty selectedText gracefully', async ({
    request,
  }) => {
    const res = await request.post('/api/capture', {
      data: {
        title: 'Engineer',
        url: 'https://example.com/job',
        selectedText: '',
      },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    const encoded = body.redirectUrl.split('prefilled=')[1]
    const prefill = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    expect(prefill.notes).toBe('')
  })
})
