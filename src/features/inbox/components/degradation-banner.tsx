import Link from 'next/link'

type Props = {
  gmailConnected: boolean
  lastSyncAt: Date | null
}

export function DegradationBanner({ gmailConnected, lastSyncAt }: Props) {
  if (!gmailConnected) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          Gmail disconnected — full bodies unavailable.{' '}
          <Link href="/settings" className="underline">
            Connect Gmail in Settings
          </Link>
          .
        </p>
      </div>
    )
  }

  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
  if (lastSyncAt === null || Date.now() - lastSyncAt.getTime() > fiveDaysMs) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          Last sync was over 5 days ago. Gmail Test-mode tokens expire after 7
          days.{' '}
          <Link href="/settings" className="underline">
            Reconnect in Settings
          </Link>
          .
        </p>
      </div>
    )
  }

  return null
}
