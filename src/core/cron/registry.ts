// Multi-job cron registry.
//
// Replaces the inline cron.schedule in instrumentation.ts with a reusable
// pattern that:
//   - Registers multiple named cron jobs from a single call
//   - Wraps each execution in pg_try_advisory_lock(hashtext(jobName))
//     to prevent overlap across hot-reload cycles and replicas
//   - Stops previous jobs on hot reload via globalThis cleanup
//   - Logs job start/finish/errors via Pino (never throws)
//
// Four guards absorbed from the original instrumentation.ts:
//   1. NEXT_RUNTIME !== 'nodejs'  (Edge runtime skip)
//   2. NODE_ENV === 'test'        (test environment skip)
//   3. globalThis cleanup         (hot-reload safety)
//   4. pg_try_advisory_lock       (overlap prevention)

import 'server-only'

import { logger } from '@/core/logger'

export interface CronJob {
  name: string
  schedule: string
  handler: () => Promise<void>
}

const g = globalThis as unknown as { __forayCronJobs?: { stop: () => void }[] }

export async function registerCronJobs(jobs: CronJob[]): Promise<void> {
  // Guard 1: Skip on Edge runtime (node-cron requires Node.js)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Guard 2: Skip in test environment
  if (process.env.NODE_ENV === 'test') return

  const cron = await import('node-cron')
  const { prisma } = await import('@/core/db/client')

  // Guard 3: Stop previous jobs on hot reload
  g.__forayCronJobs?.forEach((j) => j.stop())
  g.__forayCronJobs = []

  for (const job of jobs) {
    const task = cron.default.schedule(job.schedule, async () => {
      // Guard 4: Advisory lock prevents overlap
      const lockResult = await prisma.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_lock(hashtext(${job.name})) AS locked`
      if (!lockResult[0]?.locked) return

      const log = logger.child({ op: 'cron', job: job.name })
      log.info({ phase: 'start' })

      try {
        await job.handler()
        log.info({ phase: 'finish' })
      } catch (err) {
        log.error({ err, phase: 'error' }, `cron job ${job.name} failed`)
      } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${job.name}))`
      }
    })
    g.__forayCronJobs.push(task)
  }
}
