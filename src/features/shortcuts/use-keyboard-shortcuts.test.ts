// @vitest-environment jsdom
import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeyboardShortcuts } from './use-keyboard-shortcuts'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  push.mockClear()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useKeyboardShortcuts', () => {
  it('navigates to /applications/new on "n" key', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'n' })
    expect(push).toHaveBeenCalledWith('/applications/new')
  })

  it('navigates to /applications on "g" then "a" combo', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'a' })
    expect(push).toHaveBeenCalledWith('/applications')
  })

  it('navigates to /inbox on "g" then "i" combo', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'i' })
    expect(push).toHaveBeenCalledWith('/inbox')
  })

  it('navigates to /settings on "g" then "s" combo', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 's' })
    expect(push).toHaveBeenCalledWith('/settings')
  })

  it('times out g-prefix combo after 1 second', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'g' })
    vi.advanceTimersByTime(1100)
    fireEvent.keyDown(window, { key: 'a' })
    expect(push).not.toHaveBeenCalled()
  })

  it('does not fire shortcuts when focused in an input', () => {
    renderHook(() => useKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: 'n' })
    expect(push).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('does not fire shortcuts when focused in a textarea', () => {
    renderHook(() => useKeyboardShortcuts())
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    fireEvent.keyDown(textarea, { key: 'n' })
    expect(push).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
  })

  it('does not fire shortcuts with modifier keys', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'n', metaKey: true })
    expect(push).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(push).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'n', altKey: true })
    expect(push).not.toHaveBeenCalled()
  })

  it('does not navigate on unrecognized key after "g"', () => {
    renderHook(() => useKeyboardShortcuts())
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'z' })
    expect(push).not.toHaveBeenCalled()
  })

  it('cleans up event listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useKeyboardShortcuts())
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
