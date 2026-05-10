import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config'

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(fromCookie)) return fromCookie

  // Best-effort browser detection on first visit. Picks the highest-weight
  // language tag that matches one of our supported locales; falls back to EN.
  const headerStore = await headers()
  const accept = headerStore.get('accept-language') ?? ''
  for (const tag of accept.split(',')) {
    const lang = tag.split(';')[0]!.trim().toLowerCase().split('-')[0]
    if (isLocale(lang)) return lang
  }
  return defaultLocale
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  const messages = (await import(`../../messages/${locale}.json`)).default
  return { locale, messages }
})
