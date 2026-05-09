---
phase: 05-review-queue-acceptance
verified: 2026-05-09T23:10:00Z
status: gaps_found
score: 17/18 must-haves verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: "check-server-actions.ts exits 0 when run with node"
    status: failed
    reason: "Script uses __dirname (CommonJS) but runs in ESM scope. Crashes with ReferenceError when invoked via `node scripts/check-server-actions.ts`. Works with `npx tsx` (shebang). Acceptance criteria explicitly requires `node`."
    artifacts:
      - path: "scripts/check-server-actions.ts"
        issue: "Line 18 uses __dirname which is undefined in ES module scope. Shebang is `#!/usr/bin/env npx tsx`, not `#!/usr/bin/env node`."
    missing:
      - "Replace __dirname with import.meta.dirname or fileURLToPath(import.meta.url) pattern, OR change shebang to #!/usr/bin/env node and add tsx/register, OR update acceptance criteria to accept npx tsx"
human_verification:
  - test: "Navigate to /inbox in a running dev server with needs_review emails in DB"
    expected: "Page renders email list with subject, from, body excerpt, classification badge, confidence badge, and 4 action buttons per row"
    why_human: "Visual rendering, component layout, and interactive behavior cannot be verified programmatically"
  - test: "Click Confirm on an email row"
    expected: "Row disappears from list, email.reviewedByUser=true and processingStatus='acted' in DB"
    why_human: "User interaction flow and optimistic UI update require browser testing"
  - test: "Click Override, select a new classification from dropdown"
    expected: "Dropdown opens with 5 classification options, selecting one removes the row"
    why_human: "Dropdown interaction and selection behavior require browser testing"
  - test: "Click Link, search for an application in the dialog"
    expected: "Dialog opens with searchable input, filtering applications by role or company name, selecting one links the email"
    why_human: "Dialog interaction, search filtering, and selection require browser testing"
  - test: "Disconnect Gmail and reload /inbox"
    expected: "Amber degradation banner appears with 'Gmail disconnected' message and link to /settings"
    why_human: "Conditional rendering based on DB state requires live app testing"
  - test: "Verify all 12 Lean acceptance criteria end-to-end (full walkthrough)"
    expected: "All 12 criteria in docs/milestones/lean.md pass"
    why_human: "Criteria 1-6 require live app interaction with real data; criteria 12 requires >=3 real applications"
deferred: []
---

# Phase 05: Review Queue + Acceptance — Verification Report

**Phase Goal:** Ship the human-triage surface (`/inbox`), wire structural CI checks that prevent regression of the safety properties, replace the gameable ">=30 tests" target with category coverage, and verify all 12 Lean acceptance criteria from `docs/milestones/lean.md` end-to-end.

