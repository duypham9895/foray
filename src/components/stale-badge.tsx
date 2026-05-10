import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export function StaleBadge({
  daysQuiet,
  className,
}: {
  daysQuiet: number
  className?: string
}) {
  const t = useTranslations('today')
  const label = daysQuiet === 1 ? t('staleSuffixOne') : t('staleSuffix', { n: daysQuiet })

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
