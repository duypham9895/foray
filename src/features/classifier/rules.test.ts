// Unit tests for src/features/classifier/rules.ts.
//
// Covers: each label's 0.95 + 0.80 tier matches (subject- and body-side),
// priority tiebreaks (rejection > interview_invite > recruiter_outreach >
// noise > unmatched), case-insensitivity, no-match, and a few "should-NOT-
// fire" negatives. Real-shaped fixture strings (not "test test test").

import { describe, it, expect } from 'vitest'

import { CLASSIFICATION_RULES, classifyByRules } from './rules'

describe('CLASSIFICATION_RULES table', () => {
  it('Test 1: every entry has the shape {label, pattern, confidence, source}', () => {
    expect(CLASSIFICATION_RULES.length).toBeGreaterThan(0)
    for (const rule of CLASSIFICATION_RULES) {
      expect(typeof rule.label).toBe('string')
      expect(rule.pattern).toBeInstanceOf(RegExp)
      expect([0.95, 0.8]).toContain(rule.confidence)
      expect(['subject', 'body', 'either']).toContain(rule.source)
    }
  })
})

describe('classifyByRules — 0.95-tier subject matches per label', () => {
  it('Test 2: rejection 0.95 — "we have decided not to move forward"', () => {
    const out = classifyByRules({
      subject: 'Update on your application',
      bodyExcerpt:
        'Thank you for taking the time to interview with us. We have decided not to move forward with your candidacy at this time.',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.95)
    expect(out.classifiedBy).toBe('rules')
  })

  it('Test 3: rejection 0.95 — "we regret to inform...other candidates" (subject side)', () => {
    const out = classifyByRules({
      subject: 'We regret to inform you we will be moving forward with other candidates',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 4: interview_invite 0.95 — "would you like to schedule a call"', () => {
    const out = classifyByRules({
      subject: 'Re: Senior Engineer role',
      bodyExcerpt:
        'Great chatting earlier. Would you like to schedule a 30-minute intro call this week?',
    })
    expect(out.label).toBe('interview_invite')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 5: interview_invite 0.95 — "next step is a call"', () => {
    const out = classifyByRules({
      subject: 'Next steps for the Backend role',
      bodyExcerpt:
        'Pleased to share the next step is a 45 minute interview with our hiring manager.',
    })
    expect(out.label).toBe('interview_invite')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 6: recruiter_outreach 0.95 — "saw your profile and wanted to reach out about a role"', () => {
    const out = classifyByRules({
      subject: 'Quick question',
      bodyExcerpt:
        'Hi Duy — saw your profile on LinkedIn and wanted to reach out about a role we are hiring for.',
    })
    expect(out.label).toBe('recruiter_outreach')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 7: recruiter_outreach 0.95 — "came across your resume"', () => {
    const out = classifyByRules({
      subject: 'Opportunity at Acme',
      bodyExcerpt: 'Hello — I came across your resume and thought you might be a great fit.',
    })
    expect(out.label).toBe('recruiter_outreach')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 8: noise 0.95 — "unsubscribe" link', () => {
    const out = classifyByRules({
      subject: 'Weekly newsletter — May 2026',
      bodyExcerpt:
        'Here are the top stories this week. To unsubscribe, click here. View in browser.',
    })
    expect(out.label).toBe('noise')
    expect(out.confidence).toBe(0.95)
  })
})

describe('classifyByRules — 0.80-tier matches per label', () => {
  it('Test 9: rejection 0.80 — "thank you for your interest" (subject)', () => {
    const out = classifyByRules({
      subject: 'Thank you for your interest in Acme',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.8)
  })

  it('Test 10: rejection 0.80 — "after careful consideration" (body)', () => {
    const out = classifyByRules({
      subject: 'Hiring update',
      bodyExcerpt:
        'After careful consideration, we have chosen to proceed with another applicant.',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.8)
  })

  it('Test 11: interview_invite 0.80 — "calendar invite"', () => {
    const out = classifyByRules({
      subject: 'Calendar invite for our chat',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('interview_invite')
    expect(out.confidence).toBe(0.8)
  })

  it('Test 12: interview_invite 0.80 — "book a time"', () => {
    const out = classifyByRules({
      subject: 'Phone screen — please book a time',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('interview_invite')
    expect(out.confidence).toBe(0.8)
  })

  it('Test 13: recruiter_outreach 0.80 — "opening at TechCo"', () => {
    const out = classifyByRules({
      subject: 'Senior engineering opening at TechCo',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('recruiter_outreach')
    expect(out.confidence).toBe(0.8)
  })

  it('Test 14: recruiter_outreach 0.80 — "position with Acme"', () => {
    const out = classifyByRules({
      subject: 'Re: developer position with Acme Inc.',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('recruiter_outreach')
    expect(out.confidence).toBe(0.8)
  })
})

describe('classifyByRules — body-side matching (subject empty)', () => {
  it('Test 15: rejection 0.95 body match when subject is empty string', () => {
    const out = classifyByRules({
      subject: '',
      bodyExcerpt:
        'Hi, we have decided not to move forward at this time. Best of luck with your search.',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 16: interview_invite 0.95 body match', () => {
    const out = classifyByRules({
      subject: '',
      bodyExcerpt: 'Could you propose times for a 30 minute call next week?',
    })
    expect(out.label).toBe('interview_invite')
  })

  it('Test 17: recruiter_outreach 0.95 body match', () => {
    const out = classifyByRules({
      subject: '',
      bodyExcerpt:
        'Hi Duy — saw your background in fintech and wanted to reach out about a role at our startup.',
    })
    expect(out.label).toBe('recruiter_outreach')
  })

  it('Test 18: noise 0.95 body match — "manage your subscriptions"', () => {
    const out = classifyByRules({
      subject: '',
      bodyExcerpt: 'You received this email because you subscribed. Manage your subscriptions here.',
    })
    expect(out.label).toBe('noise')
  })

  it('Test 19: rejection 0.80 body match', () => {
    const out = classifyByRules({
      subject: '',
      bodyExcerpt: 'Thank you for your interest in joining our team.',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.8)
  })
})

describe('classifyByRules — priority tiebreaks', () => {
  it('Test 20: rejection beats interview_invite when both match', () => {
    const out = classifyByRules({
      subject: 'Calendar invite for our next step',
      bodyExcerpt:
        'Apologies — sent the previous email by mistake. We have decided not to move forward with other candidates.',
    })
    expect(out.label).toBe('rejection')
  })

  it('Test 21: rejection beats noise when both match (priority order)', () => {
    const out = classifyByRules({
      subject: 'We regret to inform you we are moving forward with other candidates',
      bodyExcerpt: 'To unsubscribe from these messages, click here.',
    })
    expect(out.label).toBe('rejection')
  })

  it('Test 22: interview_invite beats recruiter_outreach when both match', () => {
    const out = classifyByRules({
      subject: 'Quick question',
      bodyExcerpt:
        'I came across your resume — would you like to schedule a 30 minute call to discuss?',
    })
    expect(out.label).toBe('interview_invite')
  })

  it('Test 23: recruiter_outreach beats noise when both match', () => {
    const out = classifyByRules({
      subject: 'Saw your profile — opportunity at our company',
      bodyExcerpt: 'PS: to unsubscribe from future outreach, reply STOP.',
    })
    expect(out.label).toBe('recruiter_outreach')
  })
})

describe('classifyByRules — unmatched + edge cases', () => {
  it('Test 24: empty subject + empty body returns unmatched with confidence 0', () => {
    const out = classifyByRules({ subject: '', bodyExcerpt: '' })
    expect(out.label).toBe('unmatched')
    expect(out.confidence).toBe(0)
    expect(out.classifiedBy).toBe('rules')
  })

  it('Test 25: arbitrary text with no rule match returns unmatched + confidence 0', () => {
    const out = classifyByRules({
      subject: 'Server maintenance complete',
      bodyExcerpt:
        'Our scheduled maintenance window has ended. All systems are operating normally.',
    })
    expect(out.label).toBe('unmatched')
    expect(out.confidence).toBe(0)
    expect(out.classifiedBy).toBe('rules')
  })

  it('Test 26: case-insensitivity — UPPERCASE rejection still matches', () => {
    const out = classifyByRules({
      subject: 'WE REGRET TO INFORM YOU WE WILL BE MOVING FORWARD WITH OTHER CANDIDATES',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.95)
  })
})

describe('classifyByRules — match metadata', () => {
  it('Test 27: matchedRuleIndex is a valid index into CLASSIFICATION_RULES on a hit', () => {
    const out = classifyByRules({
      subject: 'Thank you for your interest in our company',
      bodyExcerpt: '',
    })
    expect(out.label).toBe('rejection')
    expect(out.matchedRuleIndex).toBeDefined()
    expect(out.matchedRuleIndex).toBeGreaterThanOrEqual(0)
    expect(out.matchedRuleIndex!).toBeLessThan(CLASSIFICATION_RULES.length)
    expect(CLASSIFICATION_RULES[out.matchedRuleIndex!]?.label).toBe('rejection')
  })

  it('Test 28: matchedRuleIndex is undefined on unmatched', () => {
    const out = classifyByRules({ subject: '', bodyExcerpt: '' })
    expect(out.label).toBe('unmatched')
    expect(out.matchedRuleIndex).toBeUndefined()
  })
})

describe('classifyByRules — negatives (should NOT fire)', () => {
  it('Test 29: noise pattern does not fire on a real interview_invite', () => {
    const out = classifyByRules({
      subject: 'Would you like to schedule a chat?',
      bodyExcerpt: 'Looking forward to hearing from you.',
    })
    // Must classify as interview_invite, not noise (no unsubscribe text present).
    expect(out.label).toBe('interview_invite')
  })

  it('Test 30: rejection pattern does not fire on a generic update email', () => {
    const out = classifyByRules({
      subject: 'Application status update',
      bodyExcerpt:
        'Your application is currently being reviewed by the hiring team. We will update you soon.',
    })
    // No rejection-tier phrase present — should NOT fire as rejection.
    expect(out.label).not.toBe('rejection')
  })

  it('Test 31: recruiter_outreach 0.95 fires on the canonical "came across your profile" phrasing', () => {
    const out = classifyByRules({
      subject: 'Quick intro',
      bodyExcerpt:
        'Hi — I came across your profile and wanted to reach out about a role we are hiring for.',
    })
    expect(out.label).toBe('recruiter_outreach')
    expect(out.confidence).toBe(0.95)
  })

  it('Test 32: rejection 0.95 fires on "regret to inform" phrasing variant', () => {
    const out = classifyByRules({
      subject: 'Regarding your application',
      bodyExcerpt:
        'We regret to inform you that we will not be moving forward with your application.',
    })
    expect(out.label).toBe('rejection')
    expect(out.confidence).toBe(0.95)
  })
})
