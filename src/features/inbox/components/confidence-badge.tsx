'use client'

type Props = {
  confidence: number | null
}

export function ConfidenceBadge({ confidence }: Props) {
  if (confidence === null) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const tier = confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low'

  const barColors = {
    high: ['bg-green-500', 'bg-green-500', 'bg-green-500'],
    medium: ['bg-amber-500', 'bg-amber-500', 'bg-gray-200'],
    low: ['bg-gray-400', 'bg-gray-200', 'bg-gray-200'],
  }

  const colors = barColors[tier]

  return (
    <div className="group relative inline-flex items-center gap-0.5">
      {colors.map((color, i) => (
        <div key={i} className={`h-3 w-1.5 rounded-sm ${color}`} />
      ))}
      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  )
}
