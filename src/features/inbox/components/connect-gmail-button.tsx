'use client'

export function ConnectGmailButton() {
  return (
    <a
      href="/api/gmail/auth"
      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
    >
      Connect Gmail
    </a>
  )
}
