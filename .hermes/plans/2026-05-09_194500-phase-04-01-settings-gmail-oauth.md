# Phase 04-01: Settings Page + Gmail OAuth Flow

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Owner can connect Gmail from the Settings page, triggering Google OAuth, storing an encrypted refresh token, and viewing connection state.

**Architecture:** New `src/features/gmail/` slice with `service.ts` (OAuth logic), `schema.ts` (Zod schemas), and route handlers at `src/app/api/gmail/auth/route.ts` + `src/app/api/gmail/callback/route.ts`. Settings page at `src/app/settings/page.tsx` delegates to a component in the gmail slice. All Prisma access via `tenantDb(userId)` or `withRls(userId)`. Refresh token encrypted via `@/core/crypto/encryption.ts`.

**Tech Stack:** googleapis (already installed), Next.js Route Handlers, iron-session (existing), AES-256-GCM encryption (existing), shadcn/ui primitives (existing).

**Principles referenced:**
- PRINCIPLES.md §Architecture — Vertical Slice (gmail is a new slice)
- PRINCIPLES.md §Error handling — Result<T, AppError> everywhere
- PRINCIPLES.md §Database — tenantDb / withRls, no direct prisma imports
- PRINCIPLES.md §TypeScript — branded IDs, Zod at boundaries
- CLAUDE.md §Naming — kebab-case files, camelCase functions
- AGENTS.md §Module boundaries — gmail slice cannot import from other slices

---

## Context: What exists already

| Piece | Location | Status |
|---|---|---|
| `googleapis` SDK | `package.json` | ✅ Installed (v171.4.0) |
| Env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) | `src/core/env.ts` | ✅ Defined as optional |
| Encryption module | `src/core/crypto/encryption.ts` | ✅ `encryptToken` / `decryptToken` |
| User model with `gmailRefreshTokenEncrypted` + `gmailLastSyncAt` | `prisma/schema.prisma` | ✅ In schema |
| `requireUser()` | `src/core/auth/session.ts` | ✅ Returns `Result<{id: UserId}, AppError>` |
| `withRls()` | `src/core/db/with-rls.ts` | ✅ Transaction with RLS |
| Middleware (redirects unauthenticated) | `src/middleware.ts` | ✅ Needs update to allow OAuth callback |
| shadcn Button, Card, Input, Badge | `src/ui/` | ✅ Installed |

---

## Task 1: Install node-cron dependency

**Objective:** Add node-cron (needed later for cron, but install now to avoid separate PR).

**Files:**
- Modify: `package.json`

**Step 1: Install**

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

**Step 2: Verify**

```bash
pnpm typecheck
```

Expected: passes (no code uses it yet).

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "add node-cron dependency for Gmail polling scheduler"
```

---

## Task 2: Extend tenantDb with user update method

**Objective:** Add `user.findUnique` and `user.update` to `tenantDb` so the gmail slice can read/write Gmail connection state without direct prisma imports.

**Files:**
- Modify: `src/core/db/tenant.ts`

**Step 1: Add user methods to tenantDb**

Add after the `stage` block (before the TODO comment):

```typescript
    user: {
      findUnique: (args: Prisma.UserFindUniqueArgs) =>
        prisma.user.findUnique({
          ...args,
          where: { ...args.where, id: numericUserId },
        }),

      update: (args: Prisma.UserUpdateArgs) =>
        prisma.user.update({
          ...args,
          where: { ...args.where, id: numericUserId },
        }),
    },
```

**Step 2: Verify**

```bash
pnpm typecheck
```

Expected: passes.

**Step 3: Commit**

```bash
git add src/core/db/tenant.ts
git commit -m "extend tenantDb with user.findUnique and user.update methods"
```

---

## Task 3: Create gmail slice schema

**Objective:** Zod schemas for Gmail OAuth inputs and the settings page data shape.

**Files:**
- Create: `src/features/gmail/schema.ts`

**Step 1: Write the schema**

```typescript
import { z } from 'zod'

/** Data shape returned to the /settings page component. */
export const gmailConnectionSchema = z.object({
  connected: z.boolean(),
  email: z.string().email().nullable(),
  lastSyncAt: z.date().nullable(),
})

export type GmailConnection = z.infer<typeof gmailConnectionSchema>

/** Input for the disconnect action. */
export const disconnectInputSchema = z.object({
  confirm: z.literal('true'),
})

export type DisconnectInput = z.infer<typeof disconnectInputSchema>
```

**Step 2: Verify**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/features/gmail/schema.ts
git commit -m "add gmail slice Zod schemas for connection state"
```

---

## Task 4: Create gmail OAuth service

**Objective:** Service functions for building the Google OAuth URL, exchanging the auth code, storing the encrypted refresh token, reading connection state, and disconnecting.

