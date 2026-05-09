'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const links = [
  { href: '/applications', label: 'Forays' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/settings', label: 'Settings' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 lg:flex-col lg:gap-1 lg:self-stretch">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition',
              active
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
