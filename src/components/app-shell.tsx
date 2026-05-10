import { getTranslations } from 'next-intl/server'

import { logout } from '@/features/auth/actions'

import { NavLinks } from './nav-links'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('nav')

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-8 border-b border-border bg-card/40 p-6 lg:border-b-0 lg:border-r lg:p-8">
        <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-start lg:gap-8">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            foray
          </span>
          <NavLinks />
        </div>

        <form action={logout} className="lg:mt-auto">
          <button
            type="submit"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {t('signOut')}
          </button>
        </form>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
