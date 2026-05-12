import Link from 'next/link'

import { Badge } from '@/ui/badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TagCloudProps = {
  tags: Array<{ tag: string; count: number }>
  activeTag?: string
  currentParams?: URLSearchParams
  className?: string
}

// ---------------------------------------------------------------------------
// TagCloud — clickable tag list with counts, highlights active filter
// ---------------------------------------------------------------------------

export function TagCloud({ tags, activeTag, currentParams, className }: TagCloudProps) {
  if (tags.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map(({ tag, count }) => {
        const isActive = tag === activeTag
        const out = new URLSearchParams(currentParams)
        if (isActive) out.delete('tag')
        else out.set('tag', tag)
        const query = out.toString()
        const href = query ? `/applications?${query}` : '/applications'

        return (
          <Link key={tag} href={href}>
            <Badge
              variant={isActive ? 'default' : 'secondary'}
              className="cursor-pointer transition-colors hover:opacity-80"
            >
              {tag}
              <span className="ml-0.5 opacity-60">{count}</span>
            </Badge>
          </Link>
        )
      })}
    </div>
  )
}
