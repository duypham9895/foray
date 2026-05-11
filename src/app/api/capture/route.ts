// POST /api/capture — bookmarklet entry point.
//
// Receives { title, url, selectedText } from the bookmarklet, validates,
// rejects ATS domains, and returns a redirect URL with base64-encoded
// prefill data for /applications/new.
//
// CORS headers allow requests from any origin (bookmarklet runs on the
// job site's domain, not ours). OPTIONS handler for preflight.
//
// Per PRINCIPLES.md §"Route Handlers for cross-origin endpoints":
// - Explicit OPTIONS handler for CORS preflight
// - Validate Content-Type
// - Cap body size

import { NextRequest, NextResponse } from 'next/server'

import { findUserByApiToken } from '@/core/auth/api-token'
import { isAtsDomain } from '@/core/domains/ats-domains'
import { logger } from '@/core/logger'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

const MAX_BODY_BYTES = 4096

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

// Known limitation: multi-part TLDs (.co.uk, .com.au) extract incorrectly.
// TODO(edward, 2026-06-01): Replace with psl library when internationalized job sites are relevant.
function extractApexDomain(hostname: string): string {
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  return parts.slice(-2).join('.')
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  let authenticatedVia: 'bookmarklet' | 'extension' = 'bookmarklet'
  const authorization = req.headers.get('authorization')
  if (authorization) {
    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) {
      return jsonResponse({ error: 'Invalid API token' }, 401)
    }

    const user = await findUserByApiToken(token)
    if (!user) {
      return jsonResponse({ error: 'Invalid API token' }, 401)
    }
    authenticatedVia = 'extension'
  }

  // Content-Type check
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 415)
  }

  // Body size guard (measure bytes, not UTF-16 code units)
  const rawBody = await req.text()
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Request body too large' }, 413)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { title, url, selectedText } = body as Record<string, unknown>

  // Validate URL
  if (!url || typeof url !== 'string') {
    return jsonResponse({ error: 'url is required' }, 400)
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return jsonResponse({ error: 'Invalid URL' }, 400)
  }

  // Reject ATS domains
  if (isAtsDomain(url)) {
    logger.info({ op: 'capture.ats_rejected', url })
    return jsonResponse(
      { error: 'ATS domains must be filled manually. Visit the ATS directly and log the application.' },
      400,
    )
  }

  // Build prefill data
  const hostname = parsedUrl.hostname
  const prefillData = {
    companyName: hostname,
    companyDomain: extractApexDomain(hostname),
    roleTitle: typeof title === 'string' && title.trim() ? title.trim() : '',
    roleUrl: url,
    notes: typeof selectedText === 'string' && selectedText.trim() ? selectedText.trim() : '',
  }

  const encoded = Buffer.from(JSON.stringify(prefillData)).toString('base64url')

  logger.info({ op: 'capture.success', hostname, source: authenticatedVia })

  return jsonResponse(
    { redirectUrl: `/applications/new?prefilled=${encoded}` },
    200,
  )
}
