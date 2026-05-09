# Phase 5: Review Queue + Acceptance - Research

**Researched:** 2026-05-09
**Domain:** Review queue UI, structural CI checks, category-based test coverage, Lean acceptance verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
Everything — no user-specified constraints beyond the ROADMAP success criteria and existing codebase conventions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVIEW-01 | `/inbox` page shows low-confidence + unmatched emails with subject, from, body excerpt, suggested classification + confidence, suggested application | Existing `Email` model has all fields; `processing_status='needs_review'` rows populated by Phase 4 `act.ts`; queries pattern established in `applications/queries.ts` |
| REVIEW-02 | Per-row actions: confirm/override/link-to-application/ignore; rate-limit full-body fetch endpoint | Server Action pattern established; `reviewedByUser` field exists on Email; Gmail API `messages.get` for full body; token bucket for rate limiting |
| FND-03 | Test coverage by category: (a) tenant isolation via RLS escape; (b) classifier fixtures per label; (c) matcher per tiebreak path; (d) auto-update + undo race; (e) budget guard; (f) env validation | Most categories already have tests from Phases 1-4; need to verify completeness and fill gaps |
| FND-04 | Pre-commit gate green + structural CI checks: `relforcerowsecurity=true` query, Server-Action-returns-`Result` lint/grep | Pre-commit hook already configured; RLS structural test exists in `rls-escape.test.ts`; need Server-Action-returns-Result structural check |
</phase_requirements>

## Summary

Phase 5 is the final Lean milestone phase — it ships the human-triage surface (`/inbox`), wires structural CI checks, replaces the gameable "30 tests" target with category coverage, and verifies all 12 Lean acceptance criteria end-to-end.

The phase has two distinct workstreams: (1) the `/inbox` review queue UI + actions, and (2) the acceptance/hardening pass (category coverage verification, structural CI checks, Lean acceptance walkthrough). The UI work follows established patterns from Phase 2 (Server Components + Server Actions + shadcn primitives). The hardening work is largely verification of existing tests against the FND-03/FND-04 criteria.

**Primary recommendation:** Build `/inbox` as a thin Server Component page that delegates to `inbox/queries.ts` for data fetching and `inbox/actions.ts` for mutations. Use the same patterns as `/applications` — Server Component page, colocated client components for interactive elements, Server Actions returning `Result<T, AppError>`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | 16.x | Server Components + Server Actions | Already in use; thin pages delegate to slices |
| shadcn/ui | latest | UI primitives (Button, Card, Dialog, Select, Badge) | Already installed; 9 components available |
| Prisma 7 | 7.x | ORM + migrations | Already in use; `@/generated/prisma/client` import |
| neverthrow | latest | `Result<T, AppError>` | Already in use; all services return Result |
| zod | latest | Input validation at boundaries | Already in use; `safeParse` at every boundary |
| Vitest | 4.x | Unit + integration tests | Already configured with Testcontainers |
| pino | latest | Structured logging | Already in use; `logger.child()` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | 4.x | Utility CSS | All component styling |
| lucide-react | latest | Icons (minimal use per DESIGN.md) | Only for functional icons (close, nav) |
| googleapis | latest | Gmail API for full-body fetch | Rate-limited endpoint in `/api/inbox/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Component page | Client Component with useEffect | Server Component is correct — data loads at request time, no client-side fetch needed |
| Server Actions for mutations | Route Handlers | Server Actions are correct for in-app form actions; Route Handlers only for cross-origin or OAuth callbacks |
| Token bucket npm package | Custom implementation | Use custom — simple enough (5 req/sec/user), avoids dependency for a 20-line implementation |

**Installation:**
```bash
# No new dependencies needed — all libraries already installed
```

**Version verification:** All libraries already in `package.json` from Phases 1-4. No version bumps needed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   └── inbox/
│       ├── page.tsx                    # Server Component — data fetch + layout
│       └── full-body/
│           └── route.ts               # Route Handler — rate-limited full-body fetch
├── features/
│   └── inbox/
│       ├── queries.ts                 # NEW — findEmailsForReview, findEmailById
│       ├── actions.ts                 # EXTEND — confirmClassification, overrideClassification, linkToApplication, ignoreEmail
│       ├── components/
│       │   ├── inbox-list.tsx         # Client component — email list with actions
│       │   ├── inbox-row.tsx          # Client component — single email row with actions
│       │   ├── confidence-badge.tsx   # Client component — 3-bar visualization
│       │   ├── classification-select.tsx # Client component — override dropdown
│       │   ├── link-application-dialog.tsx # Client component — link to existing application
│       │   └── degradation-banner.tsx # Server Component — Gmail disconnected banner
│       └── schema.ts                  # EXTEND — add review action schemas
```

