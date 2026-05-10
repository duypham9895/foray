'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'

import { useSearchShortcut } from '../hooks/use-search-shortcut'

export function SearchBar() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useSearchShortcut(inputRef)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = inputRef.current?.value.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        ref={inputRef}
        type="text"
        name="q"
        placeholder='Search... (press "/" to focus)'
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        /
      </kbd>
    </form>
  )
}
