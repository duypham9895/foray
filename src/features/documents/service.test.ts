// Unit tests for documents/service.ts.
//
// Mocks withRls and node:fs/promises to test service logic in isolation.
// Each test verifies a specific behavior contract from the plan.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok, err } from 'neverthrow'

import { errors } from '@/core/errors'
import type { UserId, ApplicationId } from '@/core/types/ids'

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() ensures these are available when vi.mock factories run
// ---------------------------------------------------------------------------

const { mockMkdir, mockWriteFile, mockRm } = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockRm: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises', () => ({
  default: { mkdir: mockMkdir, writeFile: mockWriteFile, rm: mockRm },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  rm: mockRm,
}))

// Mock @/core/db/with-rls — uses a mutable ref so beforeEach can swap the tx.
type MockTx = {
  application: {
    findUnique: ReturnType<typeof vi.fn>
  }
  document: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  event: {
    create: ReturnType<typeof vi.fn>
  }
}

function createMockTx(): MockTx {
  return {
    application: {
      findUnique: vi.fn(),
    },
    document: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    event: {
      create: vi.fn(),
    },
  }
}

// Mutable ref — the mock closure reads from ref.current.
const txRef = vi.hoisted(() => ({ current: createMockTx() }))

vi.mock('@/core/db/with-rls', () => ({
  withRls: vi.fn(
    (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txRef.current)
        .then((result) => ok(result))
        .catch((cause) => err(errors.db(cause)))
    },
  ),
}))

let mockTx: MockTx

// Import AFTER mocks are set up.
import {
  detectMimeType,
  sanitizeFilename,
  uploadDocument,
  deleteDocument,
  listDocuments,
  getDocument,
} from './service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALICE = '1' as UserId
const APP_ID = '100' as ApplicationId

/** Create a minimal mock File with given size and content. */
function mockFile(
  name: string,
  content: Uint8Array,
  mimeType = 'application/pdf',
): File {
  // Wrap in a new ArrayBuffer to satisfy strict TS BlobPart types.
  const ab = new ArrayBuffer(content.byteLength)
  new Uint8Array(ab).set(content)
  return new File([ab], name, { type: mimeType })
}

/** A valid PDF header: %PDF */
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46])
/** A valid PNG header */
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
/** A valid JPEG header */
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff])
/** Random bytes that match no known magic */
const UNKNOWN_HEADER = new Uint8Array([0x00, 0x01, 0x02, 0x03])

// ---------------------------------------------------------------------------
// detectMimeType
// ---------------------------------------------------------------------------

describe('detectMimeType', () => {
  it('detects PDF from magic bytes', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set(PDF_HEADER)
    expect(detectMimeType(buf)).toBe('application/pdf')
  })

  it('detects PNG from magic bytes', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set(PNG_HEADER)
    expect(detectMimeType(buf)).toBe('image/png')
  })

  it('detects JPEG from magic bytes', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set(JPEG_HEADER)
    expect(detectMimeType(buf)).toBe('image/jpeg')
  })

  it('detects DOCX (ZIP) from magic bytes', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set([0x50, 0x4b, 0x03, 0x04])
    expect(detectMimeType(buf)).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  })

  it('detects DOC (OLE2) from magic bytes', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set([0xd0, 0xcf, 0x11, 0xe0])
    expect(detectMimeType(buf)).toBe('application/msword')
  })

  it('detects plain text from printable ASCII bytes', () => {
    const text = 'Hello, World!'
    const buf = new TextEncoder().encode(text).buffer
    expect(detectMimeType(buf)).toBe('text/plain')
  })

  it('returns null for unknown bytes', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set(UNKNOWN_HEADER)
    expect(detectMimeType(buf)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  it('replaces special characters with underscores', () => {
    expect(sanitizeFilename('my resume (v2).pdf')).toBe('my_resume__v2_.pdf')
  })

  it('preserves dots, hyphens, and underscores', () => {
    expect(sanitizeFilename('file-name_v2.pdf')).toBe('file-name_v2.pdf')
  })

  it('truncates to 200 characters', () => {
    const longName = 'a'.repeat(300) + '.pdf'
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(200)
  })
})

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

