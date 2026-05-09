'use client'

export function ConnectGmailButton() {
  return (
    <a
      href="/api/gmail/auth"
      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      Connect Gmail
    </a>
  )
}
