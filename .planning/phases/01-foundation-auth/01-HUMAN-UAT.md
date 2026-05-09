---
status: partial
phase: 01-foundation-auth
source: [01-VERIFICATION.md]
started: 2026-05-09T15:10:00Z
updated: 2026-05-09T15:10:00Z
---

## Current Test

[awaiting human testing — deferred until before merge or phase 5 acceptance]

## Tests

### 1. Login flow with correct APP_PASSWORD
expected: Submit `/login` form with the correct `APP_PASSWORD` value in a browser. Cookie `foray_session` is set (httpOnly, sameSite=lax, ~30-day maxAge); page redirects to `/applications`.
result: pending

### 2. Unauthenticated redirect to /login
expected: Navigate directly to a protected route (e.g. `/applications`) while unauthenticated in a browser. Middleware redirects browser to `/login`.
result: pending

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
