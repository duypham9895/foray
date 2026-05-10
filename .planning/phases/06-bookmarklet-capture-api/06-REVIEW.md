---
phase: 06-bookmarklet-capture-api
reviewed: 2026-05-10T14:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .gitignore
  - bookmarklet/foray.js
  - package.json
  - scripts/build-bookmarklet.ts
  - src/app/api/capture/route.ts
  - src/app/settings/page.tsx
  - src/features/applications/components/new-application-form.tsx
  - src/features/applications/schema.ts
  - tests/integration/bookmarklet-build.test.ts
  - tests/integration/capture.test.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-10T14:30:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The bookmarklet capture feature implements a `POST /api/capture` route handler that accepts `{title, url, selectedText}` from a bookmarklet running on third-party job sites, validates the input, rejects ATS domains, and returns a base64url-encoded prefill payload that redirects to the new-foray form. The code is well-structured and follows the project's vertical slice conventions.

The most significant finding is that the bookmarklet source has a hardcoded `http://localhost:3000/api/capture` URL, and the build script (`build-bookmarklet.ts`) does not substitute a production URL. This means the bookmarklet is non-functional outside local development. Additional findings cover the CORS wildcard on an unauthenticated endpoint (deviating from the PRINCIPLES.md security model), a body-size check that measures characters rather than bytes, and edge cases in domain extraction and null safety.

## Critical Issues

### CR-01: Bookmarklet hardcodes `localhost:3000` — broken in production

**File:** `bookmarklet/foray.js:15`
**Issue:** The API URL is `var API_URL = "http://localhost:3000/api/capture";`. The build script (`scripts/build-bookmarklet.ts`) minifies and URL-encodes the source but never substitutes this URL. The resulting bookmarklet only works in local dev. Deployed instances will silently fail (fetch to localhost on the user's machine, CORS error, then `alert()`).

**Fix:** Inject the production URL at build time. Accept it as an environment variable or derive it from the deployment URL.

```ts
// scripts/build-bookmarklet.ts — add after reading source
const API_BASE = process.env.FORAY_API_URL ?? 'http://localhost:3000'
const source = fs.readFileSync(SOURCE, 'utf-8')
  .replace('__FORAY_API_URL__', API_BASE)
```

```js
// bookmarklet/foray.js — use a placeholder
var API_URL = "__FORAY_API_URL__/api/capture";
```

Also add `FORAY_API_URL` to `.env.example` and document it in the build instructions.

## Warnings

### WR-01: CORS wildcard on unauthenticated endpoint deviates from security model

**File:** `src/app/api/capture/route.ts:20-24`
**Issue:** PRINCIPLES.md states: "Authenticate with `Authorization: Bearer <api-token>`, not cookies" for bookmarklet/extension endpoints. The current implementation uses `Access-Control-Allow-Origin: *` with zero authentication. Any website can POST to `/api/capture` and generate prefill URLs with arbitrary data. While the endpoint does not store data directly (the real mutation happens in the server action), the absence of auth means the endpoint is open to abuse (spam, crafted prefill URLs with misleading data).

**Fix:** For Lean milestone, document this as an intentional trade-off (no auth = simpler install). Before wider use, add API token auth per PRINCIPLES.md. At minimum, add a TODO with a date:

```ts
// TODO(edward, 2026-05-10): Add Bearer token auth per PRINCIPLES.md §Security baseline.
// Deferred for Lean — bookmarklet is single-user, local-only deployment.
```

### WR-02: Body size check measures character count, not byte count

**File:** `src/app/api/capture/route.ts:54`
**Issue:** `rawBody.length` returns the number of UTF-16 code units, not bytes. A body containing multi-byte characters (emoji, CJK) would pass the 4096 check while exceeding 4096 bytes. Conversely, characters outside the BMP (code points > 0xFFFF) count as 2 code units but 4 UTF-8 bytes, so the check is also overly strict in that direction.

**Fix:** Use `TextEncoder` for accurate byte measurement:

```ts
const bodyBytes = new TextEncoder().encode(rawBody)
if (bodyBytes.length > MAX_BODY_BYTES) {
  return jsonResponse({ error: 'Request body too large' }, 413)
}
```

### WR-03: `extractApexDomain` fails on multi-part TLDs

**File:** `src/app/api/capture/route.ts:35-39`
**Issue:** `parts.slice(-2).join('.')` assumes all TLDs are single-part. For `careers.example.co.uk`, this returns `co.uk` instead of `example.co.uk`. Other affected TLDs: `.com.au`, `.gov.sg`, `.org.za`, etc.

**Fix:** For Lean milestone this is acceptable (most job sites use `.com`). Document the limitation. For production, use a public suffix list or the `psl` npm package:

```ts
// Known limitation: multi-part TLDs (.co.uk, .com.au) extract incorrectly.
// TODO(edward, 2026-06-01): Replace with psl library when internationalized job sites are relevant.
```

### WR-04: `window.getSelection()` can return null

**File:** `bookmarklet/foray.js:9`
**Issue:** `window.getSelection()` returns `Selection | null`. In certain iframe contexts or if called before the document is fully interactive, it returns `null`, and `.toString()` would throw a `TypeError`. The error is caught by the outer `.catch()` and shows an alert, but the user experience is poor (alert says "bookmarklet failed" for a minor issue).

**Fix:** Add a null guard:

```js
selectedText: (window.getSelection() || {}).toString() || '',
```

## Info

### IN-01: `PrefillData` interface omits `location`

**File:** `src/features/applications/components/new-application-form.tsx:22-28`
**Issue:** The `PrefillData` interface has `companyName`, `companyDomain`, `roleTitle`, `roleUrl`, `notes` — but not `location`. The form has a `location` input field (line 179), and `createApplicationSchema` includes it. The bookmarklet doesn't capture location (it's not available from page context), but if the `prefilled` payload ever includes it, the form won't render it as a default value. Minor inconsistency.

