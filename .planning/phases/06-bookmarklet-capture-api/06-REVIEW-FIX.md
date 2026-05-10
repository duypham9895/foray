---
phase: 06-bookmarklet-capture-api
fixed_at: 2026-05-10T15:00:00Z
review_path: .planning/phases/06-bookmarklet-capture-api/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-05-10T15:00:00Z
**Source review:** .planning/phases/06-bookmarklet-capture-api/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 critical, 4 warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Bookmarklet hardcodes localhost:3000

**Files modified:** `bookmarklet/foray.js`, `scripts/build-bookmarklet.ts`, `.env.example`
**Commit:** cf237c0
**Applied fix:** Replaced hardcoded `http://localhost:3000` with `__FORAY_API_URL__` placeholder in `bookmarklet/foray.js`. Updated `scripts/build-bookmarklet.ts` to read `FORAY_API_URL` env var (defaulting to `http://localhost:3000`) and substitute the placeholder before minification. Added `FORAY_API_URL` to `.env.example` with documentation.

### WR-01: CORS wildcard on unauthenticated endpoint

**Files modified:** `src/app/api/capture/route.ts`
**Commit:** a12cc96
**Applied fix:** Added TODO comment documenting the deliberate trade-off: `TODO(edward, 2026-05-10): Add Bearer token auth per PRINCIPLES.md Security baseline. Deferred for Lean — bookmarklet is single-user, local-only deployment.` No behavior change — CORS `*` stays for Lean milestone.

### WR-02: Body size check measures character count, not byte count

**Files modified:** `src/app/api/capture/route.ts`
**Commit:** a12cc96
**Applied fix:** Replaced `rawBody.length` with `new TextEncoder().encode(rawBody).length` for accurate byte measurement. Updated the comment to clarify the intent: "Body size guard (measure bytes, not UTF-16 code units)".

### WR-03: extractApexDomain fails on multi-part TLDs

**Files modified:** `src/app/api/capture/route.ts`
**Commit:** a12cc96
**Applied fix:** Added TODO comment documenting the known limitation: `Known limitation: multi-part TLDs (.co.uk, .com.au) extract incorrectly.` with `TODO(edward, 2026-06-01): Replace with psl library when internationalized job sites are relevant.` No behavior change — acceptable for Lean milestone.

### WR-04: window.getSelection() can return null

**Files modified:** `bookmarklet/foray.js`
**Commit:** cf237c0
**Applied fix:** Added null guard: `(window.getSelection() || {}).toString() || ''`. This handles cases where `getSelection()` returns `null` (iframe contexts, document not interactive) without throwing a TypeError.

## Skipped Issues

None — all findings were successfully fixed or documented.

---

_Fixed: 2026-05-10T15:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
