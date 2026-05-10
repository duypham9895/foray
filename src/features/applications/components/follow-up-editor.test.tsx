// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the actions module — each action is a no-op that returns initialOk.
vi.mock('../actions', () => ({
  setFollowUpAction: vi.fn(async () => ({
    ok: true,
  })),
  clearFollowUpAction: vi.fn(async () => ({
    ok: true,
  })),
}))

import { FollowUpEditor } from './follow-up-editor'
import { setFollowUpAction, clearFollowUpAction } from '../actions'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FollowUpEditor', () => {
  const appId = 42

  it('renders "No follow-up set" with "Set follow-up" button when no followUpAt', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    expect(screen.getByText('No follow-up set')).toBeTruthy()
    expect(screen.getByRole('button', { name: /set follow-up$/i })).toBeTruthy()
  })

  it('renders formatted date with "Edit" and "Clear" buttons when followUpAt is set', () => {
    const date = new Date('2026-05-15T00:00:00Z')
    render(<FollowUpEditor applicationId={appId} followUpAt={date} />)

    expect(screen.getByText(/Follow-up:/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /clear follow-up date/i })).toBeTruthy()
  })

  it('transitions to editing state with quick-set buttons and date input when "Set follow-up" clicked', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: /set follow-up$/i }))

    // Quick-set buttons have aria-labels like "Set follow-up to May 11, 2026"
    const quickSetBtns = screen.getAllByRole('button', { name: /set follow-up to/i })
    expect(quickSetBtns).toHaveLength(3)
    expect(screen.getByLabelText(/pick a date/i)).toBeTruthy()
  })

  it('transitions to editing state when "Edit" clicked', () => {
    const date = new Date('2026-05-15T00:00:00Z')
    render(<FollowUpEditor applicationId={appId} followUpAt={date} />)

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))

    const quickSetBtns = screen.getAllByRole('button', { name: /set follow-up to/i })
    expect(quickSetBtns).toHaveLength(3)
  })

  it('clicking "Tomorrow" quick-set button saves with tomorrow date', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: /set follow-up$/i }))

    // First quick-set button is Tomorrow
    const quickSetBtns = screen.getAllByRole('button', { name: /set follow-up to/i })
    expect(quickSetBtns[0]).toBeDefined()
    fireEvent.click(quickSetBtns[0]!)

    expect(setFollowUpAction).toHaveBeenCalled()
  })

  it('clicking "Next week" quick-set button saves with 7-day date', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: /set follow-up$/i }))

    const quickSetBtns = screen.getAllByRole('button', { name: /set follow-up to/i })
    expect(quickSetBtns[1]).toBeDefined()
    fireEvent.click(quickSetBtns[1]!)

    expect(setFollowUpAction).toHaveBeenCalled()
  })

  it('clicking "Next month" quick-set button saves with 30-day date', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: /set follow-up$/i }))

    const quickSetBtns = screen.getAllByRole('button', { name: /set follow-up to/i })
    expect(quickSetBtns[2]).toBeDefined()
    fireEvent.click(quickSetBtns[2]!)

    expect(setFollowUpAction).toHaveBeenCalled()
  })

  it('clicking "Clear" removes the follow-up date', () => {
    const date = new Date('2026-05-15T00:00:00Z')
    render(<FollowUpEditor applicationId={appId} followUpAt={date} />)

    fireEvent.click(screen.getByRole('button', { name: /clear follow-up date/i }))

    expect(clearFollowUpAction).toHaveBeenCalled()
  })

  it('clicking "Cancel" returns to display state without saving', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: /set follow-up$/i }))
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    // Back to display state
    expect(screen.getByText('No follow-up set')).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: /set follow-up to/i })).toHaveLength(0)
  })

  it('quick-set buttons have aria-label with computed date', () => {
    render(<FollowUpEditor applicationId={appId} followUpAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: /set follow-up$/i }))

    const quickSetBtns = screen.getAllByRole('button', { name: /set follow-up to/i })
    for (const btn of quickSetBtns) {
      const ariaLabel = btn.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel).toMatch(/set follow-up to \w+ \d+, \d{4}/i)
    }
  })
})
