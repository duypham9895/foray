// AES-256-GCM encryption helper tests.
// Sets a deterministic ENCRYPTION_KEY fixture before importing the module
// to avoid depending on .env.local at test time.

// Env fixtures are set globally in vitest.setup.ts (runs before module load).

import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from './encryption'

describe('encryption helpers', () => {
  it('Test 1: round-trip ASCII — decryptToken(encryptToken(s)) === s', () => {
    const plaintext = 'hello world'
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext)
  })

  it('Test 2: round-trip UTF-8 with unicode and emoji', () => {
    const plaintext = 'café 日本語 🚀'
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext)
  })

  it('Test 3: two encryptToken calls produce different blobs (per-call random IV)', () => {
    const plaintext = 'same input'
    const blob1 = encryptToken(plaintext)
    const blob2 = encryptToken(plaintext)
    expect(blob1).not.toBe(blob2)
  })

  it('Test 4: tampering — flipping a base64 char in ciphertext throws on decrypt', () => {
    const blob = encryptToken('sensitive data')
    // blob format: iv.tag.ciphertext — tamper the ciphertext segment
    const parts = blob.split('.')
    expect(parts).toHaveLength(3)
    // Flip the last char of the ciphertext base64 string
    const ct = parts[2]!
    const lastChar = ct[ct.length - 1]!
    const flipped = lastChar === 'A' ? 'B' : 'A'
    parts[2] = ct.slice(0, -1) + flipped
    const tampered = parts.join('.')
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('Test 5: decryptToken with invalid format throws "Malformed encrypted blob"', () => {
    expect(() => decryptToken('not.valid.format.too.many.dots')).toThrow('Malformed encrypted blob')
  })
})
