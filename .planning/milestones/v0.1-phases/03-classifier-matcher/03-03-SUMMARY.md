---
phase: 03-classifier-matcher
plan: 03
subsystem: matcher
tags: [matcher, vertical-slice, locked-tiebreak, ats-domain-skip, rls-defense-in-depth, fail-closed, read-only]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: withRls() helper (FORCE-RLS-aware transaction wrapper), errors taxonomy (Validation, Db), branded UserId/ApplicationId, server-only mock
  - phase: 02-applications-slice
    provides: isAtsDomain() from src/core/domains/ats-domains.ts, Email + Application + Company schemas, Testcontainers seed (alice + bob)
provides:
  - "matchEmail({userId, gmailThreadId, fromDomain}) — Phase 4 import for the match stage"
  - "matchEmailInputSchema — Zod validator at the slice boundary"
  - "MatchEmailInput / MatchEmailOutput types"
  - "Locked 4-step tiebreak: thread continuity → ATS skip → domain match → unmatched"
affects: [04-gmail-pipeline]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — neverthrow + zod already present; reuses Phase 1 withRls + Phase 2 isAtsDomain
  patterns:
    - "Read-only matcher slice: zero writes (Phase 4's act-stage owns the email.applicationId write)"
    - "ATS short-circuit BEFORE domain query — Pitfall #5 defense-in-depth (refuses false-attribution even if Phase 2 capture validation gets bypassed)"
    - "withRls(userId, ...) for ALL Prisma access (FORCE-RLS-aware) — established pattern from applications/queries.ts"
    - "Most-recent tiebreak semantics — orderBy.receivedAt for thread emails; orderBy.appliedAt for multi-app domain matches"

key-files:
  created:
    - "src/features/matcher/schema.ts (35 LOC) — matchEmailInputSchema + MatchEmailInput/Output types"
    - "src/features/matcher/service.ts (97 LOC) — matchEmail() with locked 4-step tiebreak"
    - "tests/integration/matcher-service.test.ts (~395 LOC) — 9 integration tests, all 4 paths + RLS + edge cases"
  modified: []

key-decisions:
  - "Use withRls (not tenantDb) inside service.ts — runtime DATABASE_URL is foray_app (non-superuser, FORCE RLS active); without the app.user_id GUC set, RLS denies all rows. tenantDb is the wrong abstraction for this codebase's RLS-active runtime; withRls is the established pattern (applications/queries.ts). Documented as deviation Rule 1."
  - "Type-assert the include payload from tx.company.findFirst — surgical workaround per CLAUDE.md §1.3. Extending the wrapper to be generic was out of scope (and unnecessary once tenantDb usage was dropped, since tx.company.findFirst returns the full Prisma generic)."
  - "Preserve the schema's userId as a plain z.string().min(1) (not z.brand) so already-branded UserId values from the caller round-trip without re-running the regex validator. Restore the brand at the type-system boundary via 'as UserId'. Threat T-03-03-04 documents this as accepted risk for the internal-only contract."

patterns-established:
  - "Read-only feature slice: schema.ts + service.ts only (no actions.ts, no queries.ts) — applies to any future read-only RPC-shaped function called from another slice's orchestrator (Phase 4)."
  - "ATS skip is not validation — it's defense-in-depth at the matcher layer because Company.domain MIGHT contain an ATS domain (Phase 2 blocks at capture but the matcher refuses to attribute regardless)."

requirements-completed: [MATCH-01, MATCH-02, MATCH-03]

# Metrics
duration: 6m 17s
completed: 2026-05-09
---

# Phase 03 Plan 03: Matcher Slice Summary

