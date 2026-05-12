// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApplicationListItem } from '../queries'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      forays: {
        boardEmpty: 'No forays in this column.',
      },
      status: {
        applied: 'Applied',
        screening: 'Screening',
        interviewing: 'Interviewing',
        offer: 'Offer',
        rejected: 'Rejected',
        withdrawn: 'Withdrawn',
      },
      today: {
        staleBadge: '{days}d quiet',
      },
    }

    return (key: string, values?: Record<string, string | number>) => {
      const message = messages[namespace]?.[key] ?? key
      if (!values) return message

      return Object.entries(values).reduce(
        (out, [name, value]) => out.replace(`{${name}}`, String(value)),
        message,
      )
    }
  },
}))

afterEach(() => {
  cleanup()
})

describe('ApplicationBoard', () => {
  it('renders a rejected column with rejected forays', async () => {
    const { ApplicationBoard } = await import('./application-board')
    const rejected: ApplicationListItem = {
      id: 42,
      companyId: 7,
      companyName: 'Acme',
      roleTitle: 'Product Lead',
      canonicalStatus: 'rejected',
      currentStage: 'Rejected',
      lastActivityAt: new Date('2026-05-10T00:00:00.000Z'),
      daysQuiet: 2,
      appliedAt: new Date('2026-05-01T00:00:00.000Z'),
      archivedAt: null,
    }

    render(<ApplicationBoard items={[rejected]} />)

    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0)
    expect(screen.getByText('Product Lead')).toBeTruthy()
  })
})
