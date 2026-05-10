import { useTranslations } from 'next-intl'

type Props = {
  daysSinceSync: number | null
}

export function TokenHealthBanner({ daysSinceSync }: Props) {
  const t = useTranslations('settings.gmail')
  if (daysSinceSync === null || daysSinceSync < 5) return null

  return (
    <div className="rounded-md border-l-2 border-amber-500 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">{t('tokenStaleTitle', { days: daysSinceSync })}</p>
      <p className="mt-1 opacity-80">{t('tokenStaleBody')}</p>
    </div>
  )
}
