'use client'

import { useCallback, useRef, useState } from 'react'

import { Badge } from '@/ui/badge'
import { Input } from '@/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TagInputProps = {
  value: string[]
  onChange: (tags: string[]) => void
  allTags?: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// TagInput — autocomplete tag input with removable badges
// ---------------------------------------------------------------------------

export function TagInput({
  value,
  onChange,
  allTags = [],
  placeholder = 'Add a tag...',
  disabled = false,
  className,
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = input.trim()
    ? allTags.filter(
        (t) =>
          t.includes(input.toLowerCase().trim()) && !value.includes(t),
      )
    : []

  const addTag = useCallback(
    (tag: string) => {
      const cleaned = tag.toLowerCase().trim()
      if (!cleaned || value.includes(cleaned)) return
      onChange([...value, cleaned])
      setInput('')
      setOpen(false)
      setHighlightIndex(-1)
    },
    [value, onChange],
  )

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag))
    },
    [value, onChange],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filtered[highlightIndex]
      if (highlightIndex >= 0 && selected !== undefined) {
        addTag(selected)
      } else if (input.trim()) {
        addTag(input.trim())
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlightIndex(-1)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove tag ${tag}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input with autocomplete dropdown */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            const val = e.target.value
            setInput(val)
            setOpen(val.trim().length > 0)
            setHighlightIndex(-1)
          }}
          onFocus={() => {
            if (input.trim()) setOpen(true)
          }}
          onBlur={() => {
            // Delay to allow click on dropdown
            setTimeout(() => {
              setOpen(false)
              setHighlightIndex(-1)
            }, 150)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="h-9 text-sm"
          aria-label="Add tags"
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
        />

        {/* Autocomplete dropdown */}
        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-auto rounded-md border bg-popover p-1 shadow-md"
            role="listbox"
          >
            {filtered.map((tag, i) => (
              <li
                key={tag}
                role="option"
                aria-selected={i === highlightIndex}
                className={cn(
                  'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                  i === highlightIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  addTag(tag)
                }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