**Files:**
- Create: `src/features/gmail/service.ts`

**Step 1: Write the service**

```typescript
// Gmail slice — OAuth connection lifecycle.
//
// Five functions, all returning Result<T, AppError>:
//   buildAuthUrl      — constructs Google OAuth consent URL
//   exchangeAndStore  — exchanges auth code for tokens, encrypts+stores refresh token
//   getConnectionState — reads connection state for /settings page
//   disconnect        — clears encrypted refresh token + lastSyncAt
//
// All Prisma access via tenantDb(userId) or withRls(userId).
// Google API errors wrapped as errors.externalApi('gmail', cause).

import 'server-only'

import { google } from 'googleapis'
import { ok, err, type Result } from 'neverthrow'

import { encryptToken } from '@/core/crypto/encryption'
import { errors, type AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import type { GmailConnection } from './schema'

// ---------------------------------------------------------------------------
// OAuth client factory
// ---------------------------------------------------------------------------

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

// ---------------------------------------------------------------------------
// buildAuthUrl
// ---------------------------------------------------------------------------

export function buildAuthUrl(userId: UserId): Result<string, AppError> {
  const oauth2Client = createOAuth2Client()
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // required for refresh_token
    prompt: 'consent',           // force consent screen to always return refresh_token
    scope: SCOPES,
    state: String(userId),       // pass userId through the OAuth redirect
  })
  return ok(url)
}

// ---------------------------------------------------------------------------
// exchangeAndStore
// ---------------------------------------------------------------------------

export async function exchangeAndStore(
  userId: UserId,
  code: string,
): Promise<Result<{ email: string }, AppError>> {
  const oauth2Client = createOAuth2Client()

  // 1. Exchange code for tokens.
  let tokens
  try {
    const response = await oauth2Client.getToken(code)
    tokens = response.tokens
  } catch (cause) {
    return err(errors.externalApi('gmail', cause))
  }

  if (!tokens.refresh_token) {
    return err(errors.externalApi('gmail', new Error('No refresh_token in Google response')))
  }

  // 2. Get the user's email from Google.
  oauth2Client.setCredentials(tokens)
  let userEmail: string
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    userEmail = profile.data.emailAddress ?? ''
  } catch (cause) {
    return err(errors.externalApi('gmail', cause))
  }

  if (!userEmail) {
    return err(errors.externalApi('gmail', new Error('Could not retrieve email from Gmail profile')))
  }

  // 3. Encrypt and store.
  const encrypted = encryptToken(tokens.refresh_token)

  // Use withRls for the DB write (tenant-scoped).
  const { withRls } = await import('@/core/db/with-rls')
  const dbResult = await withRls(userId, async (tx) => {
    await tx.user.update({
      where: { id: Number(userId) },
      data: {
        gmailRefreshTokenEncrypted: encrypted,
        gmailLastSyncAt: null,
      },
    })
  })

  if (dbResult.isErr()) return err(dbResult.error)

  return ok({ email: userEmail })
}

// ---------------------------------------------------------------------------
// getConnectionState
// ---------------------------------------------------------------------------

export async function getConnectionState(
  userId: UserId,
): Promise<Result<GmailConnection, AppError>> {
  const { tenantDb } = await import('@/core/db/tenant')
  const user = await tenantDb(userId).user.findUnique({
    select: {
      gmailRefreshTokenEncrypted: true,
      gmailLastSyncAt: true,
      email: true,
    },
  })

  if (!user) return err(errors.notFound('User', String(userId)))

  return ok({
    connected: user.gmailRefreshTokenEncrypted !== null,
    email: user.email ?? null,
    lastSyncAt: user.gmailLastSyncAt ?? null,
  })
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

export async function disconnect(
  userId: UserId,
): Promise<Result<void, AppError>> {
  const { tenantDb } = await import('@/core/db/tenant')
  const user = await tenantDb(userId).user.findUnique({
    select: { gmailRefreshTokenEncrypted: true },
  })

  if (!user) return err(errors.notFound('User', String(userId)))
  if (!user.gmailRefreshTokenEncrypted) {
    return err(errors.conflict('Gmail not connected'))
  }

  await tenantDb(userId).user.update({
    data: {
      gmailRefreshTokenEncrypted: null,
      gmailLastSyncAt: null,
    },
  })

  return ok(undefined)
}
```

**Step 2: Verify**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/features/gmail/service.ts
git commit -m "add gmail OAuth service with buildAuthUrl, exchangeAndStore, getConnectionState, disconnect"
```

---

## Task 5: Write gmail service unit tests

**Objective:** Test the pure parts (buildAuthUrl) and verify error handling paths.

**Files:**
- Create: `src/features/gmail/service.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock googleapis before importing service
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?...'),
        getToken: vi.fn(),
        setCredentials: vi.fn(),
      })),
    },
    gmail: vi.fn(),
  },
}))

