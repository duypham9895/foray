// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CountBadge } from './count-badge'
import { TodaySection } from './today-section'

afterEach(() => {
  cleanup()
})

describe('TodaySection', () => {
  it('renders title and children when not empty', () => {
    render(
      <TodaySection
        title="Interviews"
        icon={<span data-testid="icon">icon</span>}
        isEmpty={false}
        emptyMessage="No interviews today"
      >
        <div>Interview data</div>
      </TodaySection>,
    )

    expect(screen.getByText('Interviews')).toBeTruthy()
    expect(screen.getByText('Interview data')).toBeTruthy()
    expect(screen.queryByText('No interviews today')).toBeNull()
  })

  it('renders empty message when isEmpty is true', () => {
    render(
      <TodaySection
        title="Interviews"
        icon={<span data-testid="icon">icon</span>}
        isEmpty={true}
        emptyMessage="No interviews today"
      >
        <div>Interview data</div>
      </TodaySection>,
    )

    expect(screen.getByText('No interviews today')).toBeTruthy()
    expect(screen.queryByText('Interview data')).toBeNull()
  })

  it('renders the icon', () => {
    render(
      <TodaySection
        title="Test"
        icon={<span data-testid="icon">calendar</span>}
        isEmpty={false}
        emptyMessage="Empty"
      >
        <div>Content</div>
      </TodaySection>,
    )

    expect(screen.getByTestId('icon')).toBeTruthy()
  })
})

describe('CountBadge', () => {
  it('renders label and count', () => {
    render(<CountBadge label="Interviews" count={5} />)

    expect(screen.getByText('Interviews')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('renders positive delta', () => {
    render(<CountBadge label="Interviews" count={5} delta={2} />)

    expect(screen.getByText('+2 vs last week')).toBeTruthy()
  })

  it('renders zero delta without plus sign', () => {
    render(<CountBadge label="Interviews" count={5} delta={0} />)

    expect(screen.getByText('0 vs last week')).toBeTruthy()
  })

  it('renders negative delta', () => {
    render(<CountBadge label="Rejections" count={1} delta={-1} />)

    expect(screen.getByText('-1 vs last week')).toBeTruthy()
  })

  it('omits delta section when delta is undefined', () => {
    const { container } = render(<CountBadge label="Offers" count={2} />)

    expect(container.textContent).not.toContain('vs last week')
  })

  it('renders as anchor when href is provided', () => {
    render(<CountBadge label="Inbox" count={3} href="/inbox" />)

    const link = screen.getByText('Inbox').closest('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('/inbox')
  })

  it('renders as div when href is not provided', () => {
    const { container } = render(<CountBadge label="Inbox" count={3} />)

    const el = container.firstElementChild
    expect(el?.tagName).toBe('DIV')
  })
})
