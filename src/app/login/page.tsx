import { getTranslations } from 'next-intl/server'

import { LoginForm } from '@/features/auth/components/login-form'

export default async function LoginPage() {
  const t = await getTranslations('login')

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-12 border-b border-border p-10 lg:gap-0 lg:border-b-0 lg:border-r lg:p-14">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {t('wordmark')}
        </span>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-medium tracking-tight">{t('tagline')}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t('intro')}</p>
        </div>

        <p className="font-mono text-xs text-muted-foreground/70">{t('localFooter')}</p>
      </section>

      <section className="flex items-center justify-center p-10 lg:p-14">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="text-xl font-medium">{t('title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t.rich('passwordHint', {
                code: (chunks) => (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {chunks}
                  </code>
                ),
              })}
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