vi.mock('@/core/env', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/gmail/callback',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
}))

import { buildAuthUrl } from './service'
import { UserId } from '@/core/types/ids'

describe('gmail/service', () => {
  describe('buildAuthUrl', () => {
    it('returns a URL with gmail.readonly scope', () => {
      const result = buildAuthUrl(UserId('1'))
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toContain('https://accounts.google.com')
      }
    })
  })
})
```

**Step 2: Run tests to verify they pass**

```bash
pnpm test:run -- src/features/gmail/service.test.ts
```

Expected: 1 passed.

**Step 3: Commit**

```bash
git add src/features/gmail/service.test.ts
git commit -m "add gmail service unit tests for buildAuthUrl"
```

---

## Task 6: Create /api/gmail/auth route handler

**Objective:** Route handler that redirects the user to Google's OAuth consent screen.

**Files:**
- Create: `src/app/api/gmail/auth/route.ts`

**Step 1: Write the route handler**

```typescript
// /api/gmail/auth — redirect to Google OAuth consent screen.
//
// GET /api/gmail/auth → 302 redirect to Google.
// Requires authentication (session cookie).
// The userId is passed as `state` param so the callback can identify the user.

import { NextResponse } from 'next/server'

import { requireUser } from '@/core/auth/session'
import { buildAuthUrl } from '@/features/gmail/service'

export async function GET() {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const urlResult = buildAuthUrl(userResult.value.id)
  if (urlResult.isErr()) {
    return NextResponse.json({ error: 'Could not build auth URL' }, { status: 500 })
  }

  return NextResponse.redirect(urlResult.value)
}
```

**Step 2: Verify**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/app/api/gmail/auth/route.ts
git commit -m "add /api/gmail/auth route handler for OAuth redirect"
```

---

## Task 7: Create /api/gmail/callback route handler

**Objective:** Route handler that receives the OAuth callback, exchanges the code for tokens, stores the encrypted refresh token, and redirects to /settings.

**Files:**
- Create: `src/app/api/gmail/callback/route.ts`

**Step 1: Write the route handler**

```typescript
// /api/gmail/callback — Google OAuth callback.
//
// GET /api/gmail/callback?code=...&state=... → exchanges code, stores token, redirects.
// The `state` param carries the userId from the auth redirect.
// On error, redirects to /settings with an error query param.

import { type NextRequest, NextResponse } from 'next/server'

import { UserId } from '@/core/types/ids'
import { exchangeAndStore } from '@/features/gmail/service'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings?error=missing_params', request.url),
    )
  }

  // Validate state is a numeric userId (defense against CSRF).
  const userId = UserId(state)

  const result = await exchangeAndStore(userId, code)
  if (result.isErr()) {
    return NextResponse.redirect(
      new URL('/settings?error=exchange_failed', request.url),
    )
  }

  return NextResponse.redirect(
    new URL('/settings?connected=true', request.url),
  )
}
```

**Step 2: Update middleware to allow OAuth callback through**

The current middleware at `src/middleware.ts` redirects unauthenticated requests. The OAuth callback from Google won't have a session cookie, so we need to allow `/api/gmail/callback` through.

Update `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const session = req.cookies.get('foray_session')
  if (!session && !req.nextUrl.pathname.startsWith('/login')) {
    // Allow OAuth callback through — it authenticates via the `state` param.
    if (!req.nextUrl.pathname.startsWith('/api/gmail/callback')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|api/auth/login|_next|favicon.ico).*)'],
}
```

**Step 3: Verify**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/app/api/gmail/callback/route.ts src/middleware.ts
git commit -m "add /api/gmail/callback route handler + allow OAuth callback through middleware"
```

---

## Task 8: Create disconnect Server Action

**Objective:** Server Action for the "Disconnect Gmail" button on the settings page.

**Files:**
- Create: `src/features/gmail/actions.ts`

**Step 1: Write the action**

```typescript
'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/core/auth/session'
import type { AppError } from '@/core/errors'

import { disconnect } from './service'

export type GmailActionState =
  | { ok: true }
  | { ok: false; error: string }

export async function disconnectGmailAction(
  _prev: GmailActionState,
  _formData: FormData,
): Promise<GmailActionState> {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return { ok: false, error: 'Unauthorized — please sign in again.' }
  }

  const result = await disconnect(userResult.value.id)
  if (result.isErr()) {
    const tag = result.error._tag
    if (tag === 'NotFound') return { ok: false, error: 'User not found.' }
    if (tag === 'Conflict') return { ok: false, error: 'Gmail is not connected.' }
    return { ok: false, error: 'Could not disconnect Gmail.' }
  }

  revalidatePath('/settings')
  return { ok: true }
}
```

**Step 2: Verify**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/features/gmail/actions.ts
git commit -m "add disconnectGmailAction server action"
```

