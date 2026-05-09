// Unit tests for src/features/classifier/service.ts (classifyEmail composition).
//
// All four building blocks are mocked:
//   - rules.classifyByRules    — deterministic stub per test
//   - llm.classifyByLlm        — stub Result.ok / Result.err per test
//   - budget.checkBudget       — stub Result.ok / Result.err per test
//   - budget.appendCostEntry   — stub + spied for arg assertions
//   - budget.hashEmailContent  — REAL (pure crypto helper, safe to use)
//
// Coverage:
//   T1  — rules confident (≥0.85) → short-circuits, NO LLM/budget calls
//   T2  — rules unmatched         → short-circuits, NO LLM/budget calls
//   T3  — rules weak → LLM happy path → cost recorded with sha256 hash
//   T4  — budget exhausted → returns RateLimited; LLM NEVER called
//   T5  — LLM error path → returned as-is; appendCostEntry NEVER called
//   T6  — appendCostEntry fails → classification STILL returns ok (HACK)
//   T7  — subject > 500 chars → Validation
//   T8  — bodyExcerpt > 500 chars → Validation
//   T9  — privacy: appendCostEntry called with sha256 hash, NOT raw content
//
// T1 + T2 are the cost-bound fence (rules-confident never spends).
// T4 is the budget-runaway fence (Pitfall #6 / T-03-02-03).
// T9 is the privacy regression fence (CLAUDE.md §6 / T-03-02-04).

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — set up BEFORE importing the service under test
// ---------------------------------------------------------------------------

vi.mock('./rules', () => ({
  classifyByRules: vi.fn(),
}))

vi.mock('./llm', async () => {
  const actual = await vi.importActual<typeof import('./llm')>('./llm')
  return {
    ...actual,
    classifyByLlm: vi.fn(),
  }
})

vi.mock('./budget', async () => {
  const actual = await vi.importActual<typeof import('./budget')>('./budget')
  return {
    ...actual,
    checkBudget: vi.fn(),
    appendCostEntry: vi.fn(),
  }
})

import { ok, err } from 'neverthrow'

import { classifyEmail } from './service'
import { classifyByRules } from './rules'
import { classifyByLlm, MODEL } from './llm'
import { checkBudget, appendCostEntry } from './budget'

const mockedRules = vi.mocked(classifyByRules)
const mockedLlm = vi.mocked(classifyByLlm)
const mockedCheckBudget = vi.mocked(checkBudget)
const mockedAppendCost = vi.mocked(appendCostEntry)

beforeEach(() => {
  mockedRules.mockReset()
  mockedLlm.mockReset()
  mockedCheckBudget.mockReset()
  mockedAppendCost.mockReset()
  // Default: appendCostEntry succeeds (overridable per-test)
  mockedAppendCost.mockResolvedValue(ok({ costUsd: 0.000504 }))
})

// ---------------------------------------------------------------------------
// T1 + T2 — rules-first short-circuits
// ---------------------------------------------------------------------------

