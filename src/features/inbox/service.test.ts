// Unit tests for inbox/gmail-client.ts — extractEmailMetadata.
//
// Pure function tests — no DB, no mocks. Validates:
//   - From header parsing (display name + email)
//   - Domain extraction (lowercased)
//   - Body excerpt truncation (≤500 chars)
//   - Multipart message handling (prefers text/plain)
//   - Missing headers (graceful defaults)

import { describe, it, expect } from 'vitest'

import { extractEmailMetadata } from './gmail-client'
import type { gmail_v1 } from 'googleapis'

describe('extractEmailMetadata', () => {
  it('parses From header with display name', () => {
    const msg: gmail_v1.Schema$Message = {
      id: 'msg-1',
      threadId: 'thread-1',
      internalDate: '1715000000000',
      payload: {
        headers: [
          { name: 'From', value: 'John Doe <john@greenhouse.io>' },
          { name: 'Subject', value: 'Interview Invitation' },
        ],
        mimeType: 'text/plain',
        body: { data: Buffer.from('Hello world').toString('base64url') },
      },
    }

    const result = extractEmailMetadata(msg)
    expect(result.from).toBe('John Doe <john@greenhouse.io>')
    expect(result.fromDomain).toBe('greenhouse.io')
    expect(result.subject).toBe('Interview Invitation')
    expect(result.bodyExcerpt).toBe('Hello world')
    expect(result.gmailMessageId).toBe('msg-1')
    expect(result.gmailThreadId).toBe('thread-1')
  })

  it('truncates body excerpt to 500 chars', () => {
    const longBody = 'x'.repeat(1000)
    const msg: gmail_v1.Schema$Message = {
      id: 'msg-2',
      threadId: 'thread-2',
      internalDate: '1715000000000',
      payload: {
        headers: [
          { name: 'From', value: 'test@example.com' },
          { name: 'Subject', value: 'Test' },
        ],
        mimeType: 'text/plain',
        body: { data: Buffer.from(longBody).toString('base64url') },
      },
    }

    const result = extractEmailMetadata(msg)
    expect(result.bodyExcerpt.length).toBeLessThanOrEqual(500)
  })

  it('extracts plain text from multipart message', () => {
    const msg: gmail_v1.Schema$Message = {
      id: 'msg-3',
      threadId: 'thread-3',
      internalDate: '1715000000000',
      payload: {
        headers: [
          { name: 'From', value: 'test@example.com' },
          { name: 'Subject', value: 'Multipart' },
        ],
        mimeType: 'multipart/alternative',
        parts: [
          {
            mimeType: 'text/html',
            body: { data: Buffer.from('<p>HTML</p>').toString('base64url') },
          },
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from('Plain text body').toString('base64url') },
          },
        ],
      },
    }

    const result = extractEmailMetadata(msg)
    expect(result.bodyExcerpt).toBe('Plain text body')
  })

  it('handles missing headers gracefully', () => {
    const msg: gmail_v1.Schema$Message = {
      id: 'msg-4',
      threadId: 'thread-4',
      internalDate: '1715000000000',
      payload: {
        headers: [],
        mimeType: 'text/plain',
        body: {},
      },
    }

    const result = extractEmailMetadata(msg)
    expect(result.from).toBe('')
    expect(result.fromDomain).toBe('')
    expect(result.subject).toBe('')
    expect(result.bodyExcerpt).toBe('')
  })

  it('lowercases domain for consistent matching', () => {
    const msg: gmail_v1.Schema$Message = {
      id: 'msg-5',
      threadId: 'thread-5',
      internalDate: '1715000000000',
      payload: {
        headers: [
          { name: 'From', value: 'test@Example.COM' },
          { name: 'Subject', value: 'Test' },
        ],
        mimeType: 'text/plain',
        body: { data: Buffer.from('body').toString('base64url') },
      },
    }

    const result = extractEmailMetadata(msg)
    expect(result.fromDomain).toBe('example.com')
  })
})
