import { describe, expect, it } from 'vitest'

import { getPublicOrigin } from './public-origin'

describe('getPublicOrigin', () => {
  it('uses forwarded proto and host instead of the container bind origin', () => {
    const request = new Request('https://0.0.0.0:3000/api/gmail/callback', {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'duyopenclaw.tech',
      },
    })

    expect(getPublicOrigin(request)).toBe('https://duyopenclaw.tech')
  })

  it('uses the first forwarded value when a proxy sends a chain', () => {
    const request = new Request('http://0.0.0.0:3000/api/gmail/callback', {
      headers: {
        'x-forwarded-proto': 'https, http',
        'x-forwarded-host': 'duyopenclaw.tech, 0.0.0.0:3000',
      },
    })

    expect(getPublicOrigin(request)).toBe('https://duyopenclaw.tech')
  })

  it('falls back to the request URL origin without forwarded headers', () => {
    const request = new Request('http://localhost:3000/api/gmail/callback')

    expect(getPublicOrigin(request)).toBe('http://localhost:3000')
  })
})