describe('uploadDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTx = createMockTx()
    txRef.current = mockTx

    // Default: application exists and belongs to ALICE.
    mockTx.application.findUnique.mockResolvedValue({
      id: 100,
      userId: 1,
    })

    // Default: document create returns an id.
    mockTx.document.create.mockResolvedValue({ id: 42 })
    mockTx.document.update.mockResolvedValue({})
    mockTx.event.create.mockResolvedValue({ id: 99 })
  })

  it('Test 1: valid PDF creates Document row + Event(type=document_uploaded) in one transaction', async () => {
    const file = mockFile('resume.pdf', PDF_HEADER)

    const result = await uploadDocument(ALICE, APP_ID, file, 'resume')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    const { documentId, eventId } = result.value
    expect(documentId).toBe(42)
    expect(eventId).toBe(99)

    // Document.create was called with correct data.
    expect(mockTx.document.create).toHaveBeenCalledTimes(1)
    const createArg = mockTx.document.create.mock.calls[0]![0]
    expect(createArg.data.applicationId).toBe(100)
    expect(createArg.data.kind).toBe('resume')
    expect(createArg.data.mimeType).toBe('application/pdf')
    expect(createArg.data.sizeBytes).toBe(file.size)

    // Event.create was called with type=document_uploaded.
    expect(mockTx.event.create).toHaveBeenCalledTimes(1)
    const eventArg = mockTx.event.create.mock.calls[0]![0]
    expect(eventArg.data.type).toBe('document_uploaded')
    expect(eventArg.data.data.documentId).toBe(42)
    expect(eventArg.data.data.kind).toBe('resume')
  })

  it('Test 2: file > 10MB returns err(validation) without touching disk', async () => {
    // Create a file that reports > 10MB size.
    const bigContent = new Uint8Array(1024) // small content
    const bigFile = mockFile('big.pdf', bigContent)
    // Override size property.
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })

    const result = await uploadDocument(ALICE, APP_ID, bigFile, 'resume')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
    }

    // Should not have touched disk or DB.
    expect(mockMkdir).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockTx.document.create).not.toHaveBeenCalled()
  })

  it('Test 3: MIME mismatch (unknown magic bytes) returns err(validation)', async () => {
    const file = mockFile('resume.pdf', UNKNOWN_HEADER)

    const result = await uploadDocument(ALICE, APP_ID, file, 'resume')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('Validation')
    }

    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockTx.document.create).not.toHaveBeenCalled()
  })

  it('Test 4: stores file at data/documents/{applicationId}/{tempId}/{sanitized-filename}', async () => {
    const file = mockFile('resume.pdf', PDF_HEADER)

    const result = await uploadDocument(ALICE, APP_ID, file, 'resume')
    expect(result.isOk()).toBe(true)

    // mkdir was called for the directory.
    expect(mockMkdir).toHaveBeenCalledTimes(1)
    const mkdirPath = mockMkdir.mock.calls[0]![0] as string
    expect(mkdirPath).toContain('data/documents')
    expect(mkdirPath).toContain('100')
    // tempId is a UUID v4 (36 chars with hyphens)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    expect(mkdirPath).toMatch(uuidPattern)

    // writeFile was called with the storage path.
    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    const writePath = mockWriteFile.mock.calls[0]![0] as string
    expect(writePath).toContain('resume.pdf')

    // Document was created with storagePath.
    expect(mockTx.document.create).toHaveBeenCalledTimes(1)
    const createArg = mockTx.document.create.mock.calls[0]![0]
    expect(createArg.data.storagePath).toContain('data/documents')
  })

  it('Test 5: path traversal attempt (../ in filename) sanitizes to safe characters', async () => {
    const file = mockFile('../../../etc/passwd', PDF_HEADER)

    const result = await uploadDocument(ALICE, APP_ID, file, 'resume')
    expect(result.isOk()).toBe(true)

    // The filename stored in the DB should be sanitized.
    const createArg = mockTx.document.create.mock.calls[0]![0]
    expect(createArg.data.filename).not.toContain('..')
    expect(createArg.data.filename).not.toContain('/')
    // All path separators replaced with underscores.
    expect(createArg.data.filename).toMatch(/^[_a-zA-Z0-9._-]+$/)
  })

  it('returns err(notFound) when application does not belong to user', async () => {
    mockTx.application.findUnique.mockResolvedValue({ id: 100, userId: 2 }) // belongs to BOB

    const file = mockFile('resume.pdf', PDF_HEADER)
    const result = await uploadDocument(ALICE, APP_ID, file, 'resume')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it('returns err(notFound) when application does not exist', async () => {
    mockTx.application.findUnique.mockResolvedValue(null)

    const file = mockFile('resume.pdf', PDF_HEADER)
    const result = await uploadDocument(ALICE, APP_ID, file, 'resume')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })
})

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------

