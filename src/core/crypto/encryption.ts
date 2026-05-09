import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { ok, err, errors, type Result, type AppError } from '@/core/errors'
import { env } from '@/core/env'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12   // 96 bits — NIST SP 800-38D recommended for GCM
const TAG_BYTES = 16  // 128 bits — GCM standard

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex') // 32 bytes from 64-hex-char env

if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must decode to 32 bytes (64 hex chars)')
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns a single base64 string in the
 * format `iv.tag.ciphertext` (each component base64-encoded, dot-separated).
 *
 * IV is freshly generated per call. NEVER reuse an IV with the same key —
 * catastrophic for GCM (Pitfalls research §"Security mistakes — GCM IV reuse").
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
}

export function decryptToken(blob: string): Result<string, AppError> {
  const parts = blob.split('.')
  // Must be exactly 3 parts (iv.tag.ciphertext)
  const [ivB64, tagB64, ctB64] = parts
  if (parts.length !== 3 || !ivB64 || !tagB64 || !ctB64) {
    return err(errors.validation([{ code: 'custom', message: 'Malformed encrypted blob', path: [] }]))
  }
  try {
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return ok(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'))
  } catch {
    return err(errors.validation([{ code: 'custom', message: 'Decryption failed (tampered or corrupt)', path: [] }]))
  }
}

// Suppress unused import warning — TAG_BYTES is a documented constant for
// readers; GCM always produces a 16-byte tag regardless of this value.
void TAG_BYTES
