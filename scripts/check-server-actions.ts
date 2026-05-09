#!/usr/bin/env npx tsx
/**
 * Structural CI check: every Server Action in src/features/ returns
 * Result<T, AppError>, ActionState, or uses ok()/err()/{ ok: ... } returns.
 *
 * Run: node scripts/check-server-actions.ts
 * Exit 0 = all checks pass, Exit 1 = at least one failure.
 *
 * This is NOT an ESLint rule (too complex for existing setup). It's a
 * standalone check that runs in CI via `node scripts/check-server-actions.ts`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// --- Config ---

const FEATURES_DIR = path.resolve(__dirname, '..', 'src', 'features')

// Return type patterns that indicate a safe return type.
const SAFE_RETURN_TYPE_PATTERNS = [
  /Result\b/,
  /ActionState\b/,
  /LoginState\b/,
  /\{\s*ok\s*:/, // inline { ok: boolean; ... } return type (with or without Promise<...>)
]

// Function body patterns that indicate safe return semantics.
const SAFE_BODY_PATTERNS = [
  /return \{ ok:/,
  /return ok\(/,
  /return err\(/,
  /return initialOk/,
  /return authError\(/,
  /redirect\(/, // redirect() throws; control never returns to caller
]

// --- Helpers ---

function findActionsFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findActionsFiles(fullPath))
    } else if (entry.name === 'actions.ts') {
      results.push(fullPath)
    }
  }
  return results
}

type CheckResult = {
  file: string
  function: string
  passed: boolean
  reason: string
}

function checkFile(filePath: string): CheckResult[] {
  const content = readFileSync(filePath, 'utf8')
  const results: CheckResult[] = []
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath)

  // Find each 'export async function' and manually parse parameters + return type
  // by tracking bracket depth. This handles multiline signatures and nested
  // generics like Promise<{ ok: boolean; error?: string }>.
  const fnStart = /export\s+async\s+function\s+(\w+)/g
  let startMatch: RegExpExecArray | null

  while ((startMatch = fnStart.exec(content)) !== null) {
    const fnName = startMatch[1]!
    let pos = startMatch.index + startMatch[0].length

    // Step 1: Skip to matching ')' for parameters
    pos = content.indexOf('(', pos)
    if (pos === -1) continue
    let depth = 1
    pos++
    while (pos < content.length && depth > 0) {
      if (content[pos] === '(') depth++
      else if (content[pos] === ')') depth--
      pos++
    }
    // pos is now right after the closing ')'

    // Step 2: Find ':' indicating return type
    const colonIdx = content.indexOf(':', pos)
    if (colonIdx === -1 || colonIdx > pos + 5) continue // safety: colon must be close
    pos = colonIdx + 1

    // Step 3: Scan forward, tracking <> depth, until we hit '{' at <> depth 0
    // That '{' is the function body opener.
    let angleDepth = 0
    let returnTypeStart = pos
    while (pos < content.length) {
      const ch = content[pos]
      if (ch === '<') angleDepth++
      else if (ch === '>') angleDepth--
      else if (ch === '{' && angleDepth === 0) break
      pos++
    }
    const returnType = content.slice(returnTypeStart, pos).trim()
    const bodyStart = pos + 1 // skip the '{'

    const hasSafeReturnType = SAFE_RETURN_TYPE_PATTERNS.some((p) => p.test(returnType))

    if (hasSafeReturnType) {
      results.push({
        file: relPath,
        function: fnName,
        passed: true,
        reason: `return type contains safe pattern: ${returnType}`,
      })
    } else {
      // Fallback: check function body for safe return patterns
      let braceDepth = 1
      let bodyEnd = bodyStart
      while (bodyEnd < content.length && braceDepth > 0) {
        if (content[bodyEnd] === '{') braceDepth++
        else if (content[bodyEnd] === '}') braceDepth--
        bodyEnd++
      }
      const body = content.slice(bodyStart, bodyEnd)

      const hasSafeBodyPattern = SAFE_BODY_PATTERNS.some((p) => p.test(body))

      if (hasSafeBodyPattern) {
        results.push({
          file: relPath,
          function: fnName,
          passed: true,
          reason: `return type "${returnType}" but body uses safe return pattern`,
        })
      } else {
        results.push({
          file: relPath,
          function: fnName,
          passed: false,
          reason: `return type "${returnType}" — no Result/ActionState type and no ok()/err() body pattern found`,
        })
      }
    }
  }

  return results
}

// --- Main ---

const actionFiles = findActionsFiles(FEATURES_DIR)

if (actionFiles.length === 0) {
  console.error('FAIL: No actions.ts files found under src/features/')
  process.exit(1)
}

console.log(`Found ${actionFiles.length} actions.ts file(s):\n`)

const allResults: CheckResult[] = []
for (const file of actionFiles) {
  allResults.push(...checkFile(file))
}

let hasFailure = false
for (const r of allResults) {
  const icon = r.passed ? 'PASS' : 'FAIL'
  console.log(`  [${icon}] ${r.file}::${r.function}`)
  console.log(`         ${r.reason}`)
  if (!r.passed) hasFailure = true
}

console.log('')
if (hasFailure) {
  console.error('FAIL: One or more Server Actions do not return Result or ActionState.')
  process.exit(1)
} else {
  console.log(`PASS: All ${allResults.length} Server Action(s) return Result, ActionState, or use ok()/err() patterns.`)
  process.exit(0)
}
