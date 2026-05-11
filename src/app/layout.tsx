import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

import { KeyboardShortcutsProvider } from '@/features/shortcuts/keyboard-shortcuts-provider'
import { ShortcutHintToast } from '@/features/shortcuts/shortcut-hint-toast'

import './globals.css'

export const metadata: Metadata = {
  title: 'foray — every job application, in one place',
  description:
    "A calm record of every role you've applied to. Capture forays in one click, watch replies land, decide what's next.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <KeyboardShortcutsProvider />
          <ShortcutHintToast />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