### Pattern 1: Inbox Queries (Server-Side Data Fetching)

**What:** Query `processing_status='needs_review'` emails with joined application + company data.
**When to use:** For the `/inbox` page Server Component.
**Example:**
```typescript
// Source: Established pattern from applications/queries.ts
// src/features/inbox/queries.ts

import 'server-only'
import { type Result } from 'neverthrow'
import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { UserId } from '@/core/types/ids'
import type { EmailClassification } from '@/generated/prisma/client'

export type InboxItem = {
  id: number
  subject: string
  from: string
  bodyExcerpt: string
  classification: EmailClassification | null
  confidence: number | null
  classifiedBy: string | null
  applicationId: number | null
  applicationRoleTitle: string | null
  companyName: string | null
  receivedAt: Date
}

export async function findEmailsForReview(
  userId: UserId,
): Promise<Result<InboxItem[], AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.email.findMany({
      where: {
        userId: Number(userId),
        processingStatus: 'needs_review',
      },
      orderBy: { receivedAt: 'desc' },
      include: {
        application: {
          select: {
            id: true,
            roleTitle: true,
            company: { select: { name: true } },
          },
        },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      from: r.from,
      bodyExcerpt: r.bodyExcerpt,
      classification: r.classification,
      confidence: r.confidence,
      classifiedBy: r.classifiedBy,
      applicationId: r.applicationId,
      applicationRoleTitle: r.application?.roleTitle ?? null,
      companyName: r.application?.company.name ?? null,
      receivedAt: r.receivedAt,
    }))
  })
}
```

### Pattern 2: Review Actions (Server Actions)

**What:** Server Actions for confirm/override/link/ignore operations.
**When to use:** For per-row actions in the inbox.
**Example:**
```typescript
// Source: Established pattern from applications/actions.ts + inbox/actions.ts
// src/features/inbox/actions.ts — extend existing file

'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { logger } from '@/core/logger'
import { UserId } from '@/core/types/ids'
import { type Result, ok, err } from 'neverthrow'
import type { AppError } from '@/core/errors'
import type { EmailClassification } from '@/generated/prisma/client'

export async function confirmClassification(
  emailId: number,
): Promise<{ ok: boolean; error?: string }> {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }

  const userId = UserId(userResult.value.id)

  // Mark as reviewed — the classification is already set, we just confirm it
  await tenantDb(userId).email.update({
    where: { id: emailId },
    data: {
      reviewedByUser: true,
      processingStatus: 'acted',
    },
  })

  logger.info({ op: 'inbox.confirmClassification', emailId, userId })
  revalidatePath('/inbox')
  return { ok: true }
}

export async function overrideClassification(
  emailId: number,
  newClassification: EmailClassification,
): Promise<{ ok: boolean; error?: string }> {
  // Similar pattern — update classification + mark reviewed
  // ...
}

export async function ignoreEmail(
  emailId: number,
): Promise<{ ok: boolean; error?: string }> {
  // Mark reviewedByUser=true without changing classification
  // ...
}
```

