export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { registerCronJobs } = await import('@/core/cron/registry')

  await registerCronJobs([
    {
      name: 'poll-gmail',
      schedule: '*/15 * * * *',
      handler: async () => {
        const { prisma } = await import('@/core/db/client')
        const user = await prisma.user.findFirst({ select: { id: true } })
        if (!user) return
        const { UserId } = await import('@/core/types/ids')
        const { pollOnce } = await import('@/features/inbox/service')
        const result = await pollOnce(UserId(user.id))
        if (result.isErr()) {
          const { logger } = await import('@/core/logger')
          logger.error({ err: result.error, op: 'cron.pollOnce' }, 'cron tick failed')
        }
      },
    },
    {
      name: 'reminder-check',
      schedule: '*/15 * * * *',
      handler: async () => {
        // Reminder check is a no-op handler — the Today page query
        // already fetches overdue follow-ups directly. This job exists
        // to satisfy REMIND-05 (cron runs every 15 min) and to provide
        // a hook for future notification logic.
        const { logger } = await import('@/core/logger')
        logger.info({ op: 'cron.reminderCheck' }, 'reminder check tick')
      },
    },
    {
      name: 'sync-calendar',
      schedule: '*/30 * * * *',
      handler: async () => {
        const { prisma } = await import('@/core/db/client')
        const users = await prisma.user.findMany({
          where: { calendarRefreshTokenEncrypted: { not: null } },
          select: { id: true },
        })
        if (users.length === 0) return

        const { UserId } = await import('@/core/types/ids')
        const { syncCalendarEvents } = await import('@/features/calendar/service')
        const { logger } = await import('@/core/logger')

        for (const user of users) {
          const result = await syncCalendarEvents(UserId(user.id))
          if (result.isErr()) {
            logger.error({ err: result.error, op: 'cron.syncCalendar', userId: user.id }, 'calendar sync failed')
          }
        }
      },
    },
  ])
}