**Verified:** 2026-05-09T23:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | findEmailsForReview returns all emails with processing_status='needs_review' for the authenticated user | VERIFIED | queries.ts L28-62: filters by userId + processingStatus='needs_review', orders by receivedAt desc, includes application+company |
| 2 | confirmClassification writes reviewedByUser=true and processingStatus='acted' in one transaction | VERIFIED | actions.ts L58-83: withRls transaction, tx.email.update with reviewedByUser:true, processingStatus:'acted' |
| 3 | overrideClassification updates classification + confidence + reviewedByUser in one transaction | VERIFIED | actions.ts L85-112: withRls transaction, updates classification, reviewedByUser:true, processingStatus:'acted' |
| 4 | ignoreEmail writes reviewedByUser=true without changing classification | VERIFIED | actions.ts L143-168: withRls transaction, only sets reviewedByUser:true + processingStatus:'acted', no classification change |
| 5 | linkToApplication sets applicationId on the email and marks reviewed | VERIFIED | actions.ts L114-141: withRls transaction, sets applicationId, reviewedByUser:true, processingStatus:'acted' |
| 6 | Full-body fetch endpoint returns 401 for unauthenticated, 429 when rate-limited, 503 when Gmail disconnected | VERIFIED | route.ts L48-84: 401 on requireUser failure, 429 with Retry-After:1 on consumeToken failure, 503 on getGmailClient failure |
| 7 | /inbox page renders a list of needs_review emails with subject, from, body excerpt, classification, confidence, and suggested application | VERIFIED | page.tsx L10-51 + inbox-row.tsx L55-114: page fetches via findEmailsForReview, row renders subject, from, excerpt, ClassificationBadge, ConfidenceBadge, application link |
| 8 | Each email row has confirm, override, link-to-application, and ignore action buttons | VERIFIED | inbox-row.tsx L93-109: Confirm button, ClassificationSelect (override), LinkApplicationDialog, Ignore button |
| 9 | Confidence is visualized as a 3-bar badge with exact percentage on hover | VERIFIED | confidence-badge.tsx L7-32: 3 div bars colored by tier (green/amber/gray), hover tooltip shows Math.round(confidence*100)+'%' |
| 10 | Degradation banner appears when Gmail disconnected or last sync >5 days ago | VERIFIED | degradation-banner.tsx L8-39: returns amber banner if !gmailConnected, returns amber banner if lastSyncAt null or >5 days, returns null otherwise |
| 11 | Clicking confirm calls confirmClassification Server Action and removes the row from the list | VERIFIED | inbox-list.tsx L30-35: handleConfirm calls confirmClassification, filters email from state on ok |
| 12 | Clicking override opens a dropdown to select a new classification | VERIFIED | classification-select.tsx L26-50: shadcn Select with 5 EmailClassification options, calls onOverride on value change |
| 13 | Clicking link-to-application opens a dialog with a searchable dropdown of existing applications | VERIFIED | link-application-dialog.tsx L26-82: Dialog with search input, filters applications by roleTitle/companyName, calls onLink on select |
| 14 | Every Server Action file exports functions that return Result<T, AppError> or ActionState | VERIFIED | npx tsx scripts/check-server-actions.ts: all 14 Server Actions PASS (3 files checked) |
| 15 | FORCE ROW LEVEL SECURITY is verified in test setup for every tenant-scoped table | VERIFIED | rls-escape.test.ts exists (4 tests), tests tenant isolation with foreign user_id |
| 16 | All 6 FND-03 test categories pass | VERIFIED | (a) rls-escape 4 tests, (b) classifier-fixtures 4 tests, (c) matcher-service 9 tests, (d) act-stage 7 tests, (e) budget 21 tests, (f) env 12 tests. Total: 314 passing |
| 17 | Pre-commit gate passes: pnpm lint && pnpm typecheck && pnpm test:run && pnpm build && pnpm depcheck | VERIFIED | All 5 commands pass. depcheck shows 2 warnings (no-orphans), 0 errors. Build shows /inbox route. |

