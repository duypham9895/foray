// Integration tests for POST /api/capture — bookmarklet entry point.
//
// Covers the capture route handler: CORS, ATS rejection, valid URL handling,
// prefill data encoding. No DB required — the route is pure validation + redirect.
//
// Tests import POST/OPTIONS handlers directly and call with NextRequest.

import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

import { POST, OPTIONS } from '@/app/api/capture/route'

function makePostRequest(body: Record<string, unknown>, contentType = 'application/json') {
  return new NextRequest('http://localhost:3000/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: JSON.stringify(body),
  })
}


describe('POST /api/capture', () => {
  it('accepts valid bookmarklet POST and returns redirectUrl', async () => {
    const req = makePostRequest({
      title: 'Senior Engineer - Google',
      url: 'https://google.com/careers/123',
      selectedText: 'preferred: 5+ years experience',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.redirectUrl).toContain('/applications/new?prefilled=')

    // Decode and verify prefill data
    const encoded = data.redirectUrl.split('prefilled=')[1]
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    expect(decoded.companyName).toBe('google.com')
    expect(decoded.companyDomain).toBe('google.com')
    expect(decoded.roleTitle).toBe('Senior Engineer - Google')
    expect(decoded.roleUrl).toBe('https://google.com/careers/123')
    expect(decoded.notes).toBe('preferred: 5+ years experience')
  })

  it('rejects ATS domains with 400', async () => {
    const req = makePostRequest({
      url: 'https://company.greenhouse.io/jobs/123',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('ATS')
  })

  it('rejects Workday ATS domains', async () => {
    const req = makePostRequest({
      url: 'https://mycompany.wd3.myworkdayjobs.com/en-US/Job',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('ATS')
  })

  it('returns 400 when url is missing', async () => {
    const req = makePostRequest({ title: 'Test' })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('url')
  })

  it('returns 400 for invalid URL format', async () => {
    const req = makePostRequest({ url: 'not-a-url' })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid URL')
  })

  it('returns 415 for non-JSON Content-Type', async () => {
    const req = new NextRequest('http://localhost:3000/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(415)
    expect(data.error).toContain('Content-Type')
  })

  it('sets CORS headers on response', async () => {
    const req = makePostRequest({
      url: 'https://example.com/job',
    })

    const res = await POST(req)

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('handles missing optional fields gracefully', async () => {
    const req = makePostRequest({
      url: 'https://example.com/job',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)

    const encoded = data.redirectUrl.split('prefilled=')[1]
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    expect(decoded.roleTitle).toBe('')
    expect(decoded.notes).toBe('')
  })

  it('extracts subdomain correctly for companyDomain', async () => {
    const req = makePostRequest({
      url: 'https://careers.stripe.com/openings',
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)

    const encoded = data.redirectUrl.split('prefilled=')[1]
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    expect(decoded.companyName).toBe('careers.stripe.com')
    expect(decoded.companyDomain).toBe('stripe.com')
  })
})

describe('OPTIONS /api/capture', () => {
  it('returns 204 with CORS headers', async () => {
    const res = await OPTIONS()

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
  })
})
