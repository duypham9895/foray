// Unit tests for status-transitions.ts.
//
// Covers the 6×6 = 36 prev→next combinations of CanonicalStatus, plus
// 16 explicit named cases that document the "why" of each non-obvious cell.
//
// See plan 02-02 task 1 behavior block for the full rationale.

import { describe, it, expect } from 'vitest'
import type { CanonicalStatus } from '@/generated/prisma/client'
import { isStatusRegression, STATUS_RANK } from './status-transitions'

const STATUSES: ReadonlyArray<CanonicalStatus> = [
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]

// Expected matrix: EXPECTED[prev][next] = isRegression?
// Build per the rule from the plan:
//   - prev === next → false (no movement)
//   - prev terminal && !next terminal → true (un-rejecting is human-only)
//   - !prev terminal && next terminal → false (closing out is forward)
//   - prev terminal && next terminal → false (rejected ↔ withdrawn equal)
//   - both non-terminal → STATUS_RANK[next] < STATUS_RANK[prev]
const TERMINAL = new Set<CanonicalStatus>(['rejected', 'withdrawn'])
const RANK: Record<CanonicalStatus, number> = {
  applied: 1,
  screening: 2,
  interviewing: 3,
  offer: 4,
  rejected: 5,
  withdrawn: 5,
}
const EXPECTED: Record<CanonicalStatus, Record<CanonicalStatus, boolean>> = {} as Record<
  CanonicalStatus,
  Record<CanonicalStatus, boolean>
>
for (const prev of STATUSES) {
  EXPECTED[prev] = {} as Record<CanonicalStatus, boolean>
  for (const next of STATUSES) {
    if (prev === next) {
      EXPECTED[prev][next] = false
      continue
    }
    const prevTerm = TERMINAL.has(prev)
    const nextTerm = TERMINAL.has(next)
    if (prevTerm && !nextTerm) {
      EXPECTED[prev][next] = true
    } else if (!prevTerm && nextTerm) {
      EXPECTED[prev][next] = false
    } else if (prevTerm && nextTerm) {
      EXPECTED[prev][next] = false
    } else {
      EXPECTED[prev][next] = RANK[next] < RANK[prev]
    }
  }
}

describe('STATUS_RANK', () => {
  it('rank-shape: all 6 canonical statuses have a rank entry; rejected and withdrawn share rank 5', () => {
    expect(STATUS_RANK.applied).toBe(1)
    expect(STATUS_RANK.screening).toBe(2)
    expect(STATUS_RANK.interviewing).toBe(3)
    expect(STATUS_RANK.offer).toBe(4)
    expect(STATUS_RANK.rejected).toBe(5)
    expect(STATUS_RANK.withdrawn).toBe(5)
  })
})

describe('isStatusRegression — explicit cases (R1–R16)', () => {
  it('R1: applied → applied returns false (no-op, not a regression)', () => {
    expect(isStatusRegression('applied', 'applied')).toBe(false)
  })

  it('R2: applied → screening returns false (forward)', () => {
    expect(isStatusRegression('applied', 'screening')).toBe(false)
  })

  it('R3: screening → applied returns true (backward in lifecycle)', () => {
    expect(isStatusRegression('screening', 'applied')).toBe(true)
  })

  it('R4: interviewing → screening returns true (backward)', () => {
    expect(isStatusRegression('interviewing', 'screening')).toBe(true)
  })

  it('R5: interviewing → offer returns false (forward)', () => {
    expect(isStatusRegression('interviewing', 'offer')).toBe(false)
  })

  it('R6: offer → interviewing returns true (backward)', () => {
    expect(isStatusRegression('offer', 'interviewing')).toBe(true)
  })

  it('R7: interviewing → rejected returns false (forward to terminal)', () => {
    expect(isStatusRegression('interviewing', 'rejected')).toBe(false)
  })

  it('R8: offer → rejected returns false (forward to terminal — rescinded/declined)', () => {
    expect(isStatusRegression('offer', 'rejected')).toBe(false)
  })

  it('R9: rejected → applied returns true (un-rejecting is human-only)', () => {
    expect(isStatusRegression('rejected', 'applied')).toBe(true)
  })

  it('R10: rejected → screening returns true', () => {
    expect(isStatusRegression('rejected', 'screening')).toBe(true)
  })

  it('R11: rejected → interviewing returns true', () => {
    expect(isStatusRegression('rejected', 'interviewing')).toBe(true)
  })

  it('R12: rejected → offer returns true', () => {
    expect(isStatusRegression('rejected', 'offer')).toBe(true)
  })

  it('R13: withdrawn → applied returns true', () => {
    expect(isStatusRegression('withdrawn', 'applied')).toBe(true)
  })

  it('R14: rejected → withdrawn returns false (terminal-to-terminal, no movement)', () => {
    expect(isStatusRegression('rejected', 'withdrawn')).toBe(false)
  })

  it('R15: withdrawn → rejected returns false (terminal-to-terminal, no movement)', () => {
    expect(isStatusRegression('withdrawn', 'rejected')).toBe(false)
  })

  it('R16: applied → withdrawn returns false (forward to terminal)', () => {
    expect(isStatusRegression('applied', 'withdrawn')).toBe(false)
  })
})

describe('isStatusRegression — full 6×6 matrix (R17, parameterized)', () => {
  // Build the cartesian product.
  const cells: Array<[CanonicalStatus, CanonicalStatus, boolean]> = []
  for (const prev of STATUSES) {
    for (const next of STATUSES) {
      cells.push([prev, next, EXPECTED[prev][next]])
    }
  }

  it.each(cells)('R17: %s → %s expects %s', (prev, next, expected) => {
    expect(isStatusRegression(prev, next)).toBe(expected)
  })
})
