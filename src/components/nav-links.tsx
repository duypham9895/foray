'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const links = [
  { href: '/today', key: 'today' as const },
  { href: '/applications', key: 'forays' as const },
  { href: '/inbox', key: 'inbox' as const },
  { href: '/settings', key: 'settings' as const },
  { href: '/guide', key: 'guide' as const },
]

export function NavLinks({ overdueCount = 0 }: { overdueCount?: number }) {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav className="flex gap-1 lg:flex-col lg:gap-1 lg:self-stretch">
      {links.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        const showBadge = href === '/today' && overdueCount > 0

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={showBadge ? `${t(key)} (${overdueCount} follow-ups due)` : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition',
              active
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {t(key)}
            {showBadge && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {overdueCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
