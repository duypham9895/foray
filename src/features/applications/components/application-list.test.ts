// Unit tests for the toggleStatusInUrl helper. Pure-function tests; no Postgres.
//
// The helper drives the multi-select chip toggle in the applications list per
// CONTEXT §"Area 2" (URL-driven state, locked invariant).

import { describe, expect, it } from 'vitest'

import { toggleStatusInUrl } from './application-list'

describe('toggleStatusInUrl', () => {
  it('adds a new status when current list does not contain it', () => {
    const out = toggleStatusInUrl(new URLSearchParams('status=applied'), 'screening')
    // URLSearchParams encodes the comma; assert via decoded form for clarity.
    expect(decodeURIComponent(out)).toBe('?status=applied,screening')
  })

  it('removes a status that is currently in the list', () => {
    const out = toggleStatusInUrl(
      new URLSearchParams('status=applied,screening'),
      'screening',
    )
    expect(decodeURIComponent(out)).toBe('?status=applied')
  })

  it('returns empty string when removing the last status (default filter applies)', () => {
    const out = toggleStatusInUrl(new URLSearchParams('status=screening'), 'screening')
    expect(out).toBe('')
  })

  it('adds to an empty list when no status param is set', () => {
    const out = toggleStatusInUrl(new URLSearchParams(''), 'rejected')
    expect(decodeURIComponent(out)).toBe('?status=rejected')
  })

  it('preserves the sort param when toggling status', () => {
    const out = toggleStatusInUrl(
      new URLSearchParams('status=applied&sort=appliedAt:desc'),
      'screening',
    )
    expect(decodeURIComponent(out)).toBe('?status=applied,screening&sort=appliedAt:desc')
  })

  it('preserves the sort param when removing the last status', () => {
    const out = toggleStatusInUrl(
      new URLSearchParams('status=screening&sort=appliedAt:desc'),
      'screening',
    )
    // status=screening removed → no status param; sort preserved.
    expect(decodeURIComponent(out)).toBe('?sort=appliedAt:desc')
  })

  it('preserves list view and tag filters when toggling status', () => {
    const out = toggleStatusInUrl(
      new URLSearchParams('view=list&tag=gmail-import&status=applied'),
      'rejected',
    )

    expect(decodeURIComponent(out)).toBe('?view=list&tag=gmail-import&status=applied,rejected')
  })

  it('preserves list view when removing the last explicit status', () => {
    const out = toggleStatusInUrl(
      new URLSearchParams('view=list&status=screening'),
      'screening',
    )

    expect(out).toBe('?view=list')
  })
})
