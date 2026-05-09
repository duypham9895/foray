type Props = {
  gmailLastSyncAt: Date | null
}

export function TokenHealthBanner({ gmailLastSyncAt }: Props) {
  if (!gmailLastSyncAt) return null

  const daysSinceSync = Math.floor(
    (Date.now() - gmailLastSyncAt.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysSinceSync < 5) return null

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">
        Gmail sync is {daysSinceSync} days stale
      </p>
      <p className="mt-1 text-sm text-amber-700">
        Google may revoke the refresh token after 7 days when the OAuth consent
        screen is in Test mode. Reconnect Gmail to ensure continuous syncing.
      </p>
    </div>
  )
}
