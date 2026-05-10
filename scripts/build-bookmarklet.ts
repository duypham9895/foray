// Build script: minify bookmarklet/foray.js -> URL-encoded javascript:... link.
// Output: public/foray-bookmarklet-url.json (imported by settings page at build time).
//
// Usage: tsx scripts/build-bookmarklet.ts

import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SOURCE = path.join(ROOT, 'bookmarklet', 'foray.js')
const OUTPUT = path.join(ROOT, 'public', 'foray-bookmarklet-url.json')

async function build() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`)
    process.exit(1)
  }

  const API_BASE = process.env.FORAY_API_URL ?? 'http://localhost:3000'
  const source = fs.readFileSync(SOURCE, 'utf-8')
    .replace('__FORAY_API_URL__', API_BASE)

  const result = await esbuild.transform(source, {
    minify: true,
    target: 'es2020',
    format: 'iife',
  })

  const code = result.code
  const encoded = encodeURIComponent(code)
  const bookmarkletUrl = `javascript:${encoded}`

  if (bookmarkletUrl.length > 2000) {
    console.warn(
      `Warning: bookmarklet is ${bookmarkletUrl.length} chars (limit ~2000)`,
    )
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })

  fs.writeFileSync(OUTPUT, JSON.stringify({ url: bookmarkletUrl }), 'utf-8')

  console.log(`Bookmarklet built: ${OUTPUT}`)
  console.log(`  Source: ${SOURCE}`)
  console.log(`  Minified: ${code.length} chars`)
  console.log(`  URL: ${bookmarkletUrl.length} chars`)
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
