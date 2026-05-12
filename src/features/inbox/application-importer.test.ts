import { describe, expect, it } from 'vitest'

import {
  inferApplicationDraftFromEmail,
  shouldAutoClearClassification,
} from './application-importer'
import type { ParsedEmail } from './gmail-client'

function makeEmail(overrides: Partial<ParsedEmail> = {}): ParsedEmail {
  return {
    gmailMessageId: 'msg-1',
    gmailThreadId: 'thread-1',
    from: 'jobs@example.com',
    fromDomain: 'example.com',
    subject: 'Thanks for applying',
    bodyExcerpt: '',
    receivedAt: new Date('2026-05-12T00:00:00Z'),
    ...overrides,
  }
}

describe('inferApplicationDraftFromEmail', () => {
  it('creates a draft from a Stripe application confirmation subject/body', () => {
    const draft = inferApplicationDraftFromEmail(
      makeEmail({
        fromDomain: 'stripe.com',
        subject: 'Thanks for applying to Stripe!',
        bodyExcerpt:
          'Thanks so much for submitting your application for the Product Manager, SEA role!',
      }),
      { label: 'unmatched', confidence: 0.98, classifiedBy: 'llm' },
    )

    expect(draft).toEqual({
      companyName: 'Stripe',
      companyDomain: 'stripe.com',
      roleTitle: 'Product Manager, SEA',
      canonicalStatus: 'applied',
      currentStage: 'Application received',
      rejectedAt: null,
      rejectionReason: null,
    })
  })

  it('marks clear rejection emails as rejected even when the classifier label is weaker', () => {
    const draft = inferApplicationDraftFromEmail(
      makeEmail({
        fromDomain: 'stripe.com',
        subject: 'Your application for our Product Manager, SEA role at Stripe',
        bodyExcerpt:
          'Thank you for your application. Unfortunately we are going in a direction that better fits our needs.',
      }),
      { label: 'recruiter_outreach', confidence: 0.9, classifiedBy: 'llm' },
    )

    expect(draft?.canonicalStatus).toBe('rejected')
    expect(draft?.companyName).toBe('Stripe')
    expect(draft?.roleTitle).toBe('Product Manager, SEA')
  })

  it('creates a draft from an application received subject when company and role are present', () => {
    const draft = inferApplicationDraftFromEmail(
      makeEmail({
        fromDomain: 'axon.com',
        subject: 'Thank you for applying to Axon!',
        bodyExcerpt: 'We received your application for Sr Technical Program Manager I.',
      }),
      { label: 'unmatched', confidence: 0.86, classifiedBy: 'llm' },
    )

    expect(draft?.companyName).toBe('Axon')
    expect(draft?.companyDomain).toBe('axon.com')
    expect(draft?.roleTitle).toBe('Sr Technical Program Manager I')
  })

  it('does not create a draft from generic LinkedIn job alert emails', () => {
    const draft = inferApplicationDraftFromEmail(
      makeEmail({
        fromDomain: 'linkedin.com',
        subject: 'Product Manager at ExampleCo',
        bodyExcerpt: 'Your job alert for Product Manager in Vietnam. New jobs match your preferences.',
      }),
      { label: 'noise', confidence: 0.96, classifiedBy: 'llm' },
    )

    expect(draft).toBeNull()
  })
})

describe('shouldAutoClearClassification', () => {
  it('auto-clears high-confidence noise with no linked application', () => {
    expect(
      shouldAutoClearClassification(
        { label: 'noise', confidence: 0.9, classifiedBy: 'llm' },
        { applicationId: null },
      ),
    ).toBe(true)
  })

  it('does not auto-clear low-confidence noise', () => {
    expect(
      shouldAutoClearClassification(
        { label: 'noise', confidence: 0.34, classifiedBy: 'llm' },
        { applicationId: null },
      ),
    ).toBe(false)
  })
})
