import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/capture/route'
import {
  generateApiToken,
  hashToken,
  revokeApiToken,
  storeApiTokenHash,
} from '@/core/auth/api-token'
import { UserId } from '@/core/types/ids'

const ALICE = UserId(1)
const BOB = UserId(2)

function makePostRequest(
  body: Record<string, unknown>,
  authorization?: string,
) {
  return new NextRequest('http://localhost:3000/api/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function storeTokenForUser(userId: ReturnType<typeof UserId>) {
  const token = generateApiToken()
  await storeApiTokenHash(userId, await hashToken(token))
  return token
}

describe('extension capture flow', () => {
  beforeEach(async () => {
    await revokeApiToken(ALICE)
    await revokeApiToken(BOB)
  })

  it('accepts a valid Bearer token and returns a redirectUrl', async () => {
    const token = await storeTokenForUser(ALICE)
    const req = makePostRequest(
      {
        title: 'Senior Engineer - Example',
        url: 'https://example.com/jobs/123',
      },
      `Bearer ${token}`,
    )

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.redirectUrl).toContain('/applications/new?prefilled=')
  })

  it('rejects an invalid Bearer token with 401', async () => {
    await storeTokenForUser(ALICE)
    const req = makePostRequest(
      { url: 'https://example.com/jobs/123' },
      'Bearer invalid-token',
    )

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Invalid API token')
  })

  it('accepts requests without Authorization for bookmarklet compatibility', async () => {
    const req = makePostRequest({ url: 'https://example.com/jobs/123' })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.redirectUrl).toContain('/applications/new?prefilled=')
  })

  it('rejects a token that belongs to a non-owner user', async () => {
    const token = await storeTokenForUser(BOB)
    const req = makePostRequest(
      { url: 'https://example.com/jobs/123' },
      `Bearer ${token}`,
    )

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Invalid API token')
  })

  it('rejects ATS domains even with a valid token', async () => {
    const token = await storeTokenForUser(ALICE)
    const req = makePostRequest(
      { url: 'https://company.greenhouse.io/jobs/123' },
      `Bearer ${token}`,
    )

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('ATS')
  })
})