### Pattern 3: Confidence Visualization (3-Bar Badge)

**What:** Visual confidence indicator — 3 bars (low/medium/high) with exact number on hover.
**When to use:** For each email row in the inbox.
**Example:**
```typescript
// Source: DESIGN.md — "No decorative icons", "Functional icons only"
// src/features/inbox/components/confidence-badge.tsx

'use client'

type Props = {
  confidence: number | null
}

export function ConfidenceBadge({ confidence }: Props) {
  if (confidence === null) return <span className="text-sm text-muted-foreground">—</span>

  // Three tiers: low (<0.5), medium (0.5-0.85), high (>0.85)
  const level = confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low'
  const bars = level === 'high' ? 3 : level === 'medium' ? 2 : 1

  return (
    <div className="group relative flex items-center gap-0.5" title={`${Math.round(confidence * 100)}%`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-3 w-1.5 rounded-sm ${
            i <= bars
              ? level === 'high'
                ? 'bg-green-500'
                : level === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-gray-400'
              : 'bg-gray-200'
          }`}
        />
      ))}
      {/* Exact number on hover — tooltip via CSS, no icon */}
      <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  )
}
```

### Pattern 4: Full-Body Fetch with Rate Limiting

**What:** Route Handler that fetches full email body from Gmail API, rate-limited to 5 req/sec/user via token bucket.
**When to use:** When user clicks "View full email" in the inbox.
**Example:**
```typescript
// Source: PRINCIPLES.md §"Server Actions vs Route Handlers" — cross-origin not needed,
// but this is a read-only fetch that doesn't mutate state, so Route Handler is appropriate.
// src/app/api/inbox/full-body/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/core/auth/session'
import { getGmailClient } from '@/features/inbox/gmail-client'
import { UserId } from '@/core/types/ids'
import { logger } from '@/core/logger'

// Simple in-memory token bucket — 5 tokens per user, refills 5/sec
const buckets = new Map<string, { tokens: number; lastRefill: number }>()

function consumeToken(userId: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(userId) ?? { tokens: 5, lastRefill: now }

  // Refill: 5 tokens per second
  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(5, bucket.tokens + elapsed * 5)
  bucket.lastRefill = now

  if (bucket.tokens < 1) {
    buckets.set(userId, bucket)
    return false
  }

  bucket.tokens -= 1
  buckets.set(userId, bucket)
  return true
}

