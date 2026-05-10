'use client'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'

import { login, type LoginState } from '../actions'

const initial: LoginState = { ok: false, errors: {} }

export function LoginForm() {
  const t = useTranslations('login')
  const tActions = useTranslations('actions')
  const [state, formAction, pending] = useActionState(login, initial)
  const error =
    state.ok === false && state.errors.password ? state.errors.password[0] : undefined

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm text-muted-foreground"
        >
          {t('passwordLabel')}
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          aria-invalid={!!error}
          aria-describedby={error ? 'password-error' : undefined}
          required
          className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-destructive/60"
        />
        {error ? (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {t('passwordError')}
          </p>
        ) : null}
      </div>

      <button
        disabled={pending}
        type="submit"
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? tActions('signingIn') : tActions('signIn')}
      </button>
    </form>
  )
}
