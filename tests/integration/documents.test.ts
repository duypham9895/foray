// Integration tests for document API routes.
//
// Tests the full HTTP request-response cycle for:
// - POST /api/applications/{id}/documents (upload)
// - GET /api/applications/{id}/documents (list)
// - GET /api/documents/{id} (download)
// - DELETE /api/documents/{id} (delete)
//
// Uses direct handler imports + NextRequest (same pattern as capture.test.ts).
// Mocks requireUser and withRls for isolation from DB.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock file system for download tests
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test content')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}))

// Mock auth — return a test user by default
const mockUserId = '1'
vi.mock('@/core/auth/session', () => ({
  requireUser: vi.fn().mockResolvedValue({ isOk: () => true, value: { id: '1' }, isErr: () => false }),
}))

// Mock the document service
const mockDocument = {
  id: 1,
  applicationId: 1,
  kind: 'resume',
  filename: 'resume.pdf',
  mimeType: 'application/pdf',
  storagePath: '/tmp/test.pdf',
  sizeBytes: 1024,
  notes: null,
  createdAt: new Date(),
}

vi.mock('@/features/documents/service', () => ({
  uploadDocument: vi.fn(),
  getDocument: vi.fn(),
  deleteDocument: vi.fn(),
  listDocuments: vi.fn(),
}))

// Import after mocks are set up
import { POST, GET as ListGET } from '@/app/api/applications/[id]/documents/route'
import { GET as DownloadGET, DELETE } from '@/app/api/documents/[id]/route'
import { requireUser } from '@/core/auth/session'
import {
  uploadDocument,
  getDocument,
  deleteDocument,
  listDocuments,
} from '@/features/documents/service'

function makeUploadRequest(appId: string, body?: FormData) {
  const formData = body ?? new FormData()
  if (!formData.has('file')) {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34])
    formData.append('file', new File([pdfBytes], 'resume.pdf', { type: 'application/pdf' }))
  }
  if (!formData.has('kind')) {
    formData.append('kind', 'resume')
  }
  return new NextRequest(`http://localhost:3000/api/applications/${appId}/documents`, {
    method: 'POST',
    body: formData,
  })
}

function makeListRequest(appId: string) {
  return new NextRequest(`http://localhost:3000/api/applications/${appId}/documents`, {
    method: 'GET',
  })
}

function makeDownloadRequest(docId: string) {
  return new NextRequest(`http://localhost:3000/api/documents/${docId}`, {
    method: 'GET',
  })
}

function makeDeleteRequest(docId: string) {
  return new NextRequest(`http://localhost:3000/api/documents/${docId}`, {
    method: 'DELETE',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: authenticated
  vi.mocked(requireUser).mockResolvedValue({ isOk: () => true, value: { id: '1' as any }, isErr: () => false } as any)
})

describe('POST /api/applications/[id]/documents', () => {
  it('uploads a document and returns 201 with documentId and eventId', async () => {
    vi.mocked(uploadDocument).mockResolvedValue({
      isOk: () => true,
      value: { documentId: 1, eventId: 10 },
      isErr: () => false,
    } as any)

    const req = makeUploadRequest('1')
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.documentId).toBe(1)
    expect(data.eventId).toBe(10)
  })

  it('rejects unauthenticated upload with 401', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'Unauthorized' },
    } as any)

    const req = makeUploadRequest('1')
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 when file is missing', async () => {
    const formData = new FormData()
    formData.append('kind', 'resume')
    const req = new NextRequest('http://localhost:3000/api/applications/1/documents', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req, { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('file')
  })

  it('returns 422 when service returns validation error', async () => {
    vi.mocked(uploadDocument).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'Validation', issues: [{ code: 'custom', message: 'File exceeds 10MB limit', path: ['file'] }] },
    } as any)

    const req = makeUploadRequest('1')
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.error).toContain('10MB')
  })

  it('returns 404 when application not found', async () => {
    vi.mocked(uploadDocument).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'NotFound', resource: 'Application', id: '999' },
    } as any)

    const req = makeUploadRequest('999')
    const res = await POST(req, { params: Promise.resolve({ id: '999' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toContain('Application')
  })

  it('creates document_uploaded event on successful upload', async () => {
    vi.mocked(uploadDocument).mockResolvedValue({
      isOk: () => true,
      value: { documentId: 42, eventId: 99 },
      isErr: () => false,
    } as any)

    const req = makeUploadRequest('1')
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.documentId).toBe(42)
    expect(data.eventId).toBe(99)
    // The service layer creates a document_uploaded event — verify the mock was called
    expect(uploadDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'resume',
      undefined,
    )
  })
})

describe('GET /api/applications/[id]/documents', () => {
  it('returns 200 with documents array', async () => {
    vi.mocked(listDocuments).mockResolvedValue({
      isOk: () => true,
      value: [mockDocument],
      isErr: () => false,
    } as any)

    const req = makeListRequest('1')
    const res = await ListGET(req, { params: Promise.resolve({ id: '1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    expect(data[0].filename).toBe('resume.pdf')
  })

  it('rejects unauthenticated list with 401', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'Unauthorized' },
    } as any)

    const req = makeListRequest('1')
    const res = await ListGET(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/documents/[id]', () => {
  it('downloads a document with correct Content-Type and Content-Disposition headers', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      isOk: () => true,
      value: mockDocument,
      isErr: () => false,
    } as any)

    const req = makeDownloadRequest('1')
    const res = await DownloadGET(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('resume.pdf')
  })

  it('returns 404 for non-existent document', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'NotFound', resource: 'Document', id: '999' },
    } as any)

    const req = makeDownloadRequest('999')
    const res = await DownloadGET(req, { params: Promise.resolve({ id: '999' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toContain('Document')
  })

  it('rejects unauthenticated download with 401', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'Unauthorized' },
    } as any)

    const req = makeDownloadRequest('1')
    const res = await DownloadGET(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/documents/[id]', () => {
  it('deletes a document and returns 204', async () => {
    vi.mocked(deleteDocument).mockResolvedValue({
      isOk: () => true,
      value: undefined,
      isErr: () => false,
    } as any)

    const req = makeDeleteRequest('1')
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(204)
  })

  it('returns 404 for non-existent document', async () => {
    vi.mocked(deleteDocument).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'NotFound', resource: 'Document', id: '999' },
    } as any)

    const req = makeDeleteRequest('999')
    const res = await DELETE(req, { params: Promise.resolve({ id: '999' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
  })

  it('rejects unauthenticated delete with 401', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { _tag: 'Unauthorized' },
    } as any)

    const req = makeDeleteRequest('1')
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) })

    expect(res.status).toBe(401)
  })
})
