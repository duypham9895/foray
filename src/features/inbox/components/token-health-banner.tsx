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
    <div className="rounded-md border-l-2 border-amber-500 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Gmail sync is {daysSinceSync} days stale.</p>
      <p className="mt-1 opacity-80">
        Google may revoke the refresh token after 7 days when the OAuth consent screen
        is in Test mode. Reconnect Gmail to keep syncing.
      </p>
    </div>
  )
}
