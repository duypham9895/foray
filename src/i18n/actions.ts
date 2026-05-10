'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { isLocale, LOCALE_COOKIE } from './config'

export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get('locale')
  if (typeof value !== 'string' || !isLocale(value)) return

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // one year
    sameSite: 'lax',
    httpOnly: false,
  })

  revalidatePath('/', 'layout')
}