**Score:** 17/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/features/inbox/queries.ts | findEmailsForReview + findApplicationsForLink | VERIFIED | 87 lines, exports both functions + InboxItem type, uses withRls |
| src/features/inbox/schema.ts | Zod schemas for review action inputs | VERIFIED | 34 lines, contains overrideClassificationSchema, linkApplicationSchema, reviewActionSchema |
| src/features/inbox/actions.ts | 4 review Server Actions | VERIFIED | 169 lines, exports confirm/override/linkToApplication/ignore + existing syncNow/disconnectGmail, all use requireUser+withRls+revalidatePath |
| src/app/api/inbox/full-body/route.ts | Rate-limited full-body Gmail fetch | VERIFIED | 86 lines, token bucket (MAX_TOKENS=5, REFILL_RATE=5), 401/429/400/503/200 responses |
| src/features/inbox/queries.test.ts | Integration tests for queries | VERIFIED | 219 lines, 5 test cases |
| src/features/inbox/actions.test.ts | Integration tests for actions | VERIFIED | 246 lines, 8 test cases |
| src/app/inbox/page.tsx | Server Component page | VERIFIED | 52 lines, requireUser+redirect, fetches queries, renders DegradationBanner+InboxList with count |
| src/features/inbox/components/inbox-list.tsx | Client wrapper with optimistic state | VERIFIED | 85 lines, 'use client', useState, 4 action handlers calling Server Actions, empty state message |
| src/features/inbox/components/inbox-row.tsx | Single email row with actions | VERIFIED | 115 lines, 'use client', Card with subject/from/excerpt/badges/4 action buttons |
| src/features/inbox/components/confidence-badge.tsx | 3-bar confidence visualization | VERIFIED | 33 lines, 'use client', 3 tiers, hover tooltip with percentage |
| src/features/inbox/components/classification-select.tsx | Override classification dropdown | VERIFIED | 51 lines, 'use client', shadcn Select with 5 options |
| src/features/inbox/components/link-application-dialog.tsx | Dialog to link email to application | VERIFIED | 83 lines, 'use client', Dialog with searchable input |
| src/features/inbox/components/degradation-banner.tsx | Gmail disconnected warning banner | VERIFIED | 41 lines, NO 'use client' (Server Component), amber banner |
| scripts/check-server-actions.ts | Structural CI check | VERIFIED (substance) / FAILED (runtime) | 181 lines, finds all actions.ts, checks return types. Works with npx tsx, crashes with node (ESM __dirname issue) |
| .dependency-cruiser.cjs | Module boundary rules with inbox exception | VERIFIED | inbox exception present at line 26 |
| docs/milestones/lean.md | Updated acceptance criteria | VERIFIED | Criterion #7 updated to "category-based coverage per FND-03" |
| src/core/env.test.ts | Env validation tests | VERIFIED | 166 lines, 12 tests covering DATABASE_URL, ENCRYPTION_KEY, APP_PASSWORD, APP_SESSION_SECRET, ANTHROPIC_API_KEY |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/app/inbox/page.tsx | src/features/inbox/queries.ts | findEmailsForReview + findApplicationsForLink | WIRED | page.tsx L6 imports, L27-28 calls both functions |
| src/features/inbox/components/inbox-list.tsx | src/features/inbox/actions.ts | confirmClassification, overrideClassification, linkToApplication, ignoreEmail | WIRED | inbox-list.tsx L6-9 imports, L31/41/48/55 calls each action |
| src/features/inbox/actions.ts | src/core/db/with-rls | withRls transaction for atomic updates | WIRED | actions.ts L6 imports, L65/93/122/150 uses withRls |
| src/app/api/inbox/full-body/route.ts | src/features/inbox/gmail-client.ts | getGmailClient for Gmail API access | WIRED | route.ts L6 imports, L67 calls getGmailClient |
| src/features/inbox/components/degradation-banner.tsx | gmailRefreshTokenEncrypted/gmailLastSyncAt | Props from page.tsx | WIRED | page.tsx L24-25 derives from tenantDb query, L43 passes as props |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| src/features/inbox/queries.ts | InboxItem[] | Prisma email.findMany with processingStatus='needs_review' | Yes — real DB query with filters | FLOWING |
| src/features/inbox/actions.ts | email updates | Prisma email.update via withRls transaction | Yes — real DB writes | FLOWING |
| src/app/api/inbox/full-body/route.ts | email body | Gmail API via getGmailClient | Yes — real API call | FLOWING |
| src/app/inbox/page.tsx | emails, applications | findEmailsForReview + findApplicationsForLink | Yes — queries hit DB | FLOWING |
| src/features/inbox/components/inbox-list.tsx | emails state | useState(items) from props | Yes — items from page.tsx DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | pnpm typecheck | Clean exit, no errors | PASS |
| All tests pass | pnpm test:run | 314 passed, 25 files, 0 failures | PASS |
| Production build succeeds | pnpm build | /inbox route present in output | PASS |
| No module boundary violations | pnpm depcheck | 0 errors, 2 warnings (no-orphans) | PASS |
| Structural check (npx tsx) | npx tsx scripts/check-server-actions.ts | All 14 Server Actions PASS, exit 0 | PASS |
| Structural check (node) | node scripts/check-server-actions.ts | CRASH: __dirname undefined in ESM | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| REVIEW-01 | 05-01, 05-02 | /inbox page shows low-confidence + unmatched emails | SATISFIED | page.tsx renders InboxList with findEmailsForReview data; inbox-row.tsx shows subject, from, excerpt, classification, confidence, suggested application |
| REVIEW-02 | 05-01, 05-02 | Per-row actions + rate-limited full-body fetch | SATISFIED | 4 actions in actions.ts + inbox-list.tsx wiring; full-body route.ts with 5 req/sec token bucket |
| FND-03 | 05-03 | Test coverage by category (6 categories) | SATISFIED | All 6 categories verified: (a) 4 tests, (b) 4 tests, (c) 9 tests, (d) 7 tests, (e) 21 tests, (f) 12 tests |
| FND-04 | 05-03 | Pre-commit gate green + structural CI check | PARTIAL | Pre-commit gate passes (lint+typecheck+test+build+depcheck). Structural check works with npx tsx but crashes with node (ESM __dirname issue) |

