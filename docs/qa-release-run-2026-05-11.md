# QA Release Run — 2026-05-11

Run started from commit: `96e1b92`  
Branch: `feat/chrome-extension-phase-13`  
Tester: Codex QA/QC pass  
Environment: local macOS workspace, Docker/Testcontainers available, Next.js dev server via Playwright webServer

## Decision

**Automated release gate: pass.**

The automated release gate now passes after fixing the proxy/API boundary, E2E environment loading, keyboard shortcut normalization, and stale/ambiguous E2E selectors.

Full release sign-off still needs the external/manual checks that cannot be completed unattended in this local run: real Gmail OAuth, real Calendar OAuth, optional OpenAI provider validation, Chrome load-unpacked extension review, and manual responsive/accessibility inspection.

## Automated Gate Results

| Gate | Result | Notes |
|---|---:|---|
| `pnpm install` | Pass | Lockfile up to date; warning about ignored `spawn-sync` build script |
| `pnpm db:generate` | Pass | Prisma Client generated |
| `pnpm lint` | Pass | Existing dependency-boundaries deprecation warnings only |
| `pnpm typecheck` | Pass | `tsc --noEmit` clean |
| `pnpm test:run` | Pass | 45 files passed; 509 passed; 4 todo |
| `pnpm build` | Pass | Known Turbopack NFT tracing warning through classifier budget import path |
| `pnpm extension:build` | Pass | WXT Chrome MV3 production bundle generated |
| `pnpm e2e` | Pass | 31 passed |

E2E note: the Playwright fixture now loads `.env.local` and `.env`, while still honoring `E2E_APP_PASSWORD` as the highest-priority override. `pnpm e2e` no longer requires manual shell sourcing.

## Resolved Findings

| ID | Severity | Area | Finding | Evidence | Release decision |
|---|---|---|---|---|---|
| QA-001 | P1 | Capture API / Proxy | `/api/capture` was intercepted by `src/proxy.ts` and returned login HTML instead of JSON capture responses. | Fixed by excluding `/api/**` from the proxy matcher. Capture E2E now verifies success, validation errors, and content-type errors. | Resolved |
| QA-002 | P1 | E2E release gate | `pnpm e2e` failed in the current branch. | Fixed E2E harness/env loading, selectors, and shortcut timing. `pnpm e2e` now passes 31/31. | Resolved |

## Resolved E2E Triage Items

These were triaged and fixed during this release-gate cleanup.

| ID | Severity | Area | Finding |
|---|---|---|---|
| QA-003 | P2 | Search UI / E2E selectors | Resolved by targeting the page search placeholder instead of duplicate `input[name="q"]` locators. |
| QA-004 | P2 | Keyboard shortcuts | Resolved by normalizing shortcut keys and waiting for shortcut hydration in E2E. |
| QA-005 | P3 | E2E selectors | Resolved by replacing broad text locators with role-based or exact selectors aligned to current UI copy. |
| QA-006 | P3 | Undo toast test | Resolved by asserting absence of undo action buttons instead of all alert roles. |
| QA-007 | P3 | E2E env setup | Resolved by loading `.env.local` and `.env` in the Playwright fixture and honoring `E2E_APP_PASSWORD`. |

## Scenario Execution Summary

| Scenario area | Status | Notes |
|---|---:|---|
| Critical smoke | Pass automated | Authenticated and unauthenticated browser smoke coverage passes. |
| Applications | Pass automated | Unit/integration coverage and browser E2E list/board coverage pass. Manual full create/edit/status/stage exploratory pass not executed. |
| Follow-ups and Today | Pass automated | Unit/integration coverage and Today browser E2E pass. Manual seeded dashboard review not executed. |
| Capture/bookmarklet/extension | Pass automated | Capture API, bookmarklet-related integration coverage, and extension production build pass. Load-unpacked Chrome manual test not executed. |
| Gmail/classifier/matcher/review queue | Partial / Blocked | Unit/integration coverage passes. Real Gmail OAuth/sync not executed; Google creds present but interactive account authorization not run. |
| Documents | Partial | Unit/integration coverage passes. Real browser upload/download/delete manual pass not executed. |
| Recruiters | Partial | Integration coverage passes. Manual recruiter UI pass not executed. |
| Calendar | Partial / Blocked | Integration coverage passes. `GOOGLE_CALENDAR_REDIRECT_URI` missing in env check; real Calendar OAuth/sync not executed. |
| Analytics | Partial | Integration coverage passes. Manual dashboard visual/data comparison not executed. |
| Search/tags/keyboard | Pass automated | Unit coverage and browser E2E pass. |
| Settings/configuration | Partial / Blocked | Settings action tests pass. OpenAI key missing, so real OpenAI provider selection/API call not executed. |
| Security/privacy | Partial | RLS, capture auth, document service, cost-log privacy tests pass. Manual log/secret review and OAuth tamper checks not executed. |
| Responsive/accessibility | Not executed | Requires manual or scripted viewport visual pass beyond current E2E. |
| Data/migration | Pass for test DB | Testcontainers applied all migrations cleanly during `pnpm test:run`. Manual previous-release snapshot migration not executed. |

## External Integration Status

Checked presence only; no secret values were printed.

| Integration | Config status | Execution status |
|---|---:|---|
| Gmail OAuth | Google client id/secret/redirect present | Real OAuth and Gmail API sync not executed |
| Google Calendar OAuth | Calendar redirect missing | Real OAuth and sync not executed |
| Anthropic | API key present | Live API call not executed in QA run |
| OpenAI | API key missing | Live API call and OpenAI provider save not executed |
| Chrome extension | Build passes | Manual Chrome load-unpacked and SPA navigation not executed |

## Remaining Manual / External Checks

1. Execute real Gmail OAuth and sync with a test Google account.
2. Add or verify `GOOGLE_CALENDAR_REDIRECT_URI`, then execute real Calendar OAuth and sync.
3. Add `OPENAI_API_KEY` if OpenAI provider support is part of the release acceptance criteria, then save settings and make a live validation call.
4. Load `extension/.output/chrome-mv3` unpacked in Chrome and verify popup capture, options token save, content script detection, and SPA navigation behavior.
5. Perform a manual responsive/accessibility pass across desktop and mobile widths.

## Final Sign-Off

- [ ] Ready to release
- [ ] Not ready
- [x] Ready with waivers

Open blockers: none in the automated release gate. External/manual release checks remain pending as waivers.
