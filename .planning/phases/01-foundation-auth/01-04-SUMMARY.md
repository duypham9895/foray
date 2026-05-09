---
phase: "01-foundation-auth"
plan: "04"
subsystem: "docs"
tags: ["adr", "documentation", "rls", "quality-gate", "sentinel"]
dependency_graph:
  requires:
    - "01-01 (withRls helper shipped — ADR references actual code)"
    - "01-02 (auth wiring shipped — Phase 1 surface complete)"
    - "01-03 (RLS migration shipped — ADR references FORCE + tenant_isolation patterns)"
  provides:
    - "ADR-0011 — locks Phase 1 RLS implementation choice (withRls vs $extends)"
    - "Phase 1 pre-commit gate green — FND-04 sentinel confirmed"
    - "PROJECT.md stack docs accurate (Next.js 16.2.6)"
  affects:
    - "docs/decisions/0011-rls-via-with-rls-helper.md (new)"
    - ".planning/PROJECT.md (2 lines updated)"
    - "tsconfig.json (jsx mode updated by Next.js 16 build)"
tech_stack:
  added: []
  patterns:
    - "Nygard ADR format: Status/Date/Context/Decision/Consequences/References/Supersedes"
key_files:
  created:
    - path: "docs/decisions/0011-rls-via-with-rls-helper.md"
      lines: 80
      note: "Accepted ADR locking withRls helper over Prisma $extends for Lean phase"
  modified:
    - path: ".planning/PROJECT.md"
      note: "Lines 99 + 121: 'Next.js 15' → 'Next.js 16' (surgical 2-line edit)"
    - path: "tsconfig.json"
      note: "jsx changed from 'preserve' to 'react-jsx' by Next.js 16 build auto-update"
decisions:
  - "ADR-0011 references ARCHITECTURE.md + PITFALLS.md + Prisma issues #23583 and #17948"
  - "PITFALLS.md line 502 still says 'Next.js 15' — research file is timestamped, intentionally not fixed; queue as cleanup candidate"
  - "tsconfig.json jsx change is intentional: Next.js 16 App Router requires react-jsx not preserve"
metrics:
  duration_seconds: 520
  completed_date: "2026-05-09"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
---

# Phase 01 Plan 04: Phase 1 Close-Out Summary

**One-liner:** ADR-0011 written (locks withRls vs Prisma $extends decision with Prisma issue #23583 rationale), PROJECT.md version string fixed (Next.js 15 → 16), and Phase 1 pre-commit gate confirmed green across all five checks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write ADR-0011 (RLS via withRls helper, not Prisma client extension) | 7448667 | docs/decisions/0011-rls-via-with-rls-helper.md |
| 2 | Surgical-fix PROJECT.md Next.js 15 → Next.js 16 (lines 99 + 121) | fc04387 | .planning/PROJECT.md |
| 3 | FND-04 sentinel — full pre-commit gate on Phase 1 combined output | 50bf176 | tsconfig.json (Next.js auto-update) |

## Pre-Commit Gate Result

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm lint` | PASS | ESLint: No issues found |
| `pnpm typecheck` | PASS | tsc --noEmit clean (after Prisma client generation) |
| `pnpm test:run` | PASS | 2 test files, 10 tests, 177ms total |
| `pnpm build` | PASS | Next.js 16.2.6 Turbopack build, 3 routes (/ + /login + /_not-found) |
| `pnpm depcheck` | PASS (exit 0) | 1 warning: src/middleware.ts orphan (pre-existing, expected — Next.js picks it up by convention) |

**Total gate duration:** ~35 seconds (lint 1s + typecheck 3s + test 2s + build 25s + depcheck 4s)

## Phase 1 Success Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Owner can log in via /login with the single password and is redirected to /applications | PLAN-02 ✓ |
| 2 | requireUser() reads iron-session cookie and returns Result<{id: UserId}, Unauthorized> | PLAN-02 ✓ |
| 3 | tenantDb exposes wrapped CRUD methods + withRls helper | PLAN-01 + PLAN-03 ✓ |
| 4 | RLS policies active on 9 tenant-scoped tables; non-superuser role; escape-attempt returns zero rows | PLAN-03 ✓ |
| 5 | ADR-0011 committed to docs/decisions/ | THIS PLAN ✓ |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Prisma client not generated in worktree**

- **Found during:** Task 3 - typecheck failed with TS2307 "Cannot find module '@/generated/prisma/client'"
- **Issue:** Worktree had no node_modules (fresh checkout) and no generated Prisma client. pnpm install was needed first; then DATABASE_URL must be set for `prisma generate` because prisma.config.ts calls `env('DATABASE_URL')`.
- **Fix:** Ran `pnpm install` then `DATABASE_URL=postgresql://foray:foray@localhost:5432/foray pnpm prisma generate`. Prisma generate does not require a live database connection — it only reads the schema and generates TypeScript types.
- **Impact:** Unblocked typecheck and build. Zero code changes.

**2. [Rule 3 - Blocking issue] tsconfig.json jsx mode auto-updated by Next.js build**

- **Found during:** Task 3 - `pnpm build` modified tsconfig.json
- **Issue:** Next.js 16 App Router requires `jsx: "react-jsx"` not `jsx: "preserve"`. Next.js auto-updated tsconfig.json during build with a warning: "We detected TypeScript in your project and reconfigured your tsconfig.json file for you."
- **Fix:** Committed the auto-update. This is the correct jsx mode for App Router + RSC; `preserve` was incorrect for Next.js 16.
- **Files modified:** tsconfig.json
- **Commit:** 50bf176

### Noted (not fixed, out of scope)

- **middleware.ts orphan warning in depcheck:** `src/middleware.ts` reported as orphan by dependency-cruiser because Next.js loads it by convention (not via import graph). Exit code was 0 (warning only). Pre-existing from Plan 02.
- **Next.js workspace root warning during build:** Multiple pnpm-workspace.yaml files detected (worktree + root). Cosmetic warning only, build succeeds. Worktree-specific; not present in main repo.
- **"middleware" → "proxy" deprecation warning:** Next.js 16 renamed the middleware convention to "proxy". Pre-existing from Plan 02; out of scope for Plan 04.

## Outstanding Flagged (not blocking)

- **PITFALLS.md line 502** still says "Next.js 15" — research file is a timestamped artifact, intentionally not fixed per CLAUDE.md §1.3 Surgical Changes + plan instructions. Queue as future cleanup.

## Downstream Consumers

Phase 2 starts from a green base. Every Server Action created in Phase 2 onward must:
- Call `await requireUser()` as line 1 (from Plan 02's iron-session auth)
- Use `tenantDb(userId)` for single-row reads
- Use `withRls(userId, async tx => …)` for multi-statement atomic operations
- Refer to ADR-0011 for the rationale on why `$extends` is not used

## Known Stubs

None. All files created/modified in this plan are fully implemented with no placeholder values.

## Threat Flags

None. This plan only adds documentation files (ADR) and updates a planning doc (PROJECT.md). No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

Files exist:
- docs/decisions/0011-rls-via-with-rls-helper.md: FOUND
- .planning/PROJECT.md (Next.js 16 × 2): VERIFIED

Commits exist:
- 7448667: FOUND (ADR-0011)
- fc04387: FOUND (PROJECT.md fix)
- 50bf176: FOUND (tsconfig.json jsx update)
