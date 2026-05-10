export function StaleIndicator({
  daysQuiet,
}: {
  daysQuiet: number
}) {
  if (daysQuiet < 7) return null

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
      {daysQuiet}d stale
    </span>
  )
}