**Read-only matcher slice with the LOCKED 4-step tiebreak — thread continuity wins, ATS-domain emails short-circuit before any company lookup (Pitfall #5 defense), sender-domain match returns the most-recent application, and "unmatched" is a normal `ok` outcome (NOT an error). All Prisma access goes through `withRls` so FORCE RLS on `foray_app` fires correctly.**

## Performance

- **Duration:** 6 min 17 sec
- **Started:** 2026-05-09T11:59:22Z
- **Completed:** 2026-05-09T12:05:39Z
- **Tasks:** 2 (autonomous, no checkpoints)
- **Files created:** 3 (1 schema + 1 service + 1 integration test)
- **Files modified:** 0
- **Tests added:** 9 integration tests (T1–T9) — exceeds the ≥6 floor
- **Total test suite:** 231 passing / 235 (4 pre-existing TODO)

## Accomplishments

- **`matchEmail({userId, gmailThreadId, fromDomain})` — Phase 4 import surface ready.** Returns `Promise<Result<{applicationId: ApplicationId | null}, AppError>>`. `null` is `ok`, NOT `err` — "unmatched" is a normal outcome.
- **The LOCKED 4-step tiebreak is encoded as 4 sequential checks in one function.** No additional strategies; no display-name extraction (deferred to Standard milestone per CONTEXT §"Claude's Discretion"). Steps:
  1. **Thread continuity** — `tx.email.findFirst({where: {gmailThreadId, applicationId: {not: null}}, orderBy: {receivedAt: 'desc'}})`. Most-recent linked email wins.
  2. **ATS-domain skip** — `if (isAtsDomain(fromDomain)) return null`. Fires BEFORE step 3. Defense-in-depth against Pitfall #5.
  3. **Sender-domain match** — `tx.company.findFirst({where: {domain: fromDomain}, include: {applications: {orderBy: {appliedAt: 'desc'}, take: 1}}})`. Returns the most-recent application's id.
  4. **Unmatched** — return `ok({applicationId: null})`.
- **9 integration tests cover every path + every documented edge.** T3 + T9 are the regression fences for Pitfall #5 (false-attribution to ATS-shaped domains). T5 is the regression fence for Pitfall #2/#9 (multi-tenant cross-leak via either tiebreak step).
- **Zero direct Prisma imports.** All access via `withRls` from `@/core/db/with-rls` — depcheck Rule 4 (`no-direct-prisma`) clean.
- **Pre-commit gate green:** `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck` — all five steps clean (only the pre-existing `middleware.ts` orphan warning).

## Task Commits

Each task committed atomically.

1. **Task 1: matcher schema + service implementation** — `886f684` (feat)
2. **Task 2: 9 integration tests + RLS access-pattern fix** — `c30231f` (test)

_Both commits pass `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck`._

## Files Created/Modified

### Created (3)

- `src/features/matcher/schema.ts` — `matchEmailInputSchema` (Zod, validates non-empty userId/threadId/fromDomain) + `MatchEmailInput` + `MatchEmailOutput` types. Documents the "caller is responsible for normalizing fromDomain" contract in JSDoc.
- `src/features/matcher/service.ts` — `matchEmail()` with the locked 4-step tiebreak. Uses `withRls(userId, async tx => ...)` so `app.user_id` is set inside the Postgres transaction and FORCE RLS fires correctly. Imports `isAtsDomain` from `@/core/domains/ats-domains` (Phase 2 deliverable). Returns `Result<MatchEmailOutput, AppError>`.
- `tests/integration/matcher-service.test.ts` — 9 tests against Testcontainers Postgres seeded by `tests/integration/setup.ts`. `resetAliceMatcherState()` helper preserves the seeded `Alice Test Role` + `Alice Corp` fixtures so other test files still pass; bob's seed row stays untouched throughout. T5 seeds bob-specific matcher fixtures inside the test body via `withRls(BOB)`.

### Modified (0)

No files modified. Phase 1 + Phase 2 deliverables (`withRls`, `isAtsDomain`, `errors`, branded IDs, Testcontainers seed) are reused as-is.

### Function signatures (Phase 4 import surface)

```ts
// schema.ts
export const matchEmailInputSchema = z.object({
  userId: z.string().min(1),
  gmailThreadId: z.string().min(1),
  fromDomain: z.string().min(1),
})
export type MatchEmailInput = z.infer<typeof matchEmailInputSchema>
export type MatchEmailOutput = { applicationId: ApplicationId | null }

// service.ts
export async function matchEmail(
  rawInput: MatchEmailInput,
): Promise<Result<MatchEmailOutput, AppError>>
```

### Test count breakdown

| ID | Path | What it verifies |
|----|------|------------------|
| T1 | thread continuity | Wins over domain match even when fromDomain ALSO matches a stored Company |
| T2 | domain match (no thread) | Most-recent application returned |
| T3 | ATS-domain skip | `greenhouse.io` short-circuits even when stored as Company.domain |
| T4 | unmatched | `ok({applicationId: null})` — null is NOT an error |
| T5 | RLS isolation | alice's matcher returns null for bob's gmailThreadId AND bob's fromDomain |
| T6 | validation | Empty input rejected with `_tag: 'Validation'` |
| T7 | multi-app company | Most-recent application returned (orderBy appliedAt desc, take 1) |
| T8 | multi-email thread | Most-recent thread email wins (orderBy receivedAt desc) |
| T9 | ATS subdomain | `us.greenhouse.io` short-circuits via `isAtsDomain` subdomain match |

## Decisions Made

1. **withRls instead of tenantDb (deviation Rule 1).** The plan's CONTEXT pseudo-code prescribed `tenantDb(userId)`. At runtime the DATABASE_URL points to `foray_app` (non-superuser, FORCE RLS active). Without `set_config('app.user_id', ..., true)` set inside a transaction, RLS denies every row → tenantDb returned `null` for all 4 lookups. The fix is to use `withRls(userId, async tx => ...)`, the established pattern in `applications/queries.ts` and `applications/notes-service.ts`. Module-boundary contract preserved: zero direct `prisma.*` imports outside `core/db/`.
2. **Type-assert the `include` payload from `tx.company.findFirst`.** The Prisma generic for `findFirst` widens correctly when `include` is supplied, but a cast is still needed because the schema doesn't track the dynamic generic through our service signature. Cast is one line, surgical, and isolates the type lie at the boundary. CLAUDE.md §1.3 (surgical) takes precedence over fully-generic wrapper extension.
3. **Schema validates userId as plain `z.string().min(1)`, not `z.brand`.** The caller (Phase 4) passes an already-branded `UserId`. Re-running the brand validator inside `safeParse` would throw on inputs the caller already validated. Documented in T-03-03-04 as accepted risk for the internal-only contract.
4. **Preserve "unmatched is `ok(null)`, not `err(...)`".** Per CONTEXT §Area 5 + threat-model entry T-03-03-05: unmatched emails go to the review queue in Phase 4, not an error path. The `Result` type signals "the function ran successfully and the answer is null".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] CONTEXT pseudo-code prescribed `tenantDb`, runtime requires `withRls`**
- **Found during:** Task 2 (running integration tests — T1, T2, T7, T8 all returned `null` when they should have matched).
- **Issue:** The plan's CONTEXT §Area 5 pseudo-code uses `tenantDb(userId)` for both `email.findFirst` and `company.findFirst`. The plan's `must_haves.truths` reinforces this with "All Prisma access via tenantDb(userId)". But the runtime DATABASE_URL points to `foray_app` (non-superuser, FORCE RLS active per Phase 1 plan 03's RLS migration). `tenantDb` uses the global `prisma` client *without* setting `app.user_id` first; RLS then denies all rows. Result: every matcher lookup returned `null`, and 4 of 9 tests failed.
- **Fix:** Refactored `service.ts` to use `withRls(userId, async tx => ...)`. `withRls` opens a Prisma transaction and runs `SELECT set_config('app.user_id', ${userId}, true)` first, so RLS honors the GUC for the duration of the transaction. This is the established pattern across `applications/queries.ts`, `applications/notes-service.ts`, and `applications/service.ts`. The auto-userId-injection that `tenantDb` provided is now redundant (RLS does the same job at the database layer), so dropping it is no semantic loss — the multi-tenant safety promise is fully preserved by the GUC-fenced transaction.
- **Files modified:** `src/features/matcher/service.ts` (refactored before final commit; never landed broken).
- **Verification:** All 9 integration tests pass. T5 still verifies cross-tenant isolation (now backed by RLS at the DB layer, not just the wrapper).
- **Committed in:** `c30231f` (Task 2 commit). The Task 1 commit (`886f684`) shipped the tenantDb version because the bug only surfaced when integration tests ran in Task 2.

**2. [Rule 1 — Bug] `tdb.company.findFirst` return type didn't track `include` payload**
- **Found during:** Task 1 (`pnpm typecheck` — `Property 'applications' does not exist on type Company`).
- **Issue:** The `tenantDb.company.findFirst` wrapper was typed as `(args: Prisma.CompanyFindFirstArgs = {}) => Promise<Company | null>`, which strips the dynamic `include` generic. Once Deviation #1 above moved access to `tx.company.findFirst` (Prisma's generic-tracking method), the issue was effectively resolved. But the explicit cast was kept on the `await tx.company.findFirst({ ... include: ... })` result for clarity (the cast also documents the exact shape the rest of the function depends on).
- **Fix:** Type-assert the result as `{ id: number; applications: { id: number }[] } | null`.
- **Files modified:** `src/features/matcher/service.ts` (one cast).
- **Verification:** `pnpm typecheck` clean.
- **Committed in:** Both `886f684` and `c30231f` (refactored alongside Deviation #1).

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for correctness. The plan's prescribed pattern (`tenantDb`) is incorrect for the actual runtime constraints — Phase 1 plan 03 introduced FORCE RLS, but the Phase 3 CONTEXT was written before that landed and never updated. No scope creep; both fixes contained within the plan's named files.

**Plan-document accuracy note:** The plan's `must_haves.truths` line "All Prisma access via tenantDb(userId)" is no longer accurate — the matcher uses `withRls`. The depcheck Rule 4 invariant ("zero direct prisma.* imports outside core/db/") IS preserved (verified). Future plans (Phase 4) should reference `withRls` as the canonical pattern, not `tenantDb`. Recommend a CONTEXT update for Phase 4 plans to drop `tenantDb` references in favor of `withRls`.

## Issues Encountered

- **`tenantDb` is unused in production code.** During execution I discovered no other `src/features/` file imports `tenantDb` at runtime — every existing service uses `withRls`. The `tenantDb` wrapper survives as scaffolding but currently has no consumer. Recommend either deleting it (if confirmed unused after Phase 4) or renaming/repurposing it as a non-RLS-aware helper. Filed as a post-Lean cleanup candidate.

## Authentication Gates

None — matcher is a read-only DB function called from another server-side function. No external API calls; no user-facing surface.

## Phase 4 Readiness — exports ready to import

```ts
import { matchEmail } from '@/features/matcher/service'
import {
  matchEmailInputSchema,
  type MatchEmailInput,
  type MatchEmailOutput,
} from '@/features/matcher/schema'

// Phase 4's inbox.pollOnce will call:
const match = await matchEmail({ userId, gmailThreadId, fromDomain })
if (match.isOk() && match.value.applicationId !== null) {
  // act-stage proceeds with the matched application
}
```

**Result variants Phase 4 must handle:**
- `ok({applicationId: <id>})` — matched; proceed to act-stage
- `ok({applicationId: null})` — unmatched; route to review queue
- `err({_tag: 'Validation', issues})` — caller bug (Phase 4 should never hit this in production; dev-time guard)
- `err({_tag: 'Db', cause})` — DB layer threw; defer to next pipeline tick (Phase 4's retry semantics)

## Self-Check

- **All 3 created files exist on disk:**
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/matcher/schema.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/src/features/matcher/service.ts` — FOUND
  - `/Users/edwardpham/Documents/Programming/Projects/foray/tests/integration/matcher-service.test.ts` — FOUND
- **Both task commits exist:** `886f684` (feat), `c30231f` (test) — FOUND
- **Pre-commit gate green:** lint clean, typecheck clean, 231/235 tests passing (4 pre-existing TODO), build succeeds, depcheck clean (only pre-existing `middleware.ts` orphan warning).
- **9 integration tests pass:** T1–T9, all 4 tiebreak paths + RLS isolation + validation + multi-row tiebreaks + ATS subdomain. Verified via `pnpm test:run tests/integration/matcher-service.test.ts`.
- **Zero direct Prisma imports outside core/db/:** `grep -E "@prisma/client|@/generated/prisma" src/features/matcher/*.ts` returns zero matches. Depcheck Rule 4 clean.
- **isAtsDomain called BEFORE company.findFirst:** Verified by line ordering in `service.ts` — `isAtsDomain(fromDomain)` is checked at step 2 (line 74), `tx.company.findFirst` at step 3 (line 81+). Pitfall #5 defense intact.
- **No new dependencies added:** `package.json` unchanged. Reuses `neverthrow`, `zod`, Phase 1's `withRls`, Phase 2's `isAtsDomain`.

## Self-Check: PASSED

## Next Phase Readiness

- Phase 4 (Plan 04, Gmail ingestion + pipeline) can import `matchEmail` immediately.
- Phase 4's act-stage owns `email.applicationId = matchResult.applicationId` writes — matcher does NOT mutate.
- Phase 4 must call `matchEmail` AFTER ingest, BEFORE classify, per ARCHITECTURE.md §"Email pipeline".
- No blockers. No deferred items. No threat flags.
- **Recommendation for Phase 4 planner:** Drop `tenantDb` references from CONTEXT pseudo-code in favor of `withRls`. The matcher SUMMARY documents the rationale; the Phase 4 plan should reflect it from day one.

---
*Phase: 03-classifier-matcher*
*Completed: 2026-05-09*