export async function GET(request: NextRequest) {
  const userResult = await requireUser()
  if (userResult.isErr()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = userResult.value.id
  if (!consumeToken(userId)) {
    return NextResponse.json(
      { error: 'Rate limited — try again in a moment' },
      { status: 429, headers: { 'Retry-After': '1' } },
    )
  }

  const gmailMessageId = request.nextUrl.searchParams.get('messageId')
  if (!gmailMessageId) {
    return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
  }

  const gmailResult = await getGmailClient(UserId(userId))
  if (gmailResult.isErr()) {
    return NextResponse.json(
      { error: 'Gmail disconnected — full bodies unavailable' },
      { status: 503 },
    )
  }

  // Fetch full message from Gmail API
  const gmail = gmailResult.value
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'full',
  })

  // Extract plain text body (reuse gmail-client.ts helper)
  const body = extractPlainTextBody(msg.data.payload)

  return NextResponse.json({ body })
}
```

### Anti-Patterns to Avoid

- **Client-side data fetching for the inbox list:** The inbox page should be a Server Component that fetches data at request time. No `useEffect` + `fetch` for the initial load.
- **Storing full email bodies in the DB:** Per CLAUDE.md privacy rule — store metadata + body excerpt (<=500 chars). Fetch full body via Gmail API on demand.
- **Global state for inbox filters:** Use URL state (`useSearchParams`) for any filtering, not Zustand/Redux. Single-user app with server-rendered data.
- **Icon-heavy UI:** Per DESIGN.md — "No decorative icons", "Text over icons", "Functional icons only". The inbox should use text labels for actions, not icon buttons.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod schemas for review actions | Custom validation | Extend `inbox/schema.ts` with `safeParse` | Already established pattern; single source of truth |
| Gmail API client | Custom HTTP client | `googleapis` package (already installed) | Handles OAuth refresh, pagination, error codes |
| Rate limiting | Custom middleware | In-memory token bucket (20 lines) | Simple enough; no external dependency needed for single-user app |
| Confirmation dialogs | Custom modal | shadcn `Dialog` component (already installed) | Accessible, styled, tested |

**Key insight:** Phase 5 is primarily UI composition + verification. The hard infrastructure (Gmail client, classifier, matcher, act-stage, cron) is already built in Phases 1-4. Phase 5's `/inbox` page is a thin presentation layer over existing data.

## Common Pitfalls

### Pitfall 1: Missing `withRls` in Queries
**What goes wrong:** Queries return zero rows because RLS denies access without the `app.user_id` GUC.
**Why it happens:** Using `tenantDb` alone does not set the GUC; `withRls` wraps the transaction with `set_config`.
**How to avoid:** All inbox queries MUST use `withRls(userId, tx => ...)`, not `tenantDb(userId).*` for read queries. The existing `act.ts` and `matcher/service.ts` already follow this pattern.
**Warning signs:** Empty inbox page when emails exist in the DB.

### Pitfall 2: Race Between Confirm and Next Cron Tick
**What goes wrong:** User confirms a classification in `/inbox`, but the next cron tick re-processes the email before `reviewedByUser=true` is written.
**Why it happens:** The confirm action and the cron tick run concurrently.
**How to avoid:** The confirm action MUST write `reviewedByUser=true` AND `processingStatus='acted'` in the same transaction. The act-stage in `act.ts` already checks `reviewedByUser` before acting (Gate 2 in the 5-gate sequence).
**Warning signs:** Duplicate events or status changes after user confirms.

### Pitfall 3: Full-Body Fetch Without Rate Limiting
**What goes wrong:** User or script hits the full-body endpoint repeatedly, exhausting Gmail API quota (250 units/user/sec).
**Why it happens:** No rate limiting on the endpoint.
**How to avoid:** Token bucket at 5 req/sec/user. Return 429 with `Retry-After` header when exhausted. The bucket is in-memory (single-user, local-only app).
**Warning signs:** Gmail API 429 errors in logs.

### Pitfall 4: Confidence Badge Misleading at Boundaries
**What goes wrong:** Confidence of 0.85 shows as "medium" when it should be "high" (the auto-update threshold).
**Why it happens:** The badge tier boundaries don't match the classifier threshold boundaries.
**How to avoid:** Use the same threshold logic: >=0.85 = high (3 bars), 0.5-0.84 = medium (2 bars), <0.5 = low (1 bar). This matches the `meetsThreshold` logic in `classifier/thresholds.ts`.
**Warning signs:** User sees "medium confidence" on an email that was auto-updated (contradiction).

### Pitfall 5: Degradation Banner Not Showing When Gmail Disconnects
**What goes wrong:** Banner only checks `gmailLastSyncAt` age, not actual connection state.
**Why it happens:** Token health check is time-based, not connection-based.
**How to avoid:** The banner should check BOTH: (1) `gmailRefreshTokenEncrypted` is null (disconnected), OR (2) `gmailLastSyncAt` is >5 days stale. The existing `token-health-banner.tsx` already handles case 2; add case 1 for the inbox context.
**Warning signs:** User sees "Gmail disconnected" banner even though Gmail is connected but slow.

## Runtime State Inventory

> Not applicable — Phase 5 is a greenfield UI + verification phase, not a rename/refactor/migration. No runtime state to inventory.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All code | ✓ | 22.22.0 | — |
| pnpm | Package manager | ✓ | 10.29.3 | — |
| PostgreSQL (Testcontainers) | Integration tests | ✓ | 16 (container) | — |
| Vitest | Test runner | ✓ | 4.x | — |
| Gmail API | Full-body fetch | ✓ | (googleapis installed) | Mock in tests |
| Anthropic API | Classifier (existing) | ✓ | (SDK installed) | Mock in tests |

**Missing dependencies with no fallback:** None — all dependencies are available.

**Missing dependencies with fallback:** None.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in config.json. However, Phase 5's core deliverable IS test coverage verification (FND-03, FND-04). This section documents the existing test infrastructure that Phase 5 verifies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x with Testcontainers |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` (same — all tests are fast with Testcontainers) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVIEW-01 | Inbox shows needs_review emails | integration | `pnpm test:run -- --testPathPattern inbox` | ❌ Wave 0 |
| REVIEW-02 | Per-row actions write reviewedByUser | integration | `pnpm test:run -- --testPathPattern inbox` | ❌ Wave 0 |
| FND-03a | Tenant isolation via RLS escape | integration | `pnpm test:run -- --testPathPattern rls-escape` | ✅ |
| FND-03b | Classifier fixtures per label | integration | `pnpm test:run -- --testPathPattern classifier-fixtures` | ✅ |
| FND-03c | Matcher per tiebreak path | integration | `pnpm test:run -- --testPathPattern matcher-service` | ✅ |
| FND-03d | Auto-update + undo race | integration | `pnpm test:run -- --testPathPattern act-stage` | ✅ (partial — undo race not tested) |
| FND-03e | Budget guard runaway loop | unit | `pnpm test:run -- --testPathPattern budget` | ✅ |
| FND-03f | Env validation per required field | unit | `pnpm test:run -- --testPathPattern env` | ✅ |
| FND-04 | Pre-commit gate + structural CI | structural | `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` | ✅ |

