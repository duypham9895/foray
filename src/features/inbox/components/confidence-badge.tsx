'use client'

import { cn } from '@/lib/utils'

type Props = {
  confidence: number | null
}

export function ConfidenceBadge({ confidence }: Props) {
  if (confidence === null) {
    return <span className="font-mono text-xs text-muted-foreground">—</span>
  }

  const tier = confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low'

  // Filled-bar count by tier — color stays foreground; differentiation comes
  // from how many bars are lit, not from a screaming green/amber/red palette
  // (DESIGN.md: restrained, no traffic-light states).
  const filled = tier === 'high' ? 3 : tier === 'medium' ? 2 : 1

  return (
    <span
      className="group relative inline-flex items-center gap-1"
      aria-label={`Confidence ${Math.round(confidence * 100)} percent`}
    >
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-1.5 rounded-sm',
              i < filled ? 'bg-foreground' : 'bg-muted',
            )}
          />
        ))}
      </span>
      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 font-mono text-xs text-popover-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {Math.round(confidence * 100)}%
      </span>
    </span>
  )
}
