import { useTranslations } from 'next-intl'
import Link from 'next/link'

type Props = {
  gmailConnected: boolean
  lastSyncAt: Date | null
}

const wrapper =
  'rounded-md border-l-2 border-amber-500 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'

export function DegradationBanner({ gmailConnected, lastSyncAt }: Props) {
  const t = useTranslations('inbox')

  if (!gmailConnected) {
    return (
      <div className={wrapper}>
        {t.rich('degradationDisconnected', {
          link: (chunks) => (
            <Link href="/settings" className="underline-offset-4 hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </div>
    )
  }

  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
  if (lastSyncAt === null || Date.now() - lastSyncAt.getTime() > fiveDaysMs) {
    return (
      <div className={wrapper}>
        {t.rich('degradationStale', {
          link: (chunks) => (
            <Link href="/settings" className="underline-offset-4 hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </div>
    )
  }

  return null
}
