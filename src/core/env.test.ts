// env.ts validation tests.
// env.ts throws at module load on invalid env — we test it by importing
// the schema directly from env.ts internals. Since env.ts exports `env`
// (already-parsed) and throws on invalid, we re-create the validation
// logic by testing the Zod schema behaviour via process.env manipulation.
//
// Pattern: stub process.env, then dynamically import env.ts in a subprocess
// or test the schema logic inline. Because env.ts throws synchronously at
// module load, we test it by requiring the module in a child-process or by
// extracting the schema. The cleanest approach for Vitest is to test the
// Zod schema shape directly (it is the source of truth) and verify that the
// exported `env` object has the right shape when the environment is valid.

import { describe, it, expect } from 'vitest'
import { envSchema } from './env'

const baseEnv = {
  DATABASE_URL: 'postgresql://foray:foray@localhost:5432/foray',
  ENCRYPTION_KEY: '0'.repeat(64),
  APP_PASSWORD: 'correct-horse-battery-staple',
  APP_SESSION_SECRET: 'a'.repeat(32),
  ANTHROPIC_API_KEY: 'sk-ant-test-fixture-key-not-real',
  NODE_ENV: 'test',
}

describe('env schema', () => {
  it('Test 1: parses successfully when APP_SESSION_SECRET is exactly 32 chars', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      APP_SESSION_SECRET: 'a'.repeat(32),
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data.APP_SESSION_SECRET).toBe('string')
    }
  })

  it('Test 2: rejects when APP_SESSION_SECRET is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { APP_SESSION_SECRET: _, ...withoutSecret } = baseEnv
    const result = envSchema.safeParse(withoutSecret)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('APP_SESSION_SECRET')
    }
  })

  it('Test 2b: rejects when APP_SESSION_SECRET is shorter than 32 chars', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      APP_SESSION_SECRET: 'tooshort',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'APP_SESSION_SECRET')
      expect(issue).toBeDefined()
    }
  })

  it('Test 3: rejects when APP_PASSWORD is shorter than 12 chars', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      APP_PASSWORD: 'tooshort',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'APP_PASSWORD')
      expect(issue).toBeDefined()
    }
  })

  it('Test 4: env.APP_SESSION_SECRET has type string when valid', () => {
    const result = envSchema.safeParse(baseEnv)
    expect(result.success).toBe(true)
    if (result.success) {
      // TypeScript-level: result.data.APP_SESSION_SECRET should be `string`
      const secret: string = result.data.APP_SESSION_SECRET
      expect(secret).toHaveLength(32)
    }
  })

  it('Test 5: rejects when ANTHROPIC_API_KEY is missing (Phase 3 made it required)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ANTHROPIC_API_KEY: _, ...withoutKey } = baseEnv
    const result = envSchema.safeParse(withoutKey)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('ANTHROPIC_API_KEY')
    }
  })

  it('Test 5b: rejects when ANTHROPIC_API_KEY is empty string', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      ANTHROPIC_API_KEY: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'ANTHROPIC_API_KEY')
      expect(issue).toBeDefined()
    }
  })
})
