---
phase: 06-bookmarklet-capture-api
plan: 02
subsystem: api
tags: [nextjs, route-handler, cors, bookmarklet, base64, zod, validation]

# Dependency graph
requires:
  - phase: 06-bookmarklet-capture-api/01
    provides: bookmarklet source file that POSTs to /api/capture
  - phase: 05-review-queue
    provides: existing applications/new form and createApplication service
provides:
  - POST /api/capture route handler with CORS and ATS rejection
  - Prefill support on /applications/new form via base64url query param
  - Server-side ATS URL rejection on roleUrl field in createApplicationSchema
affects: [06-03-bookmarklet-settings, applications]

# Tech tracking
tech-stack:
  added: [esbuild (dev dependency for build-bookmarklet)]
  patterns: [base64url encoding for cross-origin prefill data, CORS headers on route handlers]

key-files:
  created:
    - src/app/api/capture/route.ts
    - tests/integration/capture.test.ts
  modified:
    - src/features/applications/components/new-application-form.tsx
    - src/features/applications/schema.ts
    - package.json

key-decisions:
  - "base64url encoding over query-string params: safer for arbitrary text (selectedText), avoids URL encoding edge cases"
  - "Apex domain extraction for companyDomain: last two hostname segments (e.g., careers.stripe.com -> stripe.com)"
  - "Browser-compatible atob() for client-side decoding: Buffer polyfill unreliable across bundlers"
  - "ATS roleUrl rejection in schema superRefine: defense-in-depth even though /api/capture already rejects"

patterns-established:
  - "CORS route handler pattern: CORS_HEADERS constant, jsonResponse helper, OPTIONS handler"
  - "Prefill via base64url query param: encode server-side, decode client-side with atob"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 6 Plan 02: /api/capture endpoint + CORS + prefill modal Summary

**POST /api/capture route handler with CORS, ATS domain rejection, base64url prefill encoding, and form auto-population**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T05:19:13+07:00
- **Completed:** 2026-05-10T05:31:12+07:00
- **Tasks:** 4 (3 planned + 1 blocking fix)
- **Files modified:** 5

## Accomplishments

- Created `/api/capture` POST endpoint accepting bookmarklet data (title, url, selectedText)
- CORS headers on all responses for cross-origin bookmarklet requests
- ATS domain rejection using shared `isAtsDomain()` from `core/domains/ats-domains`
- Base64url-encoded prefill data in redirect URL for `/applications/new`
- Form auto-populates companyName, companyDomain, roleTitle, roleUrl, notes from prefill data
- Server-side ATS URL rejection on `roleUrl` field in `createApplicationSchema` (defense-in-depth)
- 10 integration tests covering happy path, ATS rejection, error cases, CORS

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/capture route handler** - `95d5989` (feat)
2. **Fix: Add esbuild dev dependency** - `86b0387` (fix) — Rule 3 Blocking deviation
3. **Task 2: Parse prefill data in form** - `abe94bb` (feat)
4. **Task 3: Server-side ATS URL rejection** - `8b49fee` (feat)

## Files Created/Modified

- `src/app/api/capture/route.ts` — POST + OPTIONS handlers with CORS, validation, ATS rejection, base64url prefill encoding
- `tests/integration/capture.test.ts` — 10 tests: valid POST, ATS rejection (2 domains), missing URL, invalid URL, wrong Content-Type, CORS headers, missing optional fields, subdomain extraction, OPTIONS preflight
- `src/features/applications/components/new-application-form.tsx` — Added `useSearchParams` + `decodePrefill()` for reading prefill data, `defaultValue` on companyName, companyDomain, roleTitle, roleUrl, notes inputs
- `src/features/applications/schema.ts` — Added `roleUrl` ATS domain check in `createApplicationSchema` superRefine
- `package.json` — Added `esbuild` dev dependency (needed by scripts/build-bookmarklet.ts from plan 06-01)

## Decisions Made

- **base64url over query-string params:** Selected text can contain arbitrary characters including `&`, `=`, `#` that break naive query params. Base64url is safe and compact.
- **Apex domain extraction:** Simple `hostname.split('.').slice(-2).join('.')` — sufficient for known patterns. Won't handle `.co.uk` style TLDs but those aren't relevant for job sites.
- **atob() for client-side decoding:** Next.js doesn't reliably polyfill `Buffer` in client bundles. `atob` with base64url-to-base64 conversion is browser-native and dependency-free.
- **ATS roleUrl rejection in schema:** Adds defense-in-depth even though `/api/capture` already rejects ATS URLs. Catches manual form submissions with ATS URLs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added esbuild dev dependency**
- **Found during:** Task 1 (initial typecheck)
- **Issue:** `scripts/build-bookmarklet.ts` (from plan 06-01) imports `esbuild` which wasn't in package.json, blocking typecheck
- **Fix:** `pnpm add -D esbuild`
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** typecheck passes after install
- **Committed in:** `86b0387`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock typecheck. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/api/capture` endpoint ready for bookmarklet POST requests
- Form prefill working for bookmarklet-sourced data
- Ready for plan 06-03 (bookmarklet settings UI + integration)

---
*Phase: 06-bookmarklet-capture-api*
*Completed: 2026-05-10*
