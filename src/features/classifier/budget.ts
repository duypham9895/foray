// Daily budget guard + cost recorder for the LLM classifier (CLASS-04).
//
// Two responsibilities:
//   1. checkBudget()       — read data/classifier-log.jsonl, sum today's
//                            costUsd entries, return RateLimited if ≥ $0.50.
//   2. appendCostEntry()   — after every LLM call, write a JSONL line with
//                            token counts, computed costUsd, and a SHA256
//                            hash of the email content (privacy-preserving
//                            identifier, NEVER the raw subject/body).
//
// **Fail-closed (T-03-01-02):** if the cost log can't be read or contains
// invalid JSON, checkBudget returns err(RateLimited) — never silently allows
// the LLM call. A corrupt file would otherwise enable unbounded spend.
//
// **Privacy (CLAUDE.md §6 + T-03-01-01):** the cost log never stores raw
// subject or body — only their SHA256 hash. The hash lets us detect "this
// email was classified twice" without storing PII.
//
// **No log rotation, no tiered warnings, no per-label budgets** (deferred to
// the Standard milestone per CONTEXT §Area 4 + Karpathy §1.2 simplicity).

import 'server-only'

import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { logger } from '@/core/logger'
import { type AppError, type Result, err, errors, ok } from '@/core/errors'

// ---------------------------------------------------------------------------
// LOCKED constants — see CONTEXT §Area 4
// ---------------------------------------------------------------------------

/** Per-day USD spending cap on the LLM classifier. */
export const DAILY_BUDGET_USD = 0.5

// Provider pricing, per million tokens. Keep model keys aligned with the
// provider adapters; cost logging passes the concrete model string.
export const HAIKU_INPUT_USD_PER_MTOK = 0.8 // $0.80 per million input tokens
export const HAIKU_OUTPUT_USD_PER_MTOK = 4.0 // $4.00 per million output tokens
export const GPT_5_4_NANO_INPUT_USD_PER_MTOK = 0.2 // $0.20 per million input tokens
export const GPT_5_4_NANO_OUTPUT_USD_PER_MTOK = 1.25 // $1.25 per million output tokens
const DEFAULT_CLASSIFIER_LOG_PATH = 'data/classifier-log.jsonl'

/**
 * Cost-log path. Defaults to `<cwd>/data/classifier-log.jsonl`. Tests
 * override via `CLASSIFIER_LOG_PATH` env var — NOT documented in
 * .env.example because it is not user-configurable in production.
 *
 * Resolved on every call (not at module load) so tests that mutate
 * `CLASSIFIER_LOG_PATH` per-test pick up the new value. A module-load-time
 * cache would diverge from the env on the very first call after a test
 * unset.
 */
function currentLogPath(): string {
  return process.env['CLASSIFIER_LOG_PATH'] ?? DEFAULT_CLASSIFIER_LOG_PATH
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function computeCostUsd(
  inputTokens: number,
  outputTokens: number,
  model: string = 'claude-haiku-4-5-20251001',
): number {
  const pricing = getPricingForModel(model)
  return (
    (inputTokens / 1_000_000) * pricing.inputUsdPerMTok +
    (outputTokens / 1_000_000) * pricing.outputUsdPerMTok
  )
}

/**
 * Privacy-preserving identifier for a classified email. The hash is the
 * audit identifier — it lets us detect "this email was classified twice"
 * without storing the raw subject or body. See threat T-03-01-01.
 */
export function hashEmailContent(subject: string, bodyExcerpt: string): string {
  const digest = crypto.createHash('sha256').update(subject + '\n' + bodyExcerpt).digest('hex')
  return 'sha256:' + digest
}

/** Seconds remaining until the next UTC midnight. Pure; defaults `now` to `new Date()`. */
export function secondsUntilMidnight(now: Date = new Date()): number {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  )
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
}

// ---------------------------------------------------------------------------
// checkBudget — pre-call guard
// ---------------------------------------------------------------------------

type CostLogEntry = {
  ts: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  emailHash: string
}

export async function checkBudget(): Promise<Result<void, AppError>> {
  const filePath = currentLogPath()

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (cause) {
    // Missing file = no spend yet — that is OK, return ok().
    if (isFileNotFoundError(cause)) return ok(undefined)
    // Any other read failure FAILS CLOSED (T-03-01-02): we cannot let an
    // unreadable file silently authorize unbounded LLM spend.
    logger.error({ op: 'classifier.budget.read', err: cause }, 'budget log unreadable — failing closed')
    return err(errors.rateLimited(60))
  }

  const today = new Date().toISOString().slice(0, 10)
  let total = 0
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    let parsed: CostLogEntry
    try {
      parsed = JSON.parse(trimmed) as CostLogEntry
    } catch (cause) {
      logger.error(
        { op: 'classifier.budget.parse', err: cause },
        'budget log line malformed — failing closed',
      )
      return err(errors.rateLimited(60))
    }
    if (typeof parsed.ts !== 'string' || typeof parsed.costUsd !== 'number') {
      logger.error({ op: 'classifier.budget.shape' }, 'budget log entry missing ts/costUsd — failing closed')
      return err(errors.rateLimited(60))
    }
    if (parsed.ts.slice(0, 10) === today) {
      total += parsed.costUsd
    }
  }

  if (total >= DAILY_BUDGET_USD) {
    return err(errors.rateLimited(secondsUntilMidnight()))
  }
  return ok(undefined)
}

// ---------------------------------------------------------------------------
// appendCostEntry — post-call recorder
// ---------------------------------------------------------------------------

export type AppendCostInput = {
  inputTokens: number
  outputTokens: number
  /** Anthropic model identifier — accepts the dated form (e.g. claude-haiku-4-5-20251001). */
  model: string
  /** Output of hashEmailContent(); never raw subject/body. */
  emailHash: string
}

export async function appendCostEntry(
  input: AppendCostInput,
): Promise<Result<{ costUsd: number }, AppError>> {
  const filePath = currentLogPath()
  const costUsd = computeCostUsd(input.inputTokens, input.outputTokens, input.model)
  const entry: CostLogEntry = {
    ts: new Date().toISOString(),
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    costUsd,
    emailHash: input.emailHash,
  }
  const line = JSON.stringify(entry) + '\n'

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, line, 'utf8')
  } catch (cause) {
    logger.error({ op: 'classifier.budget.append', err: cause }, 'failed to append cost entry')
    return err(errors.db(cause))
  }
  return ok({ costUsd })
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function isFileNotFoundError(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code?: string }).code === 'ENOENT'
  )
}

function getPricingForModel(model: string): {
  inputUsdPerMTok: number
  outputUsdPerMTok: number
} {
  if (model === 'gpt-5.4-nano') {
    return {
      inputUsdPerMTok: GPT_5_4_NANO_INPUT_USD_PER_MTOK,
      outputUsdPerMTok: GPT_5_4_NANO_OUTPUT_USD_PER_MTOK,
    }
  }

  return {
    inputUsdPerMTok: HAIKU_INPUT_USD_PER_MTOK,
    outputUsdPerMTok: HAIKU_OUTPUT_USD_PER_MTOK,
  }
}
