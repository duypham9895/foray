// POST /api/applications/{id}/documents — upload a document
// GET /api/applications/{id}/documents — list documents for an application
//
// Both require authentication via iron-session cookie.

import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/core/auth/session'
import { ApplicationId } from '@/core/types/ids'
import { uploadDocument, listDocuments } from '@/features/documents/service'
import { uploadSchema } from '@/features/documents/schema'
import type { DocumentKind } from '@/features/documents/schema'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file')
  const kind = formData.get('kind')
  const notes = formData.get('notes')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const kindResult = uploadSchema.shape.kind.safeParse(kind)
  if (!kindResult.success) {
    return NextResponse.json(
      { error: kindResult.error.issues[0]?.message ?? 'Invalid kind' },
      { status: 400 },
    )
  }

  const notesResult = uploadSchema.shape.notes.safeParse(notes)
  const validatedNotes = notesResult.success ? notesResult.data : undefined

  const result = await uploadDocument(
    userResult.value.id,
    ApplicationId(id),
    file,
    kindResult.data as DocumentKind,
    validatedNotes,
  )

  if (result.isErr()) {
    const error = result.error
    switch (error._tag) {
      case 'Validation':
        return NextResponse.json(
          { error: error.issues[0]?.message ?? 'Validation failed' },
          { status: 422 },
        )
      case 'NotFound':
        return NextResponse.json(
          { error: `${error.resource} not found` },
          { status: 404 },
        )
      default:
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 },
        )
    }
  }

  return NextResponse.json(result.value, { status: 201 })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const result = await listDocuments(userResult.value.id, ApplicationId(id))

  if (result.isErr()) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }

  return NextResponse.json(result.value)
}
