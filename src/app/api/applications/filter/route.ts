// GET /api/applications/filter?tag=remote — filter applications by tag.
//
// Returns filtered application list as JSON. Requires authentication via
// iron-session cookie (same as all protected routes).

import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/core/auth/session'
import { findApplicationsByTag } from '@/features/applications/tags-service'

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag')

  if (!tag || !tag.trim()) {
    return NextResponse.json(
      { error: 'tag query parameter is required' },
      { status: 400 },
    )
  }

  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await findApplicationsByTag(userResult.value.id, tag)

  if (result.isErr()) {
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 },
    )
  }

  return NextResponse.json(result.value)
}