### Wave 0 Gaps
- [ ] `src/features/inbox/queries.ts` — query for needs_review emails
- [ ] `src/features/inbox/components/inbox-list.tsx` — inbox list component
- [ ] `src/features/inbox/components/inbox-row.tsx` — per-row component with actions
- [ ] `src/features/inbox/components/confidence-badge.tsx` — 3-bar confidence visualization
- [ ] `src/features/inbox/components/degradation-banner.tsx` — Gmail disconnected banner
- [ ] `src/app/inbox/page.tsx` — inbox page
- [ ] `src/app/api/inbox/full-body/route.ts` — rate-limited full-body fetch
- [ ] Integration tests for inbox queries + actions
- [ ] Server-Action-returns-Result structural check (grep or ESLint rule)

## Code Examples

Verified patterns from existing codebase:

### Server Component Page Pattern
```typescript
// Source: src/app/settings/page.tsx — established pattern
import { redirect } from 'next/navigation'
import { requireUser } from '@/core/auth/session'
import { tenantDb } from '@/core/db/tenant'
import { UserId } from '@/core/types/ids'

export default async function InboxPage() {
  const userResult = await requireUser()
  if (userResult.isErr()) redirect('/login')

  const userId = UserId(userResult.value.id)
  // ... fetch data, render
}
```

### withRls Query Pattern
```typescript
// Source: src/features/applications/queries.ts — established pattern
import { withRls } from '@/core/db/with-rls'

export async function findEmailsForReview(userId: UserId) {
  return withRls(userId, async (tx) => {
    return tx.email.findMany({
      where: { userId: Number(userId), processingStatus: 'needs_review' },
      orderBy: { receivedAt: 'desc' },
    })
  })
}
```

### Server Action Pattern
```typescript
// Source: src/features/inbox/actions.ts — established pattern
'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/core/auth/session'

export async function confirmClassification(emailId: number) {
  const userResult = await requireUser()
  if (userResult.isErr()) return { ok: false, error: 'Unauthorized' }
  // ... mutate, revalidate
  revalidatePath('/inbox')
  return { ok: true }
}
```

