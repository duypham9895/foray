// Unit tests for the ATS-domain blocklist + isAtsDomain helper.
// These exercise CAPT-02's matching algorithm: case-insensitive,
// protocol-stripping, apex-or-subdomain match against the hardcoded list.

import { describe, it, expect } from 'vitest'
import { ATS_DOMAINS, isAtsDomain } from './ats-domains'

describe('isAtsDomain', () => {
  it('returns true for a bare ATS apex (greenhouse.io)', () => {
    expect(isAtsDomain('greenhouse.io')).toBe(true)
  })

  it('returns true for an uppercase ATS apex (LEVER.CO) — case-insensitive match', () => {
    expect(isAtsDomain('LEVER.CO')).toBe(true)
  })

  it('returns true for a full URL (https://boards.greenhouse.io/company/foo) — strips protocol + path', () => {
    expect(isAtsDomain('https://boards.greenhouse.io/company/foo')).toBe(true)
  })

  it('returns true for a subdomain of an ATS apex (boards.greenhouse.io)', () => {
    expect(isAtsDomain('boards.greenhouse.io')).toBe(true)
  })

  it('returns false for a non-ATS company domain (stripe.com)', () => {
    expect(isAtsDomain('stripe.com')).toBe(false)
  })

  it('returns false for a near-match TLD swap (greenhouse.com is NOT in the list — only .io)', () => {
    expect(isAtsDomain('greenhouse.com')).toBe(false)
  })

  it('returns false for an empty string (schema layer enforces required-ness, not this helper)', () => {
    expect(isAtsDomain('')).toBe(false)
  })

  it('returns true for a domain wrapped in whitespace (  Workday.com  ) — trims input', () => {
    expect(isAtsDomain('  Workday.com  ')).toBe(true)
  })

  it('returns true for myworkdayjobs.com (Workday hosted apex variant)', () => {
    expect(isAtsDomain('myworkdayjobs.com')).toBe(true)
  })

  it('returns true for a deep LinkedIn job URL (www.linkedin.com/jobs/view/123)', () => {
    expect(isAtsDomain('www.linkedin.com/jobs/view/123')).toBe(true)
  })
})

describe('ATS_DOMAINS', () => {
  it('contains exactly the 15 lowercased ATS apex entries from CONTEXT.md (no duplicates)', () => {
    const expected = [
      'greenhouse.io',
      'lever.co',
      'workday.com',
      'myworkdayjobs.com',
      'linkedin.com',
      'ashbyhq.com',
      'smartrecruiters.com',
      'jobvite.com',
      'icims.com',
      'taleo.net',
      'recruitee.com',
      'breezy.hr',
      'bamboohr.com',
      'indeed.com',
      'glassdoor.com',
    ]
    // length + uniqueness + lowercase invariant + exact set
    expect(ATS_DOMAINS).toHaveLength(15)
    expect(new Set(ATS_DOMAINS).size).toBe(15)
    expect(ATS_DOMAINS.every((d) => d === d.toLowerCase())).toBe(true)
    expect([...ATS_DOMAINS].sort()).toEqual([...expected].sort())
  })
})
