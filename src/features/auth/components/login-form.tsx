'use client'
import { useActionState } from 'react'
import { login, type LoginState } from '../actions'

const initial: LoginState = { ok: false, errors: {} }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial)
  const error =
    state.ok === false && state.errors.password ? state.errors.password[0] : undefined
  return (
    <form action={formAction}>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          aria-invalid={!!error}
          required
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={pending} type="submit">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
