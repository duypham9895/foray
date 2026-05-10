---
phase: 06-bookmarklet-capture-api
verified: 2026-05-10T10:45:00Z
status: passed
score: 5/5 success criteria verified
overrides_applied: 0
re_verification: false
deferred:
  - truth: "End-to-end bookmarklet flow tested in browser (bookmarklet click -> API -> prefilled form)"
    addressed_in: "Phase 10"
    evidence: "Phase 10 success criteria: 'E2E tests cover: login, capture via bookmarklet flow, application CRUD, search + filter, today dashboard'"
  - truth: "Bearer token auth on /api/capture endpoint"
    addressed_in: "Future (post-Standard)"
    evidence: "TODO in route.ts line 20: 'Deferred for Lean — bookmarklet is single-user, local-only deployment'"
human_verification:
  - test: "Install bookmarklet from /settings page, navigate to a job posting, click bookmarklet, verify form prefills"
    expected: "Bookmarklet captures page title/URL/selection, POSTs to /api/capture, redirects to /applications/new with prefilled fields"
    why_human: "Requires real browser interaction — bookmarklet execution, page context, CORS from external domain"
  - test: "Click bookmarklet on an ATS domain page (greenhouse.io), verify error message"
    expected: "Alert shows 'Foray bookmarklet failed' with ATS rejection error"
    why_human: "Requires real browser on external site to test CSP + CORS + ATS rejection end-to-end"
---

# Phase 6: Bookmarklet + Capture API -- Verification Report

**Phase Goal:** One-click job capture from any webpage -- bookmarklet extracts page info, POSTs to `/api/capture`, redirects to prefilled form.
**Verified:** 2026-05-10T10:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Bookmarklet source in `bookmarklet/foray.js` exists and exports capturePageInfo() | VERIFIED | File exists (1.2KB), IIFE with `capturePageInfo()` at line 5 and `sendToAPI()` at line 14 |
| 2 | Build step minifies + URL-encodes into `javascript:...` form | VERIFIED | `scripts/build-bookmarklet.ts` uses esbuild.transform, outputs to `public/foray-bookmarklet-url.json`. Build produces 887-char URL (under 2000 limit) |
| 3 | `/api/capture` endpoint accepts POST, validates, returns redirectUrl | VERIFIED | `src/app/api/capture/route.ts` (111 lines): POST handler with Content-Type check, body size guard, URL validation, ATS rejection, base64url prefill encoding, CORS headers |
| 4 | Form rejects ATS domains client-side and server-side | VERIFIED | Client: `schema.ts` superRefine on `companyDomain` (line 95) and `roleUrl` (line 102). Server: same schema applied in `createApplicationAction`. Capture route: `isAtsDomain()` check (line 84) |
| 5 | All pre-commit checks pass | VERIFIED | lint: pass, typecheck: pass, test:run: 329 passed (27 files), build: pass. `/api/capture` route appears in build output |

