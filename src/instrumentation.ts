import { prisma } from '@/core/db/client'

// Global declaration for hot-reload safety
const g = globalThis as unknown as { __forayCron?: { stop: () => void } }

export async function register() {
  // Guard 1: Skip on Edge runtime (node-cron requires Node.js)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Guard 2: Skip in test environment
  if (process.env.NODE_ENV === 'test') return

  const cron = await import('node-cron')

  // Guard 3: Stop previous cron on hot reload
  g.__forayCron?.stop()

  g.__forayCron = cron.schedule('*/15 * * * *', async () => {
    // Guard 4: Advisory lock prevents overlap
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext('poll-gmail')) AS locked`
    if (!locked) return

    try {
      const { pollOnce } = await import('@/features/inbox/service')

      // Get sole user ID (single-user app)
      const user = await prisma.user.findFirst({ select: { id: true } })
      if (!user) return

      const { UserId } = await import('@/core/types/ids')
      const userId = UserId(user.id)

      const result = await pollOnce(userId)
      if (result.isErr()) {
        const { logger } = await import('@/core/logger')
        logger.error({ err: result.error, op: 'cron.pollOnce' }, 'cron tick failed')
      }
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('poll-gmail'))`
    }
  })
}
