import { cn } from '@/lib/utils'

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export function StaleIndicator({
  lastActivityAt,
  className,
}: {
  lastActivityAt: Date
  className?: string
}) {
  const isStale = Date.now() - lastActivityAt.getTime() > STALE_THRESHOLD_MS
  if (!isStale) return null

  const days = Math.floor(
    (Date.now() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000),
  )

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800',
        className,
      )}
    >
      {days}d stale
    </span>
  )
}