**Fix:** Add `location?: string` to `PrefillData` and wire it as `defaultValue` on the location input.

### IN-02: `decodePrefill` silently returns empty object on any error

**File:** `src/features/applications/components/new-application-form.tsx:33-40`
**Issue:** The `catch` block returns `{}` for any error (malformed base64, invalid JSON, schema mismatch). This is a deliberate defensive choice — the form works fine without prefill — but means a corrupted `prefilled` param gives no feedback. Acceptable for Lean.

**Fix:** No code change needed. Consider adding a `console.debug` in the catch for developer visibility during future debugging.

### IN-03: `companyName` from bookmarklet uses full hostname, not apex

**File:** `src/app/api/capture/route.ts:91`
**Issue:** `companyName: hostname` means `https://careers.stripe.com/openings` pre-fills "careers.stripe.com" as the company name. Users must manually fix this. The `companyDomain` correctly extracts `stripe.com` via `extractApexDomain`.

**Fix:** Use `extractApexDomain(hostname)` for `companyName` as well, or present the apex domain as the default:

```ts
companyName: extractApexDomain(hostname),
companyDomain: extractApexDomain(hostname),
```

This is a UX preference — the full hostname is more informative but less clean. Flag for user input.

### IN-04: Test gaps — missing edge case coverage

**Files:** `tests/integration/capture.test.ts`, `tests/integration/bookmarklet-build.test.ts`
**Issue:** Several scenarios lack test coverage:
- Body size limit (4096 bytes) — no test for a payload exceeding the limit
- Malformed JSON body (valid Content-Type but broken JSON)
- `title` field extraction (the test sends title but doesn't verify its processing in isolation)
- `extractApexDomain` with multi-part TLDs (`.co.uk`)
- Bookmarklet build with a custom `FORAY_API_URL` (once CR-01 is fixed)

**Fix:** Add targeted test cases:

```ts
it('returns 413 when body exceeds MAX_BODY_BYTES', async () => {
  const req = new NextRequest('http://localhost:3000/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/' + 'x'.repeat(5000) }),
  })
  const res = await POST(req)
  expect(res.status).toBe(413)
})
```

---

_Reviewed: 2026-05-10T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
