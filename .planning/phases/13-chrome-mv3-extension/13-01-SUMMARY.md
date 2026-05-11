---
phase: 13-chrome-mv3-extension
plan: 01
subsystem: auth
tags: [api-token, capture-api, settings, rls]
---

# Phase 13 Plan 01: Token Infrastructure + Capture Route Auth Summary

Completed bearer-token infrastructure for the Chrome extension capture API.

## Accomplishments

- Added `extensionApiTokenHash` to `User` and created the migration for `extension_api_token_hash`.
- Added `src/core/auth/api-token.ts` with 32-byte token generation, `scrypt` hashing, verification, lookup, storage, and revoke helpers.
- Added token hash DB helpers under `src/core/db/api-token-store.ts`.
- Updated `/api/capture` to accept `Authorization: Bearer <token>` while preserving no-auth bookmarklet compatibility.
- Added `Authorization` to CORS preflight headers.
- Added Settings UI and Server Actions for generate, regenerate, one-time display/copy, and revoke.
- Added English, Vietnamese, and Indonesian message keys for the extension token section.

## Verification

- `pnpm test:run -- tests/integration/extension-capture.test.ts src/core/auth/api-token.test.ts tests/integration/capture.test.ts` passed as part of the full Vitest run.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.

## Notes

- Token hashes are stored only in the database; raw tokens are shown once after generation.
- Token lookup now runs through RLS-aware DB helpers for the single seeded owner user.
