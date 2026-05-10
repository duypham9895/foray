// Document slice — business logic.
//
// Four public functions, all returning Result<T, AppError>:
//
//   uploadDocument  — validates MIME via magic bytes, stores file, creates Event
//   deleteDocument  — removes DB row + file from disk atomically
//   listDocuments   — returns all documents for an application
//   getDocument     — returns single document with ownership check
//
// File storage: data/documents/{applicationId}/{docId}/{sanitized-filename}
// All mutations wrapped in withRls transactions for tenant safety.

import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'

import { err, type Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import { errors, type AppError } from '@/core/errors'
import type { ApplicationId, UserId } from '@/core/types/ids'
import type { Document } from '@/generated/prisma/client'

import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  type DocumentKind,
} from './schema'

// ---------------------------------------------------------------------------
// detectMimeType
// ---------------------------------------------------------------------------

/**
 * Detect MIME type from the first 8 bytes of a file using magic-byte signatures.
 * Returns the MIME type string or null if no known signature matches.
 */
export function detectMimeType(header: ArrayBuffer): string | null {
  const bytes = new Uint8Array(header)

  // Check each allowed type's magic bytes (except text/plain, which is last).
  for (const [mime, { magic }] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (magic.length === 0) continue // text/plain fallback

    let match = true
    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic[i]) {
        match = false
        break
      }
    }
    if (match) return mime
  }

  // Fallback: plain text if all bytes are printable ASCII or common whitespace.
  const isPrintable = bytes.every(
    (b) =>
      (b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d,
  )
  if (isPrintable) return 'text/plain'

  return null
}

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

/**
 * Sanitize a filename for safe storage:
 * - Replace any character not in [a-zA-Z0-9._-] with underscore
 * - Truncate to 200 characters
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\./g, '_')  // collapse path traversal sequences
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200)
}

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

/**
 * Upload a document attached to an application.
 *
 * Validates file size (<=10MB) and MIME type (via magic bytes) before
 * writing to disk. Creates Document row + Event(type=document_uploaded)
 * atomically in one withRls transaction.
 */
export async function uploadDocument(
  userId: UserId,
  applicationId: ApplicationId,
  file: File,
  kind: DocumentKind,
  notes?: string,
): Promise<Result<{ documentId: number; eventId: number }, AppError>> {
  // Size guard — reject before buffering full file.
  if (file.size > MAX_FILE_SIZE) {
    return err(
      errors.validation([
        {
          code: 'custom',
          message: 'File exceeds 10MB limit',
          path: ['file'],
        },
      ]),
    )
  }

  // MIME detection via magic bytes (first 8 bytes).
  const header = await file.slice(0, 8).arrayBuffer()
  const detectedMime = detectMimeType(header)
  if (!detectedMime || !(detectedMime in ALLOWED_MIME_TYPES)) {
    return err(
      errors.validation([
        {
          code: 'custom',
          message: 'Unrecognized file type',
          path: ['file'],
        },
      ]),
    )
  }

  const safeFilename = sanitizeFilename(file.name)

  const result = await withRls(userId, async (tx) => {
    // Verify application belongs to user.
    const app = await tx.application.findUnique({
      where: { id: Number(applicationId) },
      select: { userId: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    // Create Document row (storagePath filled after file write).
    const doc = await tx.document.create({
      data: {
        applicationId: Number(applicationId),
        kind,
        filename: safeFilename,
        mimeType: detectedMime,
        storagePath: '',
        sizeBytes: file.size,
        notes: notes || null,
      },
      select: { id: true },
    })

    // Build storage path from server-generated IDs only.
    const storagePath = path.join(
      process.cwd(),
      'data',
      'documents',
      String(applicationId),
      String(doc.id),
      safeFilename,
    )

    // Write file to disk.
    await fs.mkdir(path.dirname(storagePath), { recursive: true })
    await fs.writeFile(storagePath, Buffer.from(await file.arrayBuffer()))

    // Update Document with actual storage path.
    await tx.document.update({
      where: { id: doc.id },
      data: { storagePath },
    })

    // Create audit event.
    const event = await tx.event.create({
      data: {
        applicationId: Number(applicationId),
        userId: Number(userId),
        type: 'document_uploaded',
        source: 'manual',
        data: {
          documentId: doc.id,
          filename: safeFilename,
          kind,
        },
        undoable: false,
        occurredAt: new Date(),
      },
      select: { id: true },
    })

    return { documentId: doc.id, eventId: event.id }
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------

/**
 * Delete a document: removes DB row and file from disk in one transaction.
 */
export async function deleteDocument(
  userId: UserId,
  documentId: number,
): Promise<Result<void, AppError>> {
  const result = await withRls(userId, async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id: documentId },
      include: { application: { select: { userId: true } } },
    })
    if (!doc || doc.application.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Document:${String(documentId)}`)
    }

    await tx.document.delete({ where: { id: documentId } })
    await fs.rm(doc.storagePath, { force: true })

    return undefined
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// listDocuments
// ---------------------------------------------------------------------------

/**
 * List all documents for an application, ordered by newest first.
 */
export async function listDocuments(
  userId: UserId,
  applicationId: ApplicationId,
): Promise<Result<Document[], AppError>> {
  const result = await withRls(userId, async (tx) => {
    // Verify application belongs to user.
    const app = await tx.application.findUnique({
      where: { id: Number(applicationId) },
      select: { userId: true },
    })
    if (!app || app.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Application:${String(applicationId)}`)
    }

    return tx.document.findMany({
      where: { applicationId: Number(applicationId) },
      orderBy: { createdAt: 'desc' },
    })
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// getDocument
// ---------------------------------------------------------------------------

/**
 * Get a single document with ownership verification.
 */
export async function getDocument(
  userId: UserId,
  documentId: number,
): Promise<Result<Document, AppError>> {
  const result = await withRls(userId, async (tx) => {
    const doc = await tx.document.findUnique({
      where: { id: documentId },
      include: { application: { select: { userId: true } } },
    })
    if (!doc || doc.application.userId !== Number(userId)) {
      throw new Error(`NOT_FOUND:Document:${String(documentId)}`)
    }

    return doc
  })

  return translateThrowBridge(result)
}

// ---------------------------------------------------------------------------
// Throw-bridge translator
// ---------------------------------------------------------------------------
//
// Inside a withRls transaction we use `throw new Error('TAG:...')` to abort
// (Postgres rolls back via Prisma's $transaction). withRls's fromPromise
// wraps the throw as errors.db(cause). Translate known prefixes back to the
// intended AppError variant.

function translateThrowBridge<T>(result: Result<T, AppError>): Result<T, AppError> {
  if (!result.isErr()) return result
  if (result.error._tag !== 'Db') return result
  const cause = result.error.cause
  if (!(cause instanceof Error)) return result

  if (cause.message.startsWith('NOT_FOUND:')) {
    const [, resource, id] = cause.message.split(':')
    return err(errors.notFound(resource ?? 'Unknown', id ?? ''))
  }
  if (cause.message.startsWith('CONFLICT:')) {
    return err(errors.conflict(cause.message.split(':')[1] ?? 'CONFLICT'))
  }
  return result
}
