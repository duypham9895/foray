// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TagCloud } from './tag-cloud'

afterEach(() => {
  cleanup()
})

describe('TagCloud', () => {
  it('preserves list view when selecting a tag filter', () => {
    render(
      <TagCloud
        tags={[{ tag: 'gmail-import', count: 8 }]}
        currentParams={new URLSearchParams('view=list&status=applied')}
      />,
    )

    const link = screen.getByText('gmail-import').closest('a')
    expect(link?.getAttribute('href')).toBe('/applications?view=list&status=applied&tag=gmail-import')
  })

  it('preserves list view when clearing the active tag filter', () => {
    render(
      <TagCloud
        tags={[{ tag: 'gmail-import', count: 8 }]}
        activeTag="gmail-import"
        currentParams={new URLSearchParams('view=list&tag=gmail-import&status=applied')}
      />,
    )

    const link = screen.getByText('gmail-import').closest('a')
    expect(link?.getAttribute('href')).toBe('/applications?view=list&status=applied')
  })
})
