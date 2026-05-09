import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <section className="flex flex-col justify-between gap-12 border-b border-border p-10 lg:gap-0 lg:border-b-0 lg:border-r lg:p-14">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-foreground-secondary">
          foray
        </span>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-medium tracking-tight">
            Every foray, in one place.
          </h1>
          <p className="text-base leading-relaxed text-foreground-secondary">
            Capture roles in one click. Watch replies land. Decide what&apos;s next from one calm view —
            without the spreadsheet.
          </p>
        </div>

        <p className="font-mono text-xs text-foreground-muted">
          Locally hosted. Your data stays on your machine.
        </p>
      </section>

      <section className="flex items-center justify-center p-10 lg:p-14">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="text-xl font-medium">Sign in</h2>
            <p className="text-sm text-foreground-secondary">
              Single-user mode. Use the password from your{' '}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground">
                .env
              </code>{' '}
              file.
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
