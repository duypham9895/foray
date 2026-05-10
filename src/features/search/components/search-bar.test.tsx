// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SearchBar } from './search-bar'

// Mock next/navigation useRouter
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  push.mockClear()
})

describe('SearchBar', () => {
  it('renders search input with placeholder', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText('Search... (press "/" to focus)')).toBeTruthy()
  })

  it('focuses search input on / keypress when not in text field', () => {
    render(<SearchBar />)
    const input = screen.getByRole('textbox')

    // Blur to ensure input is not focused
    input.blur()
    expect(document.activeElement).not.toBe(input)

    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(input)
  })

  it('does not focus search input on / keypress when already in text input', () => {
    render(
      <div>
        <input data-testid="other-input" />
        <SearchBar />
      </div>,
    )

    const otherInput = screen.getByTestId('other-input')
    otherInput.focus()
    expect(document.activeElement).toBe(otherInput)

    // Dispatch on the focused element (not window) so e.target is the input
    fireEvent.keyDown(otherInput, { key: '/' })
    // Focus should stay on the other input
    expect(document.activeElement).toBe(otherInput)
  })

  it('navigates to /search?q=... on form submit', () => {
    render(<SearchBar />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'react engineer' } })
    fireEvent.submit(input.closest('form')!)

    expect(push).toHaveBeenCalledWith('/search?q=react%20engineer')
  })

  it('does not navigate on empty submit', () => {
    render(<SearchBar />)
    const input = screen.getByRole('textbox')

    fireEvent.submit(input.closest('form')!)

    expect(push).not.toHaveBeenCalled()
  })

  it('shows keyboard hint badge', () => {
    render(<SearchBar />)
    expect(screen.getByText('/')).toBeTruthy()
  })
})
