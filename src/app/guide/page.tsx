import fs from 'node:fs'
import path from 'node:path'

import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/core/auth/session'

function readGuideContent(locale: string): string {
  const supported = ['en', 'vi', 'id']
  const safe = supported.includes(locale) ? locale : 'en'
  const filePath = path.join(process.cwd(), 'content', 'guide', `${safe}.md`)
  return fs.readFileSync(filePath, 'utf-8')
}

export default async function GuidePage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const locale = await getLocale()
  const content = readGuideContent(locale)

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10 lg:px-10 lg:py-14">
        <article className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&_h1]:font-mono [&_h1]:text-base [&_h1]:uppercase [&_h1]:tracking-[0.18em] [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_hr]:border-border [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-accent [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:text-foreground [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    </AppShell>
  )
}
