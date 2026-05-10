'use client'

import { useActionState, useEffect, useState } from 'react'

import { updateTagsAction, type ActionState } from '../actions'
import { TagInput } from './tag-input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TagEditorProps = {
  applicationId: number
  initialTags: string[]
  allTags?: string[]
}

// ---------------------------------------------------------------------------
// TagEditor — client island for tag editing on the detail page
// ---------------------------------------------------------------------------

export function TagEditor({
  applicationId,
  initialTags,
  allTags = [],
}: TagEditorProps) {
  const [tags, setTags] = useState(initialTags)
  const boundAction = updateTagsAction.bind(null, applicationId)
  const [state, formAction] = useActionState(boundAction, { ok: true } as ActionState)

  // Sync tags from server on successful save
  useEffect(() => {
    if (state.ok) {
      // Tags already up to date from local state
    }
  }, [state])

  const handleChange = (newTags: string[]) => {
    setTags(newTags)
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />
      <TagInput
        value={tags}
        onChange={handleChange}
        allTags={allTags}
      />
      {!state.ok && state.formError && (
        <p className="mt-1 text-xs text-destructive">{state.formError}</p>
      )}
    </form>
  )
}
