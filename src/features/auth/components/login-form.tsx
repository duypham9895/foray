'use client'
import { useActionState } from 'react'
import { login, type LoginState } from '../actions'

const initial: LoginState = { ok: false, errors: {} }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial)
  const error =
    state.ok === false && state.errors.password ? state.errors.password[0] : undefined

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm text-foreground-secondary"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          aria-invalid={!!error}
          aria-describedby={error ? 'password-error' : undefined}
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition placeholder:text-foreground-muted focus:border-foreground focus:ring-2 focus:ring-foreground/10 aria-[invalid=true]:border-rose-600/60 dark:aria-[invalid=true]:border-rose-400/60"
        />
        {error ? (
          <p
            id="password-error"
            role="alert"
            className="text-sm text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        disabled={pending}
        type="submit"
        className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
