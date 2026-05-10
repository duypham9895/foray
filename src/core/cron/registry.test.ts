// Unit tests for core/cron/registry.ts.
//
// Mocks node-cron and @/core/db/client to test guard logic and
// advisory lock wrapping without a real database.
//
// The registry runs inside Next.js instrumentation which guards on
// NEXT_RUNTIME and NODE_ENV. Tests override NODE_ENV to 'development'
// so the guard passes, then verify mock interactions.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---

const mockStop = vi.fn()
const mockSchedule = vi.fn((schedule: string, handler: (...args: unknown[]) => Promise<void>) => ({
  schedule,
  handler,
  stop: mockStop,
}))

vi.mock('node-cron', () => ({
  default: { schedule: mockSchedule },
  schedule: mockSchedule,
}))

const mockQueryRaw = vi.fn().mockResolvedValue([{ locked: true }])
vi.mock('@/core/db/client', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

// --- Import under test ---

import { registerCronJobs, type CronJob } from './registry'

// --- Helpers ---

const g = globalThis as unknown as { __forayCronJobs?: { stop: () => void }[] }

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    name: 'test-job',
    schedule: '*/15 * * * *',
    handler: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// --- Tests ---

describe('registerCronJobs', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalNextRuntime = process.env.NEXT_RUNTIME

  beforeEach(() => {
    vi.clearAllMocks()
    // Override NODE_ENV so the guard passes and node-cron.schedule is called.
    // Cast needed because Node types declare NODE_ENV as readonly.
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'
    process.env.NEXT_RUNTIME = 'nodejs'
    // Clean up globalThis state between tests.
    delete g.__forayCronJobs
  })

  afterEach(() => {
    ;(process.env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv ?? 'test'
    process.env.NEXT_RUNTIME = originalNextRuntime
    delete g.__forayCronJobs
  })

  it('registers jobs via node-cron.schedule', async () => {
    const job = makeJob()
    await registerCronJobs([job])

    expect(mockSchedule).toHaveBeenCalledWith(
      '*/15 * * * *',
      expect.any(Function),
    )
  })

  it('skips when NEXT_RUNTIME is not nodejs', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    await registerCronJobs([makeJob()])

    expect(mockSchedule).not.toHaveBeenCalled()
  })

  it('skips when NODE_ENV is test', async () => {
    ;(process.env as { NODE_ENV: string }).NODE_ENV = 'test'
    await registerCronJobs([makeJob()])

    expect(mockSchedule).not.toHaveBeenCalled()
  })

  it('stops previous jobs on hot reload', async () => {
    const existingStop = vi.fn()
    g.__forayCronJobs = [{ stop: existingStop }]

    await registerCronJobs([makeJob()])

    expect(existingStop).toHaveBeenCalled()
  })

  it('stores new jobs on globalThis after registration', async () => {
    await registerCronJobs([makeJob()])

    expect(g.__forayCronJobs).toBeDefined()
    expect(g.__forayCronJobs!.length).toBe(1)
  })

  it('advisory lock wraps each job execution', async () => {
    // Capture the handler passed to node-cron.schedule
    let capturedHandler: (() => Promise<void>) | undefined
    ;(mockSchedule as ReturnType<typeof vi.fn>).mockImplementation(
      (_schedule: string, handler: () => Promise<void>) => {
        capturedHandler = handler
        return { stop: mockStop }
      },
    )

    const job = makeJob()
    await registerCronJobs([job])

    // Invoke the captured handler (simulates cron tick)
    expect(capturedHandler).toBeDefined()
    await capturedHandler!()

    // Should have called pg_try_advisory_lock with hashtext(jobName)
    expect(mockQueryRaw).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('pg_try_advisory_lock'),
      ]),
      'test-job',
    )
  })

  it('advisory unlock is called after job execution', async () => {
    let capturedHandler: (() => Promise<void>) | undefined
    ;(mockSchedule as ReturnType<typeof vi.fn>).mockImplementation(
      (_schedule: string, handler: () => Promise<void>) => {
        capturedHandler = handler
        return { stop: mockStop }
      },
    )

    await registerCronJobs([makeJob()])
    await capturedHandler!()

    // The second $queryRaw call should be the unlock
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    // Verify unlock call pattern (second call)
    const unlockCall = mockQueryRaw.mock.calls[1]
    expect(unlockCall).toBeDefined()
    expect(String(unlockCall![0])).toContain('pg_advisory_unlock')
  })

  it('skips execution when advisory lock is not acquired', async () => {
    // Mock lock acquisition failure
    mockQueryRaw.mockResolvedValueOnce([{ locked: false }])

    let capturedHandler: (() => Promise<void>) | undefined
    ;(mockSchedule as ReturnType<typeof vi.fn>).mockImplementation(
      (_schedule: string, handler: () => Promise<void>) => {
        capturedHandler = handler
        return { stop: mockStop }
      },
    )

    const handler = vi.fn().mockResolvedValue(undefined)
    await registerCronJobs([makeJob({ handler })])
    await capturedHandler!()

    // Job handler should NOT have been called
    expect(handler).not.toHaveBeenCalled()
    // No unlock call either
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('job errors are caught, not thrown', async () => {
    let capturedHandler: (() => Promise<void>) | undefined
    ;(mockSchedule as ReturnType<typeof vi.fn>).mockImplementation(
      (_schedule: string, handler: () => Promise<void>) => {
        capturedHandler = handler
        return { stop: mockStop }
      },
    )

    const handler = vi.fn().mockRejectedValue(new Error('job exploded'))
    await registerCronJobs([makeJob({ handler })])

    // Should not throw
    await expect(capturedHandler!()).resolves.toBeUndefined()
    // Handler was called
    expect(handler).toHaveBeenCalled()
    // Unlock was still called (finally block)
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
  })

  it('registers multiple jobs', async () => {
    await registerCronJobs([
      makeJob({ name: 'job-a', schedule: '*/5 * * * *' }),
      makeJob({ name: 'job-b', schedule: '*/10 * * * *' }),
    ])

    expect(mockSchedule).toHaveBeenCalledTimes(2)
    expect(g.__forayCronJobs!.length).toBe(2)
  })
})
