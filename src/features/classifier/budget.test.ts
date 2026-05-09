// Unit tests for src/features/classifier/budget.ts.
//
// Uses a per-test temp directory + CLASSIFIER_LOG_PATH override so the real
// data/classifier-log.jsonl is NEVER touched. The temp dir is removed in
// afterEach to keep the suite hermetic.
//
// FAIL-CLOSED is the most important test (T6 — threat T-03-01-02): a corrupted
// or unreadable log MUST NOT silently allow LLM spend. checkBudget returns
// err(rateLimited) instead.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  DAILY_BUDGET_USD,
  HAIKU_INPUT_USD_PER_MTOK,
  HAIKU_OUTPUT_USD_PER_MTOK,
  appendCostEntry,
  checkBudget,
  computeCostUsd,
  hashEmailContent,
  secondsUntilMidnight,
} from './budget'

let tmpDir: string
let logPath: string
const ORIGINAL_LOG_PATH = process.env['CLASSIFIER_LOG_PATH']

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foray-budget-'))
  logPath = path.join(tmpDir, 'classifier-log.jsonl')
  process.env['CLASSIFIER_LOG_PATH'] = logPath
})

afterEach(async () => {
  if (ORIGINAL_LOG_PATH === undefined) delete process.env['CLASSIFIER_LOG_PATH']
  else process.env['CLASSIFIER_LOG_PATH'] = ORIGINAL_LOG_PATH
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const today = (): string => new Date().toISOString().slice(0, 10)
const yesterdayIso = (): string => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
}
const todayIso = (): string => new Date().toISOString()

async function writeLog(lines: Array<Record<string, unknown>>): Promise<void> {
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n'
  await fs.writeFile(logPath, body, 'utf8')
}

// ---------------------------------------------------------------------------
// Pricing constants
// ---------------------------------------------------------------------------

describe('budget pricing constants — Anthropic Haiku 4.5 (LOCKED)', () => {
  it('Test C1: DAILY_BUDGET_USD === 0.50', () => {
    expect(DAILY_BUDGET_USD).toBe(0.5)
  })
  it('Test C2: HAIKU_INPUT_USD_PER_MTOK === 0.80', () => {
    expect(HAIKU_INPUT_USD_PER_MTOK).toBe(0.8)
  })
  it('Test C3: HAIKU_OUTPUT_USD_PER_MTOK === 4.00', () => {
    expect(HAIKU_OUTPUT_USD_PER_MTOK).toBe(4.0)
  })
})

// ---------------------------------------------------------------------------
// computeCostUsd
// ---------------------------------------------------------------------------

describe('computeCostUsd — pure', () => {
  it('Test 8a: 1M input tokens, 0 output → $0.80', () => {
    expect(computeCostUsd(1_000_000, 0)).toBeCloseTo(0.8, 10)
  })
  it('Test 8b: 0 input, 1M output → $4.00', () => {
    expect(computeCostUsd(0, 1_000_000)).toBeCloseTo(4.0, 10)
  })
  it('Test 8c: 1M input + 1M output → $4.80', () => {
    expect(computeCostUsd(1_000_000, 1_000_000)).toBeCloseTo(4.8, 10)
  })
  it('Test 8d: 0 + 0 → 0 (boundary)', () => {
    expect(computeCostUsd(0, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// hashEmailContent
// ---------------------------------------------------------------------------

describe('hashEmailContent — privacy-preserving identifier (T-03-01-01)', () => {
  it('Test 9: same input produces the same hash; different input differs', () => {
    const a = hashEmailContent('Subject A', 'body excerpt 1')
    const b = hashEmailContent('Subject A', 'body excerpt 1')
    const c = hashEmailContent('Subject B', 'body excerpt 1')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
  it('Test 10: shape is "sha256:" + 64 hex chars', () => {
    const h = hashEmailContent('subject', 'excerpt')
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
  it('Test 10b: subject vs body separator matters — concatenation is not ambiguous', () => {
    // ('a','bc') and ('ab','c') must produce different hashes — the '\n'
    // separator prevents prefix collisions.
    const h1 = hashEmailContent('a', 'bc')
    const h2 = hashEmailContent('ab', 'c')
    expect(h1).not.toBe(h2)
  })
})

// ---------------------------------------------------------------------------
// secondsUntilMidnight
// ---------------------------------------------------------------------------

describe('secondsUntilMidnight — pure helper', () => {
  it('Test S1: a noon timestamp returns ~12 hours of seconds', () => {
    const noon = new Date('2026-05-09T12:00:00Z')
    const s = secondsUntilMidnight(noon)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(86400)
    expect(s).toBeCloseTo(12 * 60 * 60, -1)
  })
  it('Test S2: returns a value in [0, 86400]', () => {
    const s = secondsUntilMidnight(new Date())
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(86400)
  })
})

// ---------------------------------------------------------------------------
// checkBudget — read path
// ---------------------------------------------------------------------------

describe('checkBudget — daily-cap arithmetic', () => {
  it('Test 1: empty (non-existent) log → ok()', async () => {
    const r = await checkBudget()
    expect(r.isOk()).toBe(true)
  })

  it('Test 2: today entries summing to $0.49 → ok() (under cap)', async () => {
    await writeLog([
      { ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.25, emailHash: 'sha256:x' },
      { ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.24, emailHash: 'sha256:y' },
    ])
    const r = await checkBudget()
    expect(r.isOk()).toBe(true)
  })

  it('Test 3: today entries summing to exactly $0.50 → err(RateLimited) with retryAfterSeconds in [0,86400]', async () => {
    await writeLog([
      { ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.25, emailHash: 'sha256:a' },
      { ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.25, emailHash: 'sha256:b' },
    ])
    const r = await checkBudget()
    expect(r.isErr()).toBe(true)
    if (r.isErr()) {
      expect(r.error._tag).toBe('RateLimited')
      if (r.error._tag === 'RateLimited') {
        expect(r.error.retryAfterSeconds).toBeGreaterThanOrEqual(0)
        expect(r.error.retryAfterSeconds).toBeLessThanOrEqual(86400)
      }
    }
  })

  it('Test 4: today entries summing to $1.00 (over) → err(RateLimited)', async () => {
    await writeLog([
      { ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 1.0, emailHash: 'sha256:a' },
    ])
    const r = await checkBudget()
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error._tag).toBe('RateLimited')
  })

  it('Test 5: yesterday $1.00 + today $0.10 → ok() (only today counts)', async () => {
    await writeLog([
      { ts: yesterdayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 1.0, emailHash: 'sha256:y' },
      { ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.1, emailHash: 'sha256:t' },
    ])
    const r = await checkBudget()
    expect(r.isOk()).toBe(true)
  })

  it('Test 6: file with malformed line FAILS CLOSED → err(RateLimited, retryAfterSeconds: 60)', async () => {
    await fs.writeFile(
      logPath,
      JSON.stringify({ ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.1, emailHash: 'sha256:a' }) +
        '\nthis is not valid JSON\n',
      'utf8',
    )
    const r = await checkBudget()
    expect(r.isErr()).toBe(true)
    if (r.isErr()) {
      expect(r.error._tag).toBe('RateLimited')
      if (r.error._tag === 'RateLimited') {
        expect(r.error.retryAfterSeconds).toBe(60)
      }
    }
  })

  it('Test 6b: ignores blank lines but does not fail closed on them', async () => {
    await fs.writeFile(
      logPath,
      JSON.stringify({ ts: todayIso(), model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0.1, emailHash: 'sha256:a' }) +
        '\n\n   \n',
      'utf8',
    )
    const r = await checkBudget()
    expect(r.isOk()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// appendCostEntry — write path
// ---------------------------------------------------------------------------

describe('appendCostEntry — JSONL writer', () => {
  it('Test 7a: creates data dir if missing and appends ONE valid JSON line', async () => {
    // Point CLASSIFIER_LOG_PATH at a nested dir that does NOT exist yet.
    const nested = path.join(tmpDir, 'data', 'classifier-log.jsonl')
    process.env['CLASSIFIER_LOG_PATH'] = nested

    const r = await appendCostEntry({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      model: 'claude-haiku-4-5-20251001',
      emailHash: 'sha256:' + 'a'.repeat(64),
    })
    expect(r.isOk()).toBe(true)
    if (r.isOk()) expect(r.value.costUsd).toBeCloseTo(4.8, 10)

    const contents = await fs.readFile(nested, 'utf8')
    const lines = contents.split('\n').filter((l) => l.trim())
    expect(lines.length).toBe(1)

    const parsed = JSON.parse(lines[0]!)
    expect(typeof parsed.ts).toBe('string')
    expect(parsed.model).toBe('claude-haiku-4-5-20251001')
    expect(parsed.inputTokens).toBe(1_000_000)
    expect(parsed.outputTokens).toBe(1_000_000)
    expect(parsed.costUsd).toBeCloseTo(4.8, 10)
    expect(parsed.emailHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    // ts is today's date
    expect(parsed.ts.slice(0, 10)).toBe(today())
  })

  it('Test 7b: two appends produce two lines — appendCostEntry is additive, never overwrites', async () => {
    await appendCostEntry({
      inputTokens: 100,
      outputTokens: 50,
      model: 'claude-haiku-4-5-20251001',
      emailHash: 'sha256:' + 'a'.repeat(64),
    })
    await appendCostEntry({
      inputTokens: 200,
      outputTokens: 100,
      model: 'claude-haiku-4-5-20251001',
      emailHash: 'sha256:' + 'b'.repeat(64),
    })
    const contents = await fs.readFile(logPath, 'utf8')
    const lines = contents.split('\n').filter((l) => l.trim())
    expect(lines.length).toBe(2)
  })
})
