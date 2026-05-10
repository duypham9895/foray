export const locales = ['en', 'vi', 'id'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
}

export const LOCALE_COOKIE = 'foray_locale'

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value)
}
