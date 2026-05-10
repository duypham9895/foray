// GET /api/documents/{id} — download a document (streaming)
// DELETE /api/documents/{id} — delete a document
//
// Both require authentication via iron-session cookie.

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'

import { requireUser } from '@/core/auth/session'
import { getDocument, deleteDocument } from '@/features/documents/service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const result = await getDocument(userResult.value.id, Number(id))

  if (result.isErr()) {
    if (result.error._tag === 'NotFound') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }

  const document = result.value

  try {
    const buffer = await readFile(document.storagePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${document.filename}"`,
        'Content-Length': String(document.sizeBytes),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'File not found on disk' },
      { status: 404 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const result = await deleteDocument(userResult.value.id, Number(id))

  if (result.isErr()) {
    if (result.error._tag === 'NotFound') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }

  return new NextResponse(null, { status: 204 })
}
