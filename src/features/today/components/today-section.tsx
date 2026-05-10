import type { ReactNode } from 'react'

export interface TodaySectionProps {
  title: string
  icon: ReactNode
  children: ReactNode
  isEmpty: boolean
  emptyMessage: string
}

export function TodaySection({
  title,
  icon,
  children,
  isEmpty,
  emptyMessage,
}: TodaySectionProps) {
  return (
    <div className="border-b pb-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {isEmpty ? (
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  )
}
