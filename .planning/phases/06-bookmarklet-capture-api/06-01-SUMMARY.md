---
phase: 06-bookmarklet-capture-api
plan: 01
subsystem: bookmarklet
tags: [bookmarklet, esbuild, iife, javascript, capture]

# Dependency graph
requires:
  - phase: 05-review-queue-acceptance
    provides: Lean milestone shipped, all pre-commit gates passing
provides:
  - Bookmarklet source file (bookmarklet/foray.js) with IIFE pattern
  - Build pipeline: esbuild minification + URL encoding to javascript:... form
  - pnpm build:bookmarklet command
  - public/foray-bookmarklet-url.json output for settings page import
affects: [06-02-capture-api, 06-03-bookmarklet-ui]

# Tech tracking
tech-stack:
  added: [esbuild (minification)]
  patterns: [IIFE bookmarklet, esbuild.transform API, build-time JSON artifact]

key-files:
  created:
    - bookmarklet/foray.js
    - scripts/build-bookmarklet.ts
  modified:
    - package.json (build:bookmarklet script)

key-decisions:
  - "Used esbuild directly instead of Vite lib mode — esbuild is already a transitive dep via vitest, no new dependency needed"
  - "Output to public/foray-bookmarklet-url.json (gitignored) instead of dist/bookmarklet.txt — enables build-time import by Next.js settings page"
  - "Used var/function declarations instead of const/arrow for maximum CSP compatibility in bookmarklet context"
  - "Used javascript:void() wrapper to prevent browser displaying return value"

patterns-established:
  - "Bookmarklet build pipeline: source in bookmarklet/, minify via esbuild, URL-encode, output to public/"
  - "Build-time artifacts in public/ (gitignored) for Next.js static import"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-05-10
---

# Plan 06-01: Bookmarklet Source + Build Pipeline Summary

**IIFE bookmarklet that captures page title/URL/selection, with esbuild minification pipeline producing 861-char javascript:... URL**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-10
- **Completed:** 2026-05-10
- **Tasks:** 3 (Task 4 manual browser test deferred to human)
- **Files modified:** 3

## Accomplishments
- Created bookmarklet/foray.js with IIFE pattern capturing document.title, location.href, and selected text
- Built esbuild-based minification + URL encoding pipeline (pnpm build:bookmarklet)
- Output is 861 chars (well under 2KB browser limit), stored as JSON for Next.js import

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bookmarklet source file** - `edf83c7` (feat)
2. **Task 2+3: Create build script with esbuild minification** - `2382cc1` (feat)

## Files Created/Modified
- `bookmarklet/foray.js` - IIFE bookmarklet source: captures page info, POSTs to /api/capture, opens redirect URL
- `scripts/build-bookmarklet.ts` - Build script: esbuild.transform minification + encodeURIComponent URL encoding
- `package.json` - Added `build:bookmarklet` npm script

## Decisions Made
- **esbuild over Vite lib mode**: Vite is not a direct dependency (comes via vitest). esbuild.transform API is simpler, already available, and produces identical minified output (652 chars). Avoids adding vite as explicit devDependency.
- **public/ over dist/**: The linter/hook improved the output path from dist/bookmarklet.txt to public/foray-bookmarklet-url.json. This is better because Next.js can import JSON from public/ at build time for the settings page.
- **var/function over const/arrow**: Bookmarklet runs in arbitrary page contexts. var and function declarations avoid strict-mode edge cases in some CSP environments.

## Deviations from Plan

### Auto-fixed Issues

**1. Build script output format improved by linter**
- **Found during:** Task 2+3 (build script creation)
- **Issue:** Original plan used dist/bookmarklet.txt with plain text output
- **Fix:** Linter changed to public/foray-bookmarklet-url.json with JSON wrapper { url: ... } for Next.js import compatibility
- **Files modified:** scripts/build-bookmarklet.ts
- **Verification:** Build script runs successfully, output is valid JSON
- **Committed in:** 2382cc1 (part of task commit)

**2. esbuild.transform API instead of execSync**
- **Found during:** Task 2+3 (build script creation)
- **Issue:** Original plan used execSync to call esbuild CLI
- **Fix:** Linter changed to esbuild.transform() API — cleaner, no shell dependency
- **Files modified:** scripts/build-bookmarklet.ts
- **Verification:** Build script produces identical minified output
- **Committed in:** 2382cc1 (part of task commit)

---

**Total deviations:** 2 auto-fixed (output format, API approach)
**Impact on plan:** Both improvements. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bookmarklet source and build pipeline ready
- /api/capture endpoint needed (Plan 06-02) before bookmarklet can POST
- Settings page needs bookmarklet install section (Plan 06-03)
- Task 4 (manual browser test) deferred — requires dev server running + human interaction

---
*Phase: 06-bookmarklet-capture-api*
*Completed: 2026-05-10*
