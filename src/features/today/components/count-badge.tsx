export interface CountBadgeProps {
  label: string
  count: number
  delta?: number
  href?: string
}

export function CountBadge({ label, count, delta, href }: CountBadgeProps) {
  const Component = href ? 'a' : 'div'

  return (
    <Component
      href={href}
      className="inline-block px-3 py-2 bg-gray-100 rounded text-sm"
    >
      <div className="font-semibold">{count}</div>
      <div className="text-xs text-gray-600">{label}</div>
      {delta !== undefined && (
        <div className={delta > 0 ? 'text-green-600' : 'text-gray-500'}>
          {delta > 0 ? '+' : ''}
          {delta} vs last week
        </div>
      )}
    </Component>
  )
}
