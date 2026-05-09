// Tests for bookmarklet build output — validates the generated URL meets
// browser bookmarklet constraints (size, format).

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'

const ROOT = path.resolve(__dirname, '..', '..')
const SOURCE = path.join(ROOT, 'bookmarklet', 'foray.js')

let bookmarkletUrl: string
let decodedCode: string

beforeAll(async () => {
  const source = fs.readFileSync(SOURCE, 'utf-8')
  const result = await esbuild.transform(source, {
    minify: true,
    target: 'es2020',
    format: 'iife',
  })
  decodedCode = result.code
  bookmarkletUrl = `javascript:${encodeURIComponent(result.code)}`
})

describe('Bookmarklet build', () => {
  it('source file exists and is valid JS', () => {
    expect(fs.existsSync(SOURCE)).toBe(true)
    const source = fs.readFileSync(SOURCE, 'utf-8')
    expect(source).toContain('function')
  })

  it('produces a URL under 2000 chars', () => {
    expect(bookmarkletUrl.length).toBeLessThan(2000)
  })

  it('starts with javascript: prefix', () => {
    expect(bookmarkletUrl).toMatch(/^javascript:/)
  })

  it('contains the API endpoint reference in minified code', () => {
    expect(decodedCode).toContain('api/capture')
  })

  it('contains capturePageInfo logic in minified code', () => {
    expect(decodedCode).toContain('document.title')
  })
})
