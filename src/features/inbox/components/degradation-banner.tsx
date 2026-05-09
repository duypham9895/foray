import Link from 'next/link'

type Props = {
  gmailConnected: boolean
  lastSyncAt: Date | null
}

const wrapper =
  'rounded-md border-l-2 border-amber-500 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'

export function DegradationBanner({ gmailConnected, lastSyncAt }: Props) {
  if (!gmailConnected) {
    return (
      <div className={wrapper}>
        Gmail disconnected — full bodies unavailable.{' '}
        <Link href="/settings" className="underline-offset-4 hover:underline">
          Connect Gmail in Settings
        </Link>
        .
      </div>
    )
  }

  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
  if (lastSyncAt === null || Date.now() - lastSyncAt.getTime() > fiveDaysMs) {
    return (
      <div className={wrapper}>
        Last sync was over 5 days ago. Gmail Test-mode tokens expire after 7 days.{' '}
        <Link href="/settings" className="underline-offset-4 hover:underline">
          Reconnect in Settings
        </Link>
        .
      </div>
    )
  }

  return null
}
