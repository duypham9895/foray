'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  applicationId: number
}

// ---------------------------------------------------------------------------
// UploadForm
// ---------------------------------------------------------------------------

export function UploadForm({ applicationId }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUploading(true)
    setError(null)

    const form = e.currentTarget
    const fileInput = form.elements.namedItem('file') as HTMLInputElement
    const kindSelect = form.elements.namedItem('kind') as HTMLSelectElement
    const notesTextarea = form.elements.namedItem('notes') as HTMLTextAreaElement

    const file = fileInput.files?.[0]
    if (!file) {
      setError('Please select a file')
      setUploading(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kindSelect.value)
    formData.append('notes', notesTextarea.value)

    try {
      const res = await fetch(`/api/applications/${applicationId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (res.status === 413) {
        setError('File must be under 10MB')
        return
      }

      if (res.status === 422) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Validation failed')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Upload failed. Please try again.')
        return
      }

      // Reset form and refresh page data
      formRef.current?.reset()
      router.refresh()
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border bg-card p-4"
    >
      <div className="space-y-1">
        <label htmlFor="doc-file" className="text-sm font-medium">
          File
        </label>
        <input
          id="doc-file"
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="doc-kind" className="text-sm font-medium">
          Kind
        </label>
        <select
          id="doc-kind"
          name="kind"
          required
          defaultValue=""
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="" disabled>
            Select kind...
          </option>
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover Letter</option>
          <option value="jd_pdf">JD PDF</option>
          <option value="take_home">Take-home</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="doc-notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="doc-notes"
          name="notes"
          rows={2}
          placeholder="Optional notes about this document..."
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/50"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  )
}
