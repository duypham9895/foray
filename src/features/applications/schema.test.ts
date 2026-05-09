// Unit tests for the applications-slice Zod schemas.
//
// These cover CAPT-02 (ATS-domain rejection on companyDomain), boundary
// validation on every string field, and the per-EventType discriminated
// schema set that locks the Phase 4 service contract.

import { describe, it, expect } from 'vitest'
import {
  createApplicationSchema,
  companyInputSchema,
  stageInputSchema,
  notesInputSchema,
  eventDataSchemaFor,
} from './schema'

// ---------------------------------------------------------------------------
// createApplicationSchema (C1–C7)
// ---------------------------------------------------------------------------

describe('createApplicationSchema', () => {
  it('C1: parses a minimal valid input and defaults appliedAt to a Date', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Stripe',
      roleTitle: 'SWE',
      source: 'direct',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appliedAt).toBeInstanceOf(Date)
      expect(result.data.source).toBe('direct')
    }
  })

  it('C2: rejects an empty companyName with a fieldError on companyName', () => {
    const result = createApplicationSchema.safeParse({
      companyName: '',
      roleTitle: 'SWE',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('companyName')
    }
  })

  it('C3: rejects a 161-char roleTitle (max is 160)', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Stripe',
      roleTitle: 'x'.repeat(161),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('roleTitle')
    }
  })

  it('C4: rejects a non-URL roleUrl ("not a url")', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Stripe',
      roleTitle: 'SWE',
      roleUrl: 'not a url',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('roleUrl')
    }
  })

  it('C5: rejects salaryMin > salaryMax with the salary-range refine error', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Stripe',
      roleTitle: 'SWE',
      salaryMin: 200_000,
      salaryMax: 100_000,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'salaryMax')
      expect(issue).toBeDefined()
      expect(issue?.message).toContain('salary range invalid')
    }
  })

  it('C6: rejects an invalid source enum value ("craigslist")', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Stripe',
      roleTitle: 'SWE',
      source: 'craigslist',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('source')
    }
  })

  it('C7: rejects a 2001-char notes field (max is 2000)', () => {
    const result = createApplicationSchema.safeParse({
      companyName: 'Stripe',
      roleTitle: 'SWE',
      notes: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('notes')
    }
  })
})

// ---------------------------------------------------------------------------
// companyInputSchema (K1–K5) — CAPT-02 ATS-domain rejection
// ---------------------------------------------------------------------------

