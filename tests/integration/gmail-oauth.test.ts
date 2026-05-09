// Integration tests for Gmail OAuth token encrypt/decrypt round-trip.
//
// Covers GMAIL-01 requirement: refresh token encrypted at rest.
// Pure crypto tests — no DB, no mocks. Validates:
//   - Round-trip: encryptToken -> decryptToken recovers original plaintext
//   - Tamper detection: modified ciphertext rejected
//   - Malformed blob: invalid format rejected
//   - Unique IV: same plaintext produces different ciphertext each time

import { describe, it, expect } from 'vitest'

import { encryptToken, decryptToken } from '@/core/crypto/encryption'

describe('Gmail OAuth token handling', () => {
  it('encryptToken -> decryptToken round-trips correctly', () => {
    const plaintext = '1//0abcdefghijklmnopqrstuvwxyz123456789'
    const encrypted = encryptToken(plaintext)

    // Encrypted format: iv.tag.ciphertext (base64, dot-separated)
    const parts = encrypted.split('.')
    expect(parts).toHaveLength(3)

    const result = decryptToken(encrypted)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe(plaintext)
    }
  })

  it('decryptToken fails on tampered ciphertext', () => {
    const encrypted = encryptToken('test-token')
    const parts = encrypted.split('.')
    // Tamper with the ciphertext
    parts[2] = Buffer.from('tampered').toString('base64')
    const tampered = parts.join('.')

    const result = decryptToken(tampered)
    expect(result.isErr()).toBe(true)
  })

  it('decryptToken fails on malformed blob', () => {
    const result = decryptToken('not-a-valid-blob')
    expect(result.isErr()).toBe(true)
  })

  it('encryptToken produces different output each time (unique IV)', () => {
    const token = 'same-token-value'
    const enc1 = encryptToken(token)
    const enc2 = encryptToken(token)
    expect(enc1).not.toBe(enc2) // different IVs
  })
})
