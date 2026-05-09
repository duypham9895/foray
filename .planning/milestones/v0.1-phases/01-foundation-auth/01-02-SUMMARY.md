---
phase: 01-foundation-auth
plan: "02"
subsystem: auth
tags: [iron-session, auth, middleware, server-actions, cookies]
dependency_graph:
  requires:
    - "01-01 (APP_SESSION_SECRET + APP_PASSWORD env vars, iron-session package)"
  provides:
    - "requireUser(): Promise<Result<{id: UserId}, AppError>> — real cookie check, all phases 2-5 depend on this"
    - "login/logout Server Actions — wired iron-session cookie lifecycle"
    - "src/middleware.ts — defense-in-depth unauthenticated redirect"
  affects:
    - "src/core/auth/session.ts — was a hard-coded stub, now reads foray_session cookie"
tech_stack:
  added:
    - "iron-session ^8.0.4 (getIronSession, SessionOptions)"
    - "node:crypto timingSafeEqual for constant-time password compare"
  patterns:
    - "useActionState(login, initial) for progressive-enhancement login form"
    - "Server Action redirect() called outside try-catch (Next.js relies on throw)"
    - "Middleware checks cookie PRESENCE only; requireUser() checks VALIDITY (CVE-2025-29927 posture)"
key_files:
  created:
    - path: src/core/auth/session-config.ts
      lines: 22
      note: "SessionData type + sessionOptions (foray_session, lax, httpOnly, 30d)"
    - path: src/features/auth/schema.ts
      lines: 7
      note: "loginSchema Zod schema"
    - path: src/features/auth/service.ts
      lines: 37
      note: "verifyPasswordAndIssueSession (timingSafeEqual, padEnd(72)) + destroySession"
    - path: src/features/auth/actions.ts
      lines: 25
      note: "login + logout Server Actions"
    - path: src/features/auth/components/login-form.tsx
      lines: 33
      note: "useActionState client form, generic error display"
    - path: src/app/login/page.tsx
      lines: 5
      note: "minimal page delegating to LoginForm"
    - path: src/middleware.ts
      lines: 13
      note: "defense-in-depth redirect, cookie presence check only"
  modified:
    - path: src/core/auth/session.ts
      lines: 19
      note: "rewritten — getIronSession replaces hard-coded UserId(1) stub"
decisions:
  - "foray_session cookie: httpOnly=true, sameSite=lax (not strict — bookmarklet POST compatibility per Phase 4), secure=prod-only, maxAge=30d"
  - "SEEDED_OWNER_USER_ID = UserId(1) hard-coded in service.ts — single-user posture, matches seed.ts"
  - "Password compare: padEnd(72, '\\0') on both sides before timingSafeEqual — prevents length-leak side-channel (72 = bcrypt max)"
  - "Middleware at src/middleware.ts (not src/app/middleware.ts) — Next.js 16 convention"
  - "Middleware checks cookie PRESENCE only; requireUser() in every Server Action is the real auth boundary (closes CVE-2025-29927)"
  - "No Route Handler for login — Server Action is sufficient for same-origin; Route Handler deferred to Phase 4 bookmarklet"
metrics:
  completed_date: "2026-05-09"
  tasks: 2
  files_created: 7
  files_modified: 1
  total_lines: 161
---

# Phase 1 Plan 02: iron-session Auth Wiring Summary

iron-session auth boundary wired: `foray_session` HMAC-encrypted cookie issued on login, `requireUser()` reads it in every Server Action, middleware redirects unauthenticated browser nav as defense-in-depth.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create session-config + rewrite requireUser | 9e91394 | src/core/auth/session-config.ts, src/core/auth/session.ts |
| 2 | Auth slice + /login page + middleware | 7c51124 | src/features/auth/{schema,service,actions}.ts, components/login-form.tsx, src/app/login/page.tsx, src/middleware.ts |

## Locked Invariants

These values are load-bearing. Changing them has cascading effects.

| Invariant | Value | Reason |
|-----------|-------|--------|
| `cookieName` | `foray_session` | Referenced by middleware presence check AND iron-session decrypt — must match |
| `sameSite` | `lax` | Phase 4 bookmarklet POST from third-party origin requires non-strict |
| `maxAge` | `60 * 60 * 24 * 30` (30 days) | UX: owner should not be logged out daily |
| `padEnd(72, '\0')` | Both provided and expected | Prevents length-leak timing side-channel; 72 = bcrypt max payload |
| `SEEDED_OWNER_USER_ID` | `UserId(1)` | Matches seed.ts single-user row; no DB lookup needed |
| `APP_SESSION_SECRET` (not `APP_PASSWORD`) | Separate env vars | Rotation independence: rotating password doesn't log owner out; rotating secret does |

## Downstream Contract

Every Server Action and Route Handler in Phases 2–5 must call `await requireUser()` as the **first statement in the function body** (not gated behind middleware). This is the real auth boundary per CVE-2025-29927.

```typescript
// Pattern for every protected Server Action:
export async function someAction(formData: FormData) {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }
  const { id: userId } = userResult.value
  // ... rest of action
}
```

## Deviations from Plan

None — plan executed exactly as written.

Note: `pnpm typecheck` and `pnpm build` are deferred to post-wave merge (orchestrator responsibility). This worktree runs in wave 1 parallel with 01-01, which adds `iron-session` package and `APP_SESSION_SECRET` to env.ts. Both are referenced in this plan's code as if installed.

## Known Stubs

None. The `SEEDED_OWNER_USER_ID = UserId(1)` in service.ts is documented and intentional (single-user, matches seed.ts). It is not a stub — it is the correct value for the Lean milestone single-user posture.

## Threat Flags

No new threat surface beyond what the threat model covers. All T-01-02-* threats from the plan are addressed:
- T-01-02-01: requireUser() in Server Actions (not just middleware)
- T-01-02-02: timingSafeEqual + padEnd(72)
- T-01-02-03: iron-session HMAC+AES + httpOnly + secure-in-prod + sameSite=lax
- T-01-02-04: Generic "Incorrect password" — no enumeration
- T-01-02-05: iron-session generates fresh seal on every session.save()
- T-01-02-06: Next.js Origin/Host check + sameSite=lax

## Self-Check: PASSED

Files created/exist:
- src/core/auth/session-config.ts: FOUND
- src/core/auth/session.ts: FOUND (rewritten)
- src/features/auth/schema.ts: FOUND
- src/features/auth/service.ts: FOUND
- src/features/auth/actions.ts: FOUND
- src/features/auth/components/login-form.tsx: FOUND
- src/app/login/page.tsx: FOUND
- src/middleware.ts: FOUND

Commits:
- 9e91394: Task 1 — session-config + requireUser rewrite
- 7c51124: Task 2 — auth slice + login page + middleware