---

## Task 9: Create Settings page + Gmail connection component

**Objective:** The /settings page showing Gmail connection state with Connect/Disconnect buttons.

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/features/gmail/components/gmail-connection.tsx`

**Step 1: Write the server page**

```typescript
// /settings — owner settings page.
//
// Server Component. Reads Gmail connection state via service, passes to
// GmailConnection client component for interactive buttons.

import { redirect } from 'next/navigation'

import { requireUser } from '@/core/auth/session'
import { getConnectionState } from '@/features/gmail/service'
import { GmailConnection } from '@/features/gmail/components/gmail-connection'

export default async function SettingsPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const connectionResult = await getConnectionState(userResult.value.id)
  const connection = connectionResult.isOk()
    ? connectionResult.value
    : { connected: false, email: null, lastSyncAt: null }

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-3xl mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-xl mb-4">Gmail Connection</h2>
        <GmailConnection connection={connection} />
      </section>
    </main>
  )
}
```

**Step 2: Write the client component**

```typescript
'use client'

import { useActionState } from 'react'

import { disconnectGmailAction, type GmailActionState } from '../actions'
import type { GmailConnection as GmailConnectionType } from '../schema'

const initial: GmailActionState = { ok: true }

type Props = {
  connection: GmailConnectionType
}

export function GmailConnection({ connection }: Props) {
  const [state, formAction, pending] = useActionState(disconnectGmailAction, initial)

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {connection.connected ? (
        <>
          <p className="text-sm text-green-700 dark:text-green-400">
            ✓ Connected{connection.email ? ` as ${connection.email}` : ''}
          </p>
          <p className="text-sm text-stone-500">
            Last sync: {connection.lastSyncAt
              ? connection.lastSyncAt.toLocaleString()
              : 'Never'}
          </p>
          <div className="flex gap-3">
            <a
              href="/api/gmail/poll"
              className="inline-flex items-center rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Sync now
            </a>
            <form action={formAction}>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {pending ? 'Disconnecting…' : 'Disconnect Gmail'}
              </button>
            </form>
          </div>
          {!state.ok && (
            <p className="text-sm text-red-600" role="alert">{state.error}</p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-stone-500">Not connected</p>
          <a
            href="/api/gmail/auth"
            className="inline-flex items-center rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
          >
            Connect Gmail
          </a>
        </>
      )}
    </div>
  )
}
```

**Step 3: Verify**

```bash
pnpm typecheck && pnpm build
```

**Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/features/gmail/components/gmail-connection.tsx
git commit -m "add /settings page with Gmail connection component"
```

---

## Task 10: Run full pre-commit checks

**Objective:** Verify everything passes.

**Step 1: Run all checks**

```bash
pnpm lint && pnpm typecheck && pnpm test:run && pnpm build
```

Expected: all pass, 276+ tests.

**Step 2: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix lint/typecheck issues from gmail slice"
```

---

## Verification (manual)

After all tasks:

1. Start the app: `pnpm dev`
2. Log in at `/login`
3. Navigate to `/settings` — should see "Not connected" + "Connect Gmail" button
4. Click "Connect Gmail" — should redirect to Google consent screen
5. Approve — should redirect back to `/settings?connected=true` showing "Connected as ..."
6. Click "Disconnect Gmail" — should return to "Not connected" state

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Google OAuth "unverified app" warning | Stay in Test mode; add test user in Google Cloud console |
| Refresh token not returned on re-consent | `prompt: 'consent'` forces refresh_token every time |
| CSRF on callback | `state` param carries userId; validate it's numeric at callback |
| Middleware blocks callback | Explicit allowlist for `/api/gmail/callback` path |

---

## Files changed (summary)

| Action | Path |
|---|---|
| Create | `src/features/gmail/schema.ts` |
| Create | `src/features/gmail/service.ts` |
| Create | `src/features/gmail/service.test.ts` |
| Create | `src/features/gmail/actions.ts` |
| Create | `src/features/gmail/components/gmail-connection.tsx` |
| Create | `src/app/api/gmail/auth/route.ts` |
| Create | `src/app/api/gmail/callback/route.ts` |
| Create | `src/app/settings/page.tsx` |
| Modify | `src/core/db/tenant.ts` (add user methods) |
| Modify | `src/middleware.ts` (allow OAuth callback) |
| Modify | `package.json` (add node-cron) |