describe('deleteDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTx = createMockTx()
    txRef.current = mockTx
  })

  it('Test 6: removes DB row and deletes file from disk in one transaction', async () => {
    mockTx.document.findUnique.mockResolvedValue({
      id: 42,
      storagePath: '/data/documents/100/42/resume.pdf',
      application: { userId: 1 },
    })
    mockTx.document.delete.mockResolvedValue({})

    const result = await deleteDocument(ALICE, 42)
    expect(result.isOk()).toBe(true)

    expect(mockTx.document.delete).toHaveBeenCalledWith({ where: { id: 42 } })
    expect(mockRm).toHaveBeenCalledWith(
      '/data/documents/100/42/resume.pdf',
      { force: true },
    )
  })

  it('Test 7: non-existent documentId returns err(notFound)', async () => {
    mockTx.document.findUnique.mockResolvedValue(null)

    const result = await deleteDocument(ALICE, 999)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }

    expect(mockTx.document.delete).not.toHaveBeenCalled()
    expect(mockRm).not.toHaveBeenCalled()
  })

  it('returns err(notFound) when document belongs to another user', async () => {
    mockTx.document.findUnique.mockResolvedValue({
      id: 42,
      storagePath: '/data/documents/100/42/resume.pdf',
      application: { userId: 2 }, // belongs to BOB
    })

    const result = await deleteDocument(ALICE, 42)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })
})

// ---------------------------------------------------------------------------
// listDocuments
// ---------------------------------------------------------------------------

describe('listDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTx = createMockTx()
    txRef.current = mockTx
  })

  it('Test 8: returns all documents for an application ordered by createdAt desc', async () => {
    const docs = [
      { id: 2, kind: 'cover_letter', createdAt: new Date('2026-05-10') },
      { id: 1, kind: 'resume', createdAt: new Date('2026-05-09') },
    ]
    mockTx.application.findUnique.mockResolvedValue({ id: 100, userId: 1 })
    mockTx.document.findMany.mockResolvedValue(docs)

    const result = await listDocuments(ALICE, APP_ID)
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    expect(result.value).toEqual(docs)
    expect(mockTx.document.findMany).toHaveBeenCalledWith({
      where: { applicationId: 100 },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('returns err(notFound) when application does not belong to user', async () => {
    mockTx.application.findUnique.mockResolvedValue({ id: 100, userId: 2 })

    const result = await listDocuments(ALICE, APP_ID)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })
})

// ---------------------------------------------------------------------------
// getDocument
// ---------------------------------------------------------------------------

describe('getDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTx = createMockTx()
    txRef.current = mockTx
  })

  it('Test 9: returns document metadata when user owns the application', async () => {
    const doc = {
      id: 42,
      kind: 'resume',
      filename: 'resume.pdf',
      application: { userId: 1 },
    }
    mockTx.document.findUnique.mockResolvedValue(doc)

    const result = await getDocument(ALICE, 42)
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value).toEqual(doc)
  })

  it('Test 10: returns err(notFound) when user does not own the application', async () => {
    mockTx.document.findUnique.mockResolvedValue({
      id: 42,
      kind: 'resume',
      application: { userId: 2 }, // belongs to BOB
    })

    const result = await getDocument(ALICE, 42)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it('returns err(notFound) when document does not exist', async () => {
    mockTx.document.findUnique.mockResolvedValue(null)

    const result = await getDocument(ALICE, 999)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })
})