**Score:** 5/5 success criteria verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | End-to-end bookmarklet flow tested in browser | Phase 10 | Phase 10 SC: "E2E tests cover: login, capture via bookmarklet flow" |
| 2 | Bearer token auth on /api/capture | Future (post-Standard) | TODO in route.ts line 20: "Deferred for Lean -- bookmarklet is single-user, local-only" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bookmarklet/foray.js` | IIFE bookmarklet source | VERIFIED | 41 lines, captures document.title, location.href, selection. Uses `var`/`function` for CSP compat |
| `src/app/api/capture/route.ts` | POST + OPTIONS handlers | VERIFIED | 111 lines. CORS headers, Content-Type check, body size guard (4KB), URL validation, ATS rejection, base64url prefill encoding |
| `scripts/build-bookmarklet.ts` | esbuild minification + URL encoding | VERIFIED | 55 lines. Reads source, replaces `__FORAY_API_URL__`, minifies via esbuild.transform, writes JSON to public/ |
| `src/features/applications/components/new-application-form.tsx` | Prefill support via query params | VERIFIED | 303 lines. `decodePrefill()` reads `?prefilled=` base64url param, sets `defaultValue` on companyName, companyDomain, roleTitle, roleUrl, notes |
| `src/features/applications/schema.ts` | ATS rejection in Zod schema | VERIFIED | 206 lines. superRefine on companyDomain and roleUrl fields imports `isAtsDomain` from shared utility |
| `src/app/settings/page.tsx` | Bookmarklet section with draggable link | VERIFIED | 155 lines. `getBookmarkletUrl()` reads from `public/foray-bookmarklet-url.json`, renders "Add to Foray" link with install instructions |
| `src/core/domains/ats-domains.ts` | Shared ATS domain blocklist | VERIFIED | 46 lines. 15 ATS domains, `isAtsDomain()` with protocol stripping and subdomain matching |
| `tests/integration/capture.test.ts` | Integration tests for capture route | VERIFIED | 161 lines, 9 tests: valid POST, 2 ATS domains, missing URL, invalid URL, wrong Content-Type, CORS headers, missing optional fields, subdomain extraction, OPTIONS preflight |
| `tests/integration/bookmarklet-build.test.ts` | Build output validation tests | VERIFIED | 49 lines, 5 tests: source exists, URL under 2000 chars, javascript: prefix, API endpoint reference, capturePageInfo logic |
| `package.json` | build:bookmarklet script, esbuild dep | VERIFIED | Script: `"build:bookmarklet": "tsx scripts/build-bookmarklet.ts"`, esbuild: `"^0.28.0"` dev dep |
| `.gitignore` | Generated file excluded | VERIFIED | `public/foray-bookmarklet-url.json` in .gitignore |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bookmarklet/foray.js` | `/api/capture` | `fetch()` POST with title, url, selectedText | WIRED | Line 17: `fetch(API_URL, { method: "POST", ... })` with `__FORAY_API_URL__` placeholder replaced at build time |
| `/api/capture` route | `isAtsDomain()` | import from `@/core/domains/ats-domains` | WIRED | Line 17: import, Line 84: `if (isAtsDomain(url))` rejects ATS domains |
| `/api/capture` route | `/applications/new` | `redirectUrl` in JSON response | WIRED | Line 107: `{ redirectUrl: \`/applications/new?prefilled=${encoded}\` }` |
| `new-application-form.tsx` | `/api/capture` prefill data | `useSearchParams` + `decodePrefill()` | WIRED | Line 57-58: reads `?prefilled=` param, decodes base64url, sets form defaults |
| `schema.ts` | `isAtsDomain()` | import from `@/core/domains/ats-domains` | WIRED | Line 13: import, Lines 60/95/102: superRefine checks on domain and URL fields |
| `settings/page.tsx` | `public/foray-bookmarklet-url.json` | `getBookmarkletUrl()` reads file at build time | WIRED | Line 17-22: `fs.readFileSync` + `JSON.parse`, Line 43: passed to JSX |
| `build-bookmarklet.ts` | `bookmarklet/foray.js` | Reads source file, minifies, writes output | WIRED | Line 11: SOURCE path, Line 21: `fs.readFileSync(SOURCE)`, Line 43: writes JSON |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `new-application-form.tsx` | `prefill` (from decodePrefill) | Query param `?prefilled=` (base64url JSON from /api/capture) | Yes -- real user data flows through bookmarklet -> API -> redirect | FLOWING |
| `settings/page.tsx` | `bookmarkletUrl` | `public/foray-bookmarklet-url.json` generated by `pnpm build:bookmarklet` | Yes -- 887-char javascript: URL generated from real source | FLOWING |
| `/api/capture` route | prefill data | POST body from bookmarklet (title, url, selectedText) | Yes -- real page data from browser context | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Bookmarklet build produces valid URL | `pnpm build:bookmarklet` | 887 chars, starts with `javascript:`, under 2000 limit | PASS |
| Capture route in build output | `pnpm build` route listing | `/api/capture` listed as `ƒ` (dynamic) route | PASS |
| Capture tests pass | `pnpm test:run` (all tests) | 329 passed across 27 files, capture tests included | PASS |
| Bookmarklet build tests pass | `pnpm test:run` (all tests) | 5 bookmarklet build tests pass | PASS |
| Lint passes | `pnpm lint` | Exit code 0, no errors | PASS |
| Typecheck passes | `pnpm typecheck` | Exit code 0, no errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| BOOK-01 | ROADMAP Phase 6 | Bookmarklet one-click capture | IMPLEMENTED | `bookmarklet/foray.js` + build pipeline + settings UI. Not formally defined in REQUIREMENTS.md (v0.2 milestone) |
| CAPT-02 | ROADMAP Phase 6 (extends Phase 2) | ATS domain rejection in form validation | EXTENDED | Phase 2 implemented base; Phase 6 adds `roleUrl` ATS check in schema superRefine (line 102) and capture route rejection (line 84) |
| CAPT-03 | ROADMAP Phase 6 (extends Phase 2) | Form submission creates Application + Event | EXTENDED | Phase 2 implemented base; Phase 6 adds bookmarklet-sourced submission path via prefill |
| BOOK-02 | ROADMAP Phase 6 | Bookmarklet install UI on settings page | IMPLEMENTED | Settings page bookmarklet section with draggable link + instructions. Not formally defined in REQUIREMENTS.md |
| BLOCK-01 | ROADMAP Phase 6 | ATS domain blocking | IMPLEMENTED | Shared `ats-domains.ts` utility (15 domains), used in capture route + schema + matcher |