No orphaned requirements found. All 4 requirement IDs from PLAN frontmatter (REVIEW-01, REVIEW-02, FND-03, FND-04) map to Phase 5 in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scripts/check-server-actions.ts | 18 | `__dirname` in ESM scope | Blocker | Script crashes when run with `node` — only works with `npx tsx` |

No TODO, FIXME, placeholder, console.log, or stub patterns found in any production or test files.

### Human Verification Required

### 1. /inbox page rendering with real data

**Test:** Start dev server (`pnpm dev`), ensure DB has needs_review emails, navigate to /inbox
**Expected:** Page shows email list with subject, from, body excerpt, classification badge (colored), confidence badge (3-bar), suggested application link, and 4 action buttons per row. Count badge in heading shows correct number.
**Why human:** Visual rendering, component layout, badge colors, and interactive element positioning cannot be verified programmatically

### 2. Review action flows (confirm, override, link, ignore)

**Test:** Click each of the 4 action buttons on an email row
**Expected:** Confirm/Ignore removes the row immediately. Override opens classification dropdown; selecting one removes the row. Link opens dialog with searchable application list; selecting one removes the row.
**Why human:** Optimistic UI updates, dropdown/dialog interactions, and row removal animations require browser testing

### 3. Degradation banner behavior

**Test:** Disconnect Gmail (or use a user without refresh token), reload /inbox
**Expected:** Amber banner at top: "Gmail disconnected — full bodies unavailable. Connect Gmail in Settings."
**Why human:** Conditional rendering based on DB state (gmailRefreshTokenEncrypted) requires live app with specific DB state

### 4. Full Lean acceptance criteria walkthrough (12 criteria)

**Test:** Walk through all 12 acceptance criteria in docs/milestones/lean.md
**Expected:** All 12 criteria pass, including criteria 1-6 which require live app interaction and criteria 12 which requires >=3 real applications
**Why human:** Criteria 1-6 require real Gmail sync, email classification, application creation, and UI verification. Cannot be automated without full E2E test suite.

### Gaps Summary

One gap blocks goal achievement:

**check-server-actions.ts runtime failure with `node`** — The structural CI check script (FND-04 acceptance criterion #11) uses `__dirname` on line 18, which is undefined in ES module scope. The script crashes with `ReferenceError: __dirname is not defined in ES module scope` when run via `node scripts/check-server-actions.ts`. It works correctly when run via `npx tsx` (matching its shebang `#!/usr/bin/env npx tsx`), but the acceptance criteria explicitly requires `node` invocation.

Fix options:
1. Replace `__dirname` with `import.meta.dirname` (Node 21+) or `path.dirname(fileURLToPath(import.meta.url))` (Node 18+)
2. Change the acceptance criteria to accept `npx tsx scripts/check-server-actions.ts`
3. Add `tsx/register` import and keep `node` invocation

All other must-haves are verified. The inbox data layer, UI components, CI checks, test coverage, and pre-commit gate are all substantive, correctly wired, and data flows through real DB queries.

---

_Verified: 2026-05-09T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
