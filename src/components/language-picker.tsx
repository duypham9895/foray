import { getLocale, getTranslations } from 'next-intl/server'

import { setLocale } from '@/i18n/actions'
import { locales, localeLabels } from '@/i18n/config'

export async function LanguagePicker() {
  const current = await getLocale()
  const t = await getTranslations('settings.language')

  return (
    <form action={setLocale} className="flex flex-wrap items-center gap-3">
      <label htmlFor="locale" className="sr-only">
        {t('title')}
      </label>
      <select
        id="locale"
        name="locale"
        defaultValue={current}
        className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabels[locale]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        {t('save')}
      </button>
    </form>
  )
}
