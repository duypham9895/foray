// Unit tests for src/features/classifier/thresholds.ts.
//
// Locks the EXACT values from CONTEXT §Area 3 + the rejection > interview_invite
// asymmetry invariant (Pitfall #4). Boundary tests on meetsThreshold().

import { describe, it, expect } from 'vitest'

import { THRESHOLDS, meetsThreshold } from './thresholds'

describe('THRESHOLDS — exact values from CONTEXT §Area 3', () => {
  it('Test 1: has exactly 5 keys matching the EmailClassification enum', () => {
    const expectedKeys = [
      'rejection',
      'interview_invite',
      'recruiter_outreach',
      'noise',
      'unmatched',
    ].sort()
    expect(Object.keys(THRESHOLDS).sort()).toEqual(expectedKeys)
  })

  it('Test 2: rejection (0.92) is HIGHER than interview_invite (0.85) — asymmetry invariant', () => {
    expect(THRESHOLDS.rejection).toBe(0.92)
    expect(THRESHOLDS.interview_invite).toBe(0.85)
    expect(THRESHOLDS.rejection).toBeGreaterThan(THRESHOLDS.interview_invite)
  })

  it('Test 2b: full LOCKED value table matches CONTEXT §Area 3', () => {
    expect(THRESHOLDS.rejection).toBe(0.92)
    expect(THRESHOLDS.interview_invite).toBe(0.85)
    expect(THRESHOLDS.recruiter_outreach).toBe(0.8)
    expect(THRESHOLDS.noise).toBe(0.7)
    expect(THRESHOLDS.unmatched).toBe(1.0)
  })
})

describe('meetsThreshold — boundary semantics', () => {
  it('Test 3: meetsThreshold("rejection", 0.92) === true (boundary inclusive)', () => {
    expect(meetsThreshold('rejection', 0.92)).toBe(true)
  })

  it('Test 4: meetsThreshold("rejection", 0.91) === false (just below)', () => {
    expect(meetsThreshold('rejection', 0.91)).toBe(false)
  })

  it('Test 5: meetsThreshold("unmatched", 1.0) === true; 0.99 === false (unmatched never auto-acts at <1.0)', () => {
    expect(meetsThreshold('unmatched', 1.0)).toBe(true)
    expect(meetsThreshold('unmatched', 0.99)).toBe(false)
  })

  it('Test 6: meetsThreshold("noise", 0.70) === true; 0.69 === false', () => {
    expect(meetsThreshold('noise', 0.7)).toBe(true)
    expect(meetsThreshold('noise', 0.69)).toBe(false)
  })

  it('Test 7: meetsThreshold("interview_invite", 0.85) === true; 0.849 === false', () => {
    expect(meetsThreshold('interview_invite', 0.85)).toBe(true)
    expect(meetsThreshold('interview_invite', 0.849)).toBe(false)
  })

  it('Test 8: meetsThreshold returns false for confidence above 1.0 only when threshold > 1 (vacuous case — confidence 1.0 always passes anything ≤1.0)', () => {
    // Sanity: confidence = 1.0 passes every threshold value ≤ 1.0
    for (const label of Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>) {
      expect(meetsThreshold(label, 1.0)).toBe(true)
    }
  })
})
