---
phase: 06-bookmarklet-capture-api
plan: 03
subsystem: ui
tags: [bookmarklet, esbuild, settings, url-encoding]

requires:
  - phase: 06-01
    provides: bookmarklet/foray.js source file
  - phase: 06-02
    provides: /api/capture route, prefill support in /applications/new
provides:
  - Bookmarklet build script (scripts/build-bookmarklet.ts)
  - Bookmarklet section on settings page with draggable install link
  - Build output validation tests
affects: [07-today-dashboard, settings-page]

tech-stack:
  added: [esbuild]
  patterns: [build-time asset generation, JSON file import in server components]

key-files:
  created:
    - scripts/build-bookmarklet.ts
    - tests/integration/bookmarklet-build.test.ts
  modified:
    - src/app/settings/page.tsx
    - package.json
    - .gitignore

key-decisions:
  - "Used esbuild (already available from Next.js) instead of adding terser dependency"
  - "Generated bookmarklet URL stored as JSON file (public/foray-bookmarklet-url.json) imported at build time"
  - "Generated file gitignored — fresh clones must run pnpm build:bookmarklet before dev/build"

patterns-established:
  - "Build-time asset generation: script outputs JSON consumed by server component"
  - "Graceful fallback: settings page shows build instructions when generated file missing"

requirements-completed: []

duration: 15min
completed: 2026-05-10
---

# Plan 06-03: Settings page bookmarklet UI + install instructions Summary

**Bookmarklet build pipeline with esbuild minification and draggable install link on settings page**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-10T05:20:00Z
- **Completed:** 2026-05-10T05:35:00Z
- **Tasks:** 3 (2 automated, 1 manual verification)
- **Files modified:** 5

## Accomplishments
- Build script minifies bookmarklet to 861-char URL (well under 2000-char browser limit)
- Settings page displays draggable "Add to Foray" bookmarklet with install instructions
- 5 validation tests ensure bookmarklet meets browser constraints
- Graceful fallback when generated file missing (shows build instructions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bookmarklet build script** - `4afcee7` (feat)
2. **Task 2: Add bookmarklet section to settings page** - `a789fa2` (feat)
3. **Task 3: Add bookmarklet build tests** - `62fb54e` (test)

## Files Created/Modified
- `scripts/build-bookmarklet.ts` - Minifies bookmarklet/foray.js via esbuild, writes URL-encoded JSON to public/
- `src/app/settings/page.tsx` - Added bookmarklet section with draggable link and install instructions
- `tests/integration/bookmarklet-build.test.ts` - 5 tests validating bookmarklet URL constraints
- `package.json` - Added build:bookmarklet script
- `.gitignore` - Added public/foray-bookmarklet-url.json

## Decisions Made
- Used esbuild (already available from Next.js) instead of adding terser as a new dependency
- Bookmarklet URL stored as JSON file imported by server component, not as env var (avoids rebuild dependency)
- Generated file gitignored since it's a build artifact

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bookmarklet + capture API + settings UI complete
- Full flow ready: bookmarklet click -> API -> prefilled form
- Manual verification of end-to-end flow recommended before moving to Phase 7

---
*Phase: 06-bookmarklet-capture-api*
*Completed: 2026-05-10*