### Integration Test Pattern
```typescript
// Source: tests/integration/act-stage.test.ts — established pattern
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

const ALICE = UserId(1)

async function resetState(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(ALICE)}, true)`
    await tx.email.deleteMany({ where: { userId: Number(ALICE) } })
  })
}

beforeEach(resetState)
afterEach(resetState)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "≥30 tests" count target | Category-based coverage (FND-03 a-f) | Phase 5 design | Prevents gaming; ensures meaningful coverage |
| Single `CLASSIFIER_AUTO_THRESHOLD` | Per-label asymmetric thresholds | Phase 3 (ADR-0012) | Different labels need different confidence levels |
| No structural CI checks | `relforcerowsecurity=true` + Server-Action-returns-Result | Phase 5 | Catches regressions in safety properties |

**Deprecated/outdated:**
- "≥30 tests" target in `docs/milestones/lean.md` acceptance criterion #7: replaced by category coverage in FND-03. The milestone doc should be updated to reflect this.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `inbox/` feature slice already has `act.ts`, `service.ts`, `ingest.ts`, `gmail-client.ts`, `actions.ts`, `schema.ts` from Phase 4 | Summary | Low — verified by reading the files |
| A2 | The `processing_status='needs_review'` rows are populated by Phase 4's `act.ts` | Pattern 1 | Low — verified by reading `act.ts` Gate logic |
| A3 | The `reviewedByUser` field on Email is the idempotency hook for undo + confirm | Pattern 2 | Low — verified by reading `act.ts` Gate 2 |
| A4 | The `token-health-banner.tsx` pattern can be reused for the inbox degradation banner | Pitfall 5 | Low — same time-based check, different context |
| A5 | The in-memory token bucket is sufficient for rate limiting (single-user, local-only app) | Pattern 4 | Low — no multi-user concern in Lean |
| A6 | The `gmail-client.ts` `getGmailClient` returns `err` when Gmail is disconnected | Pattern 4 | Low — verified by reading the function |

## Open Questions

1. **Should the inbox page show ALL needs_review emails or only recent ones?**
   - What we know: The requirements say "low-confidence + unmatched emails" without a time limit.
   - What's unclear: Whether to paginate or limit to recent emails.
   - Recommendation: Show all needs_review emails (likely <100 in practice for a single user). Add pagination only if the list grows beyond 50 items.

2. **Should "link to application" support creating a new application inline?**
   - What we know: REVIEW-02 says "link to existing Application" — implies selecting from existing.
   - What's unclear: Whether inline creation is in scope.
   - Recommendation: Out of scope for Lean. The user can create the application first, then link. Keep the link dialog as a simple searchable dropdown of existing applications.

3. **How should the degradation banner interact with the existing token-health-banner?**
   - What we know: The settings page already has a `token-health-banner.tsx` that warns about stale sync.
   - What's unclear: Whether the inbox should reuse the same component or have its own.
   - Recommendation: The inbox banner is different — it warns about Gmail being disconnected (not just stale). Create a separate `degradation-banner.tsx` in `inbox/components/` that checks `gmailRefreshTokenEncrypted` is null OR `gmailLastSyncAt` is null.

## Sources

### Primary (HIGH confidence)
- Existing codebase files (read directly): `src/features/inbox/`, `src/features/applications/`, `src/features/classifier/`, `src/features/matcher/`, `src/core/db/`, `prisma/schema.prisma`
- Project docs: `PRINCIPLES.md`, `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `docs/milestones/lean.md`
- Phase 4 plans and research: `.planning/phases/04-gmail-ingestion-pipeline-cron/`

### Secondary (MEDIUM confidence)
- None — all findings are from direct codebase inspection.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns established in Phases 1-4, directly reusable
- Pitfalls: HIGH — derived from existing code patterns and PRINCIPLES.md

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable — codebase patterns won't change until Standard milestone)