**Note:** BOOK-01, BOOK-02, and BLOCK-01 are referenced in ROADMAP.md Phase 6 but are not formally defined in REQUIREMENTS.md (which covers v0.1 Lean only). These are v0.2 Standard milestone requirements. CAPT-02 and CAPT-03 are formally defined but mapped to Phase 2 in REQUIREMENTS.md; Phase 6 extends their coverage.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/capture/route.ts` | 20 | `TODO: Add Bearer token auth` | INFO | Known deferral -- bookmarklet is single-user local-only. Not blocking. |
| `src/app/api/capture/route.ts` | 38 | `TODO: Replace with psl library` | INFO | Future enhancement for multi-part TLDs (.co.uk). Not relevant for current job sites. |

Both TODOs are documented deferrals with clear rationale, not incomplete implementations.

### Human Verification Required

### 1. Bookmarklet End-to-End Flow

**Test:** Install bookmarklet from /settings page, navigate to a real job posting (e.g., LinkedIn), click bookmarklet, verify form prefills with page data.
**Expected:** Bookmarklet captures page title/URL/selection, POSTs to /api/capture, opens new tab to /applications/new with company name, role title, URL, and selected text prefilled.
**Why human:** Requires real browser interaction -- bookmarklet execution in arbitrary page context, CORS from external domain, CSP compatibility.

### 2. ATS Domain Rejection in Browser

**Test:** Click bookmarklet while on a Greenhouse/Workday job page.
**Expected:** Alert shows "Foray bookmarklet failed" with ATS rejection error. User understands they should fill manually.
**Why human:** Requires real browser on external ATS site to test CSP + CORS + ATS rejection flow end-to-end.

### Gaps Summary

No blocking gaps found. All 5 success criteria are verified. All artifacts exist, are substantive, are wired correctly, and have real data flowing through them. All pre-commit checks pass (lint, typecheck, 329 tests, build). Two INFO-level TODOs are documented deferrals, not incomplete work.

The requirement IDs (BOOK-01, CAPT-02, CAPT-03, BOOK-02, BLOCK-01) from ROADMAP.md are all implemented in the codebase. BOOK-01, BOOK-02, and BLOCK-01 lack formal definitions in REQUIREMENTS.md because they belong to the v0.2 Standard milestone, which has not yet been formalized in the requirements document. This is a documentation process gap, not an implementation gap.

Two items are deferred to later phases: end-to-end browser testing (Phase 10 E2E) and Bearer token auth (post-Standard). Both have documented rationale and tracking.

---

_Verified: 2026-05-10T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
