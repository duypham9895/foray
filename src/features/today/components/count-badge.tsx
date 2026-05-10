import Link from 'next/link'

import { cn } from '@/lib/utils'

export interface CountBadgeProps {
  label: string
  count: number
  delta?: number
  href?: string
  className?: string
}

export function CountBadge({ label, count, delta, href, className }: CountBadgeProps) {
  const inner = (
    <div className={cn('rounded-md bg-accent/60 px-3 py-2.5', className)}>
      <div className="text-base font-semibold text-foreground">{count}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {delta !== undefined ? (
        <div
          className={cn(
            'text-xs',
            delta > 0 ? 'text-primary' : 'text-muted-foreground/60',
          )}
        >
          {delta > 0 ? '+' : ''}
          {delta} vs last week
        </div>
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-80">
        {inner}
      </Link>
    )
  }

  return inner
}
