// Integration test harness for tests/integration/classifier-fixtures/.
//
// **Purpose:** regression fence for the rule layer in
// `src/features/classifier/rules.ts`. Loads every fixture under each subdir,
// runs `classifyByRules` against (subject, bodyExcerpt), and asserts the
// returned label matches the fixture's `expectedLabel`. Confidence is NOT
// asserted strictly — the rule's tier may legitimately differ from the
// fixture's hint without changing the label.
//
// **Loop documented in `classifier-fixtures/README.md`:**
//   1. Add a fixture for a misclassification.
//   2. Run this test — it fails on the new file.
//   3. Tune `rules.ts` regex(es) until the test passes.
//   4. Commit fixture + rule together.
//
// This test does NOT exercise the LLM path. Plan 03-02's `service.test.ts`
// covers the LLM (mocked). Real fixtures + real Anthropic in CI is forbidden
// (cost + flakiness — Pitfall #6).

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { classifyByRules } from '@/features/classifier/rules'

const FIXTURES_ROOT = path.join(__dirname, 'classifier-fixtures')

type Fixture = {
  subject: string
  bodyExcerpt: string
  expectedLabel: 'rejection' | 'interview_invite' | 'recruiter_outreach' | 'noise' | 'unmatched'
  expectedConfidence?: number
  source: 'real' | 'synthetic'
  notes?: string
}

type LoadedFixture = {
  filepath: string
  subdir: string
  filename: string
  fixture: Fixture
}

function loadAllFixtures(): LoadedFixture[] {
  const subdirs = readdirSync(FIXTURES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort() // deterministic order makes test output stable
  return subdirs.flatMap((subdir) => {
    const subdirPath = path.join(FIXTURES_ROOT, subdir)
    return readdirSync(subdirPath)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((filename) => {
        const filepath = path.join(subdirPath, filename)
        const content = readFileSync(filepath, 'utf8')
        const fixture = JSON.parse(content) as Fixture
        return { filepath, subdir, filename, fixture }
      })
  })
}

describe('classifier rule fixtures', () => {
  const fixtures = loadAllFixtures()

  it('discovers ≥8 fixtures across ≥5 subdirs', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(8)
    const subdirs = new Set(fixtures.map((f) => f.subdir))
    expect(subdirs.size).toBeGreaterThanOrEqual(5)
  })

  it('every fixture has the required keys + valid enum values', () => {
    for (const { filepath, fixture } of fixtures) {
      expect(fixture, `Fixture ${filepath} is missing fields`).toMatchObject({
        subject: expect.any(String),
        bodyExcerpt: expect.any(String),
        expectedLabel: expect.stringMatching(
          /^(rejection|interview_invite|recruiter_outreach|noise|unmatched)$/,
        ),
        source: expect.stringMatching(/^(real|synthetic)$/),
      })
    }
  })

  it('every fixture body excerpt is ≤500 chars (mirrors production privacy rule per CLAUDE.md §6)', () => {
    for (const { filepath, fixture } of fixtures) {
      expect(
        fixture.bodyExcerpt.length,
        `Fixture ${filepath} body exceeds 500 chars (length=${fixture.bodyExcerpt.length})`,
      ).toBeLessThanOrEqual(500)
    }
  })

  it('no fixture contains a real personal email domain (privacy regression fence)', () => {
    const REAL_DOMAINS = /@(gmail|yahoo|outlook|icloud|hotmail|aol)\.com/i
    for (const { filepath, fixture } of fixtures) {
      const blob = `${fixture.subject}\n${fixture.bodyExcerpt}`
      expect(
        REAL_DOMAINS.test(blob),
        `Fixture ${filepath} contains a real personal email domain`,
      ).toBe(false)
    }
  })

  it.each(fixtures)(
    '$subdir/$filename → classifyByRules returns expectedLabel',
    ({ filepath, fixture }) => {
      const result = classifyByRules({
        subject: fixture.subject,
        bodyExcerpt: fixture.bodyExcerpt,
      })
      expect(
        result.label,
        `Fixture ${filepath} expected label="${fixture.expectedLabel}" but classifyByRules returned label="${result.label}" (confidence=${result.confidence}, matchedRuleIndex=${result.matchedRuleIndex ?? 'none'})`,
      ).toBe(fixture.expectedLabel)
    },
  )
})
