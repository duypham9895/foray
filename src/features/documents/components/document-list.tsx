'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { DocumentKind } from '@/features/documents/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentRow = {
  id: number
  kind: DocumentKind
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
}

type Props = {
  documents: DocumentRow[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KIND_LABELS: Record<DocumentKind, string> = {
  resume: 'Resume',
  cover_letter: 'Cover Letter',
  jd_pdf: 'JD PDF',
  take_home: 'Take-home',
  other: 'Other',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// DocumentList
// ---------------------------------------------------------------------------

export function DocumentList({ documents }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (id: number, filename: string) => {
    if (!window.confirm(`Delete ${filename}? This cannot be undone.`)) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        alert(body?.error ?? 'Delete failed')
        return
      }
      router.refresh()
    } catch {
      alert('Delete failed. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No documents attached yet.</p>
    )
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
              {KIND_LABELS[doc.kind]}
            </span>
            <a
              href={`/api/documents/${doc.id}`}
              target="_blank"
              download
              className="truncate text-sm underline underline-offset-4 hover:text-foreground transition"
            >
              {doc.filename}
            </a>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatSize(doc.sizeBytes)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(doc.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <button
            type="button"
            disabled={deletingId === doc.id}
            onClick={() => handleDelete(doc.id, doc.filename)}
            className="shrink-0 text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {deletingId === doc.id ? 'Deleting...' : 'Delete'}
          </button>
        </li>
      ))}
    </ul>
  )
}