describe('classifyEmail — rules-first short-circuit (cost-bound fence)', () => {
  it('Test T1: rules confident (≥0.85, label != unmatched) → ok({classifiedBy:"rules"}), NO LLM, NO budget call', async () => {
    mockedRules.mockReturnValue({
      label: 'rejection',
      confidence: 0.95,
      classifiedBy: 'rules',
      matchedRuleIndex: 0,
    })

    const r = await classifyEmail({
      subject: 'Update on your application',
      bodyExcerpt: 'We have decided not to move forward.',
    })

    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      expect(r.value).toEqual({ label: 'rejection', confidence: 0.95, classifiedBy: 'rules' })
    }
    expect(mockedCheckBudget).not.toHaveBeenCalled()
    expect(mockedLlm).not.toHaveBeenCalled()
    expect(mockedAppendCost).not.toHaveBeenCalled()
  })

  it('Test T2: rules unmatched → ok({label:"unmatched", confidence:0, classifiedBy:"rules"}), NO LLM, NO budget call', async () => {
    mockedRules.mockReturnValue({
      label: 'unmatched',
      confidence: 0,
      classifiedBy: 'rules',
    })

    const r = await classifyEmail({ subject: 'random', bodyExcerpt: 'meeting reminder' })

    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      expect(r.value).toEqual({ label: 'unmatched', confidence: 0, classifiedBy: 'rules' })
    }
    expect(mockedCheckBudget).not.toHaveBeenCalled()
    expect(mockedLlm).not.toHaveBeenCalled()
    expect(mockedAppendCost).not.toHaveBeenCalled()
  })

  it('Test T1b: rules confident at the 0.85 boundary → still short-circuits', async () => {
    mockedRules.mockReturnValue({
      label: 'interview_invite',
      confidence: 0.85,
      classifiedBy: 'rules',
      matchedRuleIndex: 2,
    })
    const r = await classifyEmail({ subject: 's', bodyExcerpt: 'b' })
    expect(r.isOk()).toBe(true)
    if (r.isOk()) expect(r.value.classifiedBy).toBe('rules')
    expect(mockedLlm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T3 — LLM happy path
// ---------------------------------------------------------------------------

describe('classifyEmail — LLM escalation (rules weak)', () => {
  it('Test T3: rules weak → checkBudget ok → LLM ok → ok({classifiedBy:"llm"}); appendCostEntry called with right args', async () => {
    mockedRules.mockReturnValue({
      label: 'rejection',
      confidence: 0.8,
      classifiedBy: 'rules',
      matchedRuleIndex: 1,
    })
    mockedCheckBudget.mockResolvedValue(ok(undefined))
    mockedLlm.mockResolvedValue(
      ok({
        label: 'rejection',
        confidence: 0.93,
        classifiedBy: 'llm',
        inputTokens: 420,
        outputTokens: 42,
      }),
    )

    const r = await classifyEmail({
      subject: 'Update',
      bodyExcerpt: 'Thank you for your interest.',
    })

    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      expect(r.value).toEqual({ label: 'rejection', confidence: 0.93, classifiedBy: 'llm' })
    }
    expect(mockedCheckBudget).toHaveBeenCalledTimes(1)
    expect(mockedLlm).toHaveBeenCalledTimes(1)
    expect(mockedAppendCost).toHaveBeenCalledTimes(1)
    const costArgs = mockedAppendCost.mock.calls[0]![0]
    expect(costArgs.inputTokens).toBe(420)
    expect(costArgs.outputTokens).toBe(42)
    expect(costArgs.model).toBe(MODEL)
    expect(costArgs.emailHash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})

// ---------------------------------------------------------------------------
// T4 — budget exhausted
// ---------------------------------------------------------------------------

describe('classifyEmail — budget gate (cost-runaway fence)', () => {
  it('Test T4: rules weak → checkBudget returns RateLimited → classifyEmail returns RateLimited; LLM NEVER called', async () => {
    mockedRules.mockReturnValue({
      label: 'rejection',
      confidence: 0.8,
      classifiedBy: 'rules',
      matchedRuleIndex: 1,
    })
    mockedCheckBudget.mockResolvedValue(err({ _tag: 'RateLimited', retryAfterSeconds: 1234 }))

    const r = await classifyEmail({ subject: 's', bodyExcerpt: 'b' })

    expect(r.isErr()).toBe(true)
    if (r.isErr()) {
      expect(r.error._tag).toBe('RateLimited')
      if (r.error._tag === 'RateLimited') {
        expect(r.error.retryAfterSeconds).toBe(1234)
      }
    }
    expect(mockedLlm).not.toHaveBeenCalled()
    expect(mockedAppendCost).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T5 — LLM error
// ---------------------------------------------------------------------------

describe('classifyEmail — LLM error propagation', () => {
  it('Test T5: rules weak → budget ok → LLM err → returns the err; appendCostEntry NEVER called (no charge for failures)', async () => {
    mockedRules.mockReturnValue({
      label: 'rejection',
      confidence: 0.8,
      classifiedBy: 'rules',
      matchedRuleIndex: 1,
    })
    mockedCheckBudget.mockResolvedValue(ok(undefined))
    mockedLlm.mockResolvedValue(err({ _tag: 'ExternalApi', service: 'llm', cause: '529_overloaded' }))

    const r = await classifyEmail({ subject: 's', bodyExcerpt: 'b' })

    expect(r.isErr()).toBe(true)
    if (r.isErr()) {
      expect(r.error._tag).toBe('ExternalApi')
      if (r.error._tag === 'ExternalApi') {
        expect(r.error.service).toBe('llm')
      }
    }
    expect(mockedAppendCost).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T6 — cost-log write failure ignored (HACK)
// ---------------------------------------------------------------------------

describe('classifyEmail — cost-log write failure is best-effort', () => {
  it('Test T6: appendCostEntry fails (Db) → classifyEmail STILL returns ok (HACK: under-counting > over-billing)', async () => {
    mockedRules.mockReturnValue({
      label: 'rejection',
      confidence: 0.8,
      classifiedBy: 'rules',
      matchedRuleIndex: 1,
    })
    mockedCheckBudget.mockResolvedValue(ok(undefined))
    mockedLlm.mockResolvedValue(
      ok({
        label: 'rejection',
        confidence: 0.93,
        classifiedBy: 'llm',
        inputTokens: 100,
        outputTokens: 20,
      }),
    )
    mockedAppendCost.mockResolvedValue(err({ _tag: 'Db', cause: new Error('disk full') }))

    const r = await classifyEmail({ subject: 's', bodyExcerpt: 'b' })

    // Classification still succeeds — cost-log is best-effort.
    expect(r.isOk()).toBe(true)
    if (r.isOk()) {
      expect(r.value).toEqual({ label: 'rejection', confidence: 0.93, classifiedBy: 'llm' })
    }
    expect(mockedAppendCost).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// T7 + T8 — input validation
// ---------------------------------------------------------------------------

describe('classifyEmail — input validation (slice boundary)', () => {
  it('Test T7: subject > 500 chars → err(Validation); rules NEVER consulted', async () => {
    const longSubject = 'x'.repeat(501)
    const r = await classifyEmail({ subject: longSubject, bodyExcerpt: 'short' })
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error._tag).toBe('Validation')
    expect(mockedRules).not.toHaveBeenCalled()
  })

  it('Test T8: bodyExcerpt > 500 chars → err(Validation)', async () => {
    const longBody = 'y'.repeat(501)
    const r = await classifyEmail({ subject: 'short', bodyExcerpt: longBody })
    expect(r.isErr()).toBe(true)
    if (r.isErr()) expect(r.error._tag).toBe('Validation')
    expect(mockedRules).not.toHaveBeenCalled()
  })

  it('Test T8b: empty strings ALLOWED (boundary, not lower-bounded by Zod)', async () => {
    mockedRules.mockReturnValue({ label: 'unmatched', confidence: 0, classifiedBy: 'rules' })
    const r = await classifyEmail({ subject: '', bodyExcerpt: '' })
    expect(r.isOk()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T9 — privacy regression fence
// ---------------------------------------------------------------------------

describe('classifyEmail — PRIVACY: cost log never carries raw content (T-03-02-04)', () => {
  it('Test T9: appendCostEntry called with emailHash; never with raw subject/body', async () => {
    const subject = 'CONFIDENTIAL Sender Name'
    const bodyExcerpt = 'Internal account number 12345 should never reach the cost log'
    mockedRules.mockReturnValue({
      label: 'rejection',
      confidence: 0.8,
      classifiedBy: 'rules',
      matchedRuleIndex: 1,
    })
    mockedCheckBudget.mockResolvedValue(ok(undefined))
    mockedLlm.mockResolvedValue(
      ok({
        label: 'rejection',
        confidence: 0.91,
        classifiedBy: 'llm',
        inputTokens: 50,
        outputTokens: 10,
      }),
    )

    const r = await classifyEmail({ subject, bodyExcerpt })

    expect(r.isOk()).toBe(true)
    expect(mockedAppendCost).toHaveBeenCalledTimes(1)
    const callArg = mockedAppendCost.mock.calls[0]![0]
    // Required: emailHash present and shaped correctly
    expect(callArg.emailHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    // Forbidden: raw content fields
    expect(callArg).not.toHaveProperty('subject')
    expect(callArg).not.toHaveProperty('bodyExcerpt')
    expect(callArg).not.toHaveProperty('body')
    // Verify no value in the call object contains the raw strings (defense
    // against future refactor that adds a "summary" or "preview" field).
    const serialized = JSON.stringify(callArg)
    expect(serialized).not.toContain('CONFIDENTIAL')
    expect(serialized).not.toContain('account number 12345')
  })
})