describe('companyInputSchema', () => {
  it('K1: parses { name: "Stripe", domain: "stripe.com" }', () => {
    const result = companyInputSchema.safeParse({ name: 'Stripe', domain: 'stripe.com' })
    expect(result.success).toBe(true)
  })

  it('K2: rejects an ATS apex domain with a message containing "ATS" AND the literal domain', () => {
    const result = companyInputSchema.safeParse({ name: 'Stripe', domain: 'greenhouse.io' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'domain')
      expect(issue).toBeDefined()
      expect(issue?.message).toContain('ATS')
      expect(issue?.message).toContain('greenhouse.io')
    }
  })

  it('K3: rejects a full ATS URL post-strip (https://boards.greenhouse.io/foo)', () => {
    const result = companyInputSchema.safeParse({
      name: 'Stripe',
      domain: 'https://boards.greenhouse.io/foo',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('domain')
    }
  })

  it('K4: parses { name: "Stripe" } with no domain (domain optional)', () => {
    const result = companyInputSchema.safeParse({ name: 'Stripe' })
    expect(result.success).toBe(true)
  })

  it('K5: rejects an empty name (name required)', () => {
    const result = companyInputSchema.safeParse({ name: '', domain: 'stripe.com' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('name')
    }
  })
})

// ---------------------------------------------------------------------------
// stageInputSchema (S1–S4)
// ---------------------------------------------------------------------------

describe('stageInputSchema', () => {
  it('S1: parses { name: "Recruiter call" }', () => {
    const result = stageInputSchema.safeParse({ name: 'Recruiter call' })
    expect(result.success).toBe(true)
  })

  it('S2: parses a complete stage with outcome + notes', () => {
    const result = stageInputSchema.safeParse({
      name: 'Tech round 2',
      outcome: 'passed',
      notes: 'crushed it',
    })
    expect(result.success).toBe(true)
  })

  it('S3: rejects an invalid outcome enum value', () => {
    const result = stageInputSchema.safeParse({ name: 'X', outcome: 'invalid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('outcome')
    }
  })

  it('S4: rejects an empty stage name', () => {
    const result = stageInputSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('name')
    }
  })
})

// ---------------------------------------------------------------------------
// notesInputSchema (N1–N3)
// ---------------------------------------------------------------------------

describe('notesInputSchema', () => {
  it('N1: parses a short note', () => {
    const result = notesInputSchema.safeParse({ notes: 'short note' })
    expect(result.success).toBe(true)
  })

  it('N2: parses an empty notes string (clearing notes is allowed)', () => {
    const result = notesInputSchema.safeParse({ notes: '' })
    expect(result.success).toBe(true)
  })

  it('N3: rejects notes longer than 10000 chars', () => {
    const result = notesInputSchema.safeParse({ notes: 'x'.repeat(10001) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('notes')
    }
  })
})

// ---------------------------------------------------------------------------
// eventDataSchemaFor (E1–E12) — Phase 4 hard contract
// ---------------------------------------------------------------------------

describe('eventDataSchemaFor', () => {
  it("E1: 'created' accepts { source: 'manual' }", () => {
    const result = eventDataSchemaFor('created').safeParse({ source: 'manual' })
    expect(result.success).toBe(true)
  })

  it("E2: 'status_changed' accepts { previousStatus, newStatus }", () => {
    const result = eventDataSchemaFor('status_changed').safeParse({
      previousStatus: 'applied',
      newStatus: 'screening',
    })
    expect(result.success).toBe(true)
  })

  it("E3: 'auto_status_changed' accepts the full classifier-attribution shape", () => {
    const result = eventDataSchemaFor('auto_status_changed').safeParse({
      previousStatus: 'applied',
      newStatus: 'rejected',
      classifierConfidence: 0.95,
      classifiedBy: 'rules',
    })
    expect(result.success).toBe(true)
  })

  it("E4: 'auto_status_changed' rejects a payload missing newStatus", () => {
    const result = eventDataSchemaFor('auto_status_changed').safeParse({
      previousStatus: 'applied',
    })
    expect(result.success).toBe(false)
  })

  it("E5: 'stage_added' accepts { stageId, stageName }", () => {
    const result = eventDataSchemaFor('stage_added').safeParse({
      stageId: '42',
      stageName: 'Recruiter call',
    })
    expect(result.success).toBe(true)
  })

  it("E6: 'status_undone' accepts { undoneEventId, restoredStatus }", () => {
    const result = eventDataSchemaFor('status_undone').safeParse({
      undoneEventId: '99',
      restoredStatus: 'applied',
    })
    expect(result.success).toBe(true)
  })

  it("E7: 'note_added' accepts an empty object (no required fields)", () => {
    const result = eventDataSchemaFor('note_added').safeParse({})
    expect(result.success).toBe(true)
  })

  it("E8: 'email_received' accepts { emailId: '1' } (coerced int)", () => {
    const result = eventDataSchemaFor('email_received').safeParse({ emailId: '1' })
    expect(result.success).toBe(true)
  })

  it('E9: an unknown EventType returns the generic loose-passthrough fallback', () => {
    // This uses the classifier-side passthrough — extras flow through, no validation crash.
    const result = eventDataSchemaFor('totally_unknown_event').safeParse({
      anything: 'goes',
      nested: { ok: true },
    })
    expect(result.success).toBe(true)
  })

  it("E10: 'auto_status_changed' accepts the optional emailId as positive int (42)", () => {
    const result = eventDataSchemaFor('auto_status_changed').safeParse({
      previousStatus: 'applied',
      newStatus: 'screening',
      emailId: 42,
    })
    expect(result.success).toBe(true)
  })

  it("E11: 'auto_status_changed' rejects emailId: 0 (must be positive)", () => {
    const result = eventDataSchemaFor('auto_status_changed').safeParse({
      previousStatus: 'applied',
      newStatus: 'screening',
      emailId: 0,
    })
    expect(result.success).toBe(false)
  })

  it("E12: 'auto_status_changed' rejects unknown keys (strict)", () => {
    const result = eventDataSchemaFor('auto_status_changed').safeParse({
      previousStatus: 'applied',
      newStatus: 'screening',
      extraField: 'x',
    })
    expect(result.success).toBe(false)
  })
})
