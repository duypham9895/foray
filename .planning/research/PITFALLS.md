# Pitfalls Research — foray Lean milestone

**Domain:** Single-user, local-first job-hunt CRM with Gmail OAuth + LLM email classifier
**Researched:** 2026-05-09
**Confidence:** HIGH on Gmail/Prisma/RLS items (verified against official docs + community issues); MEDIUM on UX-trust + scope-creep items (informed by ADRs + classifier research literature, but specific to this user's threshold).

This file goes deeper than the risk table in `docs/milestones/lean.md`. The five risks already documented there (OAuth verification, brittle rules, LLM cost, matcher misattribution, trust crisis) are real — what follows is the layer underneath them: *how* each one actually bites in week one, plus seven more pitfalls the existing table misses.

Lean phases referenced below: `capture`, `gmail-ingestion`, `classifier`, `matcher`, `auto-update`, `review-queue`, `applications`, `auth`, `foundational-hardening`.

Severity legend:
- **BLOCKING** — ship-stopper. Discover late and the milestone slips.
- **WOULD BITE EVENTUALLY** — works on day 1, breaks within first month of real use.
- **NICE TO PREVENT** — annoyance / polish. Worth a comment but not a redesign.

---

## Critical Pitfalls

### Pitfall 1: Test-mode OAuth refresh token silently dies after 7 days

**What goes wrong:**
You finish Gmail ingestion Wednesday, demo successfully Friday. The following Friday, polling silently stops working. Logs show `invalid_grant: Token has been expired or revoked`. No emails ingested for a week — you only notice because the inbox count looks suspiciously round.

**Why it happens:**
Google revokes refresh tokens after exactly 7 days when the OAuth consent screen publishing status is **Testing** (External user type). This is documented but not surfaced in the OAuth flow UI — there is no warning email, no event, just silent revocation. The `lean.md` risk table flags "stay in Test mode" as the *mitigation* for the verification headache, which is correct, but the 7-day refresh-token expiry is a separate consequence of being in Test mode that is not flagged.

**Severity:** BLOCKING for "is this milestone usable past one week?" — the whole automation thesis dies after 7 days.

**Warning signs:**
- `User.gmailLastSyncAt` stops advancing in DB (queryable in Studio)
- `/api/gmail/poll` route returns 401 from Gmail API but cron swallows the error
- Settings page shows "Connected as duypham9895@gmail.com" but a "Sync now" click silently fails
- No new `Email` rows for >24 hours despite known activity in Gmail

**Prevention (actionable):**
1. **Surface token health in `/settings`** — store `gmailRefreshTokenLastValidatedAt` on the User row; show a red banner if it's >5 days old or the last poll returned `invalid_grant`.
2. **Catch `invalid_grant` explicitly** in the gmail-ingestion service and write an `Event(type='gmail_disconnected', source='system')` so the timeline tells the truth.
3. **Document the 7-day clock in SETUP.md** with the exact symptom and the re-auth steps. Do not rely on "I'll remember."
4. **Cheap escape hatch:** flip the OAuth app to **In production** with the project owner as the only `accounts.google.com` listed user — verification is *not* required for sensitive scopes when the user count stays under the cap and you're the only consenter. The 7-day clock disappears. (Per Google: verification is required when scope is restricted *and* the app is publicly accessible; an unverified production app in single-user mode is allowed and stops the test-mode revocation.)

**Phase to address:** `gmail-ingestion` (token storage + health check) and `auth` (settings UI surface).

---

### Pitfall 2: Prisma client extension for RLS doesn't preserve `SET LOCAL` across all query paths

**What goes wrong:**
You write `tenantDb` + a Prisma client extension that runs `SET LOCAL app.user_id = $1` before each query. Tests pass. In dev with a single user it works. Then a code path calls `prisma.$queryRaw` directly, or a query escapes the extension via `Prisma.$transaction([...])` (sequential transaction array form), and no `app.user_id` is set — RLS policy uses `current_setting('app.user_id', true)` which returns `NULL`, and depending on policy syntax this either denies all rows (silent breakage) or returns all rows (silent multi-tenant leak — catastrophic if you ever onboard a second user).

**Why it happens:**
Three concrete failure modes documented in Prisma issues:
1. **Sequential `$transaction([...])` (array form) does not call the extension's per-operation hook** the same way interactive `$transaction(async (tx) => …)` does. Connection state can be reused without re-setting the variable.
2. **`$queryRaw` and `$executeRaw` bypass model-level extensions** — if the extension is registered on `application.findMany` and friends, raw SQL slips past it.
3. **Even in interactive transactions, the extension wraps the *base* client** ([prisma/prisma#17948](https://github.com/prisma/prisma/issues/17948)) — the `tx` handed to the callback is the base client, not the extended one, unless you re-extend inside the transaction.

**Severity:** BLOCKING for the "RLS as second line of defense" promise (PRINCIPLES.md §"Database — Postgres RLS"). The `tenantDb` wrapper still works because it filters in app-land, but the safety net has holes.

**Warning signs:**
- A test that runs `prisma.$queryRaw` (instead of `tenantDb`) in a tenant-scoped context returns rows for the wrong user
- An RLS policy debug query (`SELECT current_setting('app.user_id', true)`) returns `NULL` mid-request
- `pg_stat_activity` shows the same backend serving consecutive requests with different `app.user_id` values

**Prevention (actionable):**
1. **Run RLS context-set inside the same transaction as the actual query**, always. Pattern:
   ```ts
   return prisma.$transaction(async (tx) => {
     await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`
     return tx.application.findMany({ where: { /* … */ } })
   })
   ```
   Note: `set_config(..., true)` is `SET LOCAL` — scoped to the transaction. **This is the only safe pattern under transaction-pool connection sharing**, even if foray is single-app-server today (per [pgBouncer docs on transaction pooling](https://www.pgbouncer.org/features.html)).
2. **Write a test that explicitly tries to escape RLS:** as a non-superuser DB role, with `app.user_id = '1'`, attempt `SELECT * FROM applications WHERE user_id = 2` and assert zero rows. This is the pgTAP-style "deny by default" test. Two seeded users, two applications, one query — assert isolation.
3. **Use a non-superuser role for the application's runtime DB connection**, configured via `DATABASE_URL`. RLS policies are *bypassed by default* for the table owner and superuser ([Postgres docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). `FORCE ROW LEVEL SECURITY` (already in PRINCIPLES.md example) covers the table-owner case but not the superuser case.
4. **Guard `$queryRaw`/`$executeRaw` callsites at code review** — every one is an audit point. Add a CI grep that flags new `$queryRaw` outside `core/db/` and requires a comment justification.

**Phase to address:** `foundational-hardening` (FND-02 RLS migration + tests). The RLS migration is non-trivially harder than the one-paragraph version in PRINCIPLES.md suggests; budget at least a day for it including the escape-test fixtures.

---

### Pitfall 3: `node-cron` in `instrumentation.ts` double-fires under hot reload (and the fix is non-obvious)

**What goes wrong:**
You wire up the 15-min polling cron in `src/instrumentation.ts` per PRINCIPLES.md §"Background jobs v1". It works. Every time you save a file, Next.js re-runs the instrumentation hook, registering a *second* cron. After 10 saves you have 10 crons all polling Gmail every 15 minutes. Quotas burn, logs duplicate, and on Friday's demo you can't reproduce a clean log line because of the noise.

**Why it happens:**
Three compounding facts:
1. **Next.js calls `register()` in all environments, including Edge** ([Next.js instrumentation docs](https://nextjs.org/docs/app/guides/instrumentation)). The `if (process.env.NEXT_RUNTIME !== 'nodejs') return` guard is mandatory — Edge runtime cannot run `node-cron` at all.
2. **In dev, `register()` re-runs after instrumentation.ts (and arguably any hot-reload trigger) changes**, but the previously-registered `cron.schedule` handle is *not* automatically destroyed. Each `cron.schedule(...)` call adds another scheduled task to the in-process scheduler — they accumulate.
3. **Next.js dev server keeps the parent Node process alive across reloads**, so the accumulated tasks don't naturally die.

**Severity:** WOULD BITE EVENTUALLY — invisible to acceptance tests, immediately visible during the first dev session that lasts >30 minutes.

**Warning signs:**
- `pino` logs show the same `gmail.sync` operation starting 2-N times in the same minute
- Anthropic API call count climbs faster than expected (each duplicate cron polls, each poll classifies)
- You see `pg_try_advisory_lock` returning false in logs — that's the *defense* working, not a bug, but it confirms the multi-fire problem
- The classifier-log.jsonl grows visibly during a single dev save-edit cycle

**Prevention (actionable):**
1. **Globalize the cron handle** the same way `prisma` is globalized for hot-reload safety:
   ```ts
   // src/instrumentation.ts
   const g = globalThis as unknown as { __forayCron?: { stop: () => void } }
   export async function register() {
     if (process.env.NEXT_RUNTIME !== 'nodejs') return
     g.__forayCron?.stop()
     const cron = await import('node-cron')
     g.__forayCron = cron.schedule('*/15 * * * *', pollGmailWithLock)
   }
   ```
2. **Use the advisory lock anyway** (already in PRINCIPLES.md example) — it protects against races between scheduled ticks and a manual "Sync now" click in `/settings`. Belt + suspenders.
3. **Log the `register()` boot once with a unique boot ID** so duplicate registration is greppable in the logs.
4. **Disable the cron entirely in test runs** by checking `process.env.NODE_ENV !== 'test'` — vitest workers booting Next.js context will otherwise spawn crons inside test processes.

**Phase to address:** `gmail-ingestion` (GMAIL-04 cron + the cron-survives-hot-reload guard).

---

### Pitfall 4: First wrong auto-classification destroys trust before undo can save it

**What goes wrong:**
The first email foray auto-classifies as `rejection` is one where the classifier was wrong — it mis-read a "sorry to keep you waiting, the recruiter will reach out shortly" as a rejection because of the word "sorry". The owner sees their `Application.canonicalStatus` flip to `rejected` *for a role they were actively interviewing for*. Even if the toast undo works, the visceral "I cannot trust this with my real job hunt" reaction is now permanent. The owner reverts to spreadsheet within 48 hours.

**Why it happens:**
This is the central thesis-risk of foray. The `lean.md` risk table calls it the "trust crisis" risk and proposes two mitigations: (a) prominent undo, (b) first 50 emails bypass auto-update. Both are necessary; **neither is sufficient on their own.** Concrete reasons the existing mitigation isn't enough:
1. **A 10-second toast is a 10-second window**, and people miss notifications constantly. The "permanent in event timeline" affordance is the durable safety net, not the toast.
2. **First-50-bypass solves the cold-start case** but doesn't help once auto-update kicks in on email 51.
3. **The asymmetry of cost matters**: a false-positive rejection on an active interview is *catastrophic* (might cause the owner to stop replying to the recruiter), while a false-negative (missed auto-classification, item lands in review queue) is *zero cost*. The classifier should be tuned for false-negative bias, hard.

**Severity:** BLOCKING for product viability (not for milestone shipping — you can ship an unsafe classifier, you just can't trust it).

**Warning signs:**
- Confidence scores cluster suspiciously close to threshold (lots of 0.84–0.86) — the threshold was tuned to a non-discriminating classifier
- Rules in `rules.ts` rely on broad keywords ("sorry", "unfortunately", "regret") rather than templated phrases
- LLM calls return high confidence on emails that, on inspection, are clearly ambiguous to a human
- Owner uses the undo button more than once in the first week

**Prevention (actionable beyond what lean.md already lists):**
1. **Tune the rules for high precision over recall.** A rule that fires on *only* the literal phrase `"we have decided to move forward with other candidates"` is worth 100 noisy keyword rules. Rules should be templated-phrase matchers, not bag-of-words. Keep a fixture file (`tests/integration/classifier-fixtures/`) of real emails with expected labels — this is the ground truth, not the rules themselves.
2. **Asymmetric thresholds per label.** `rejection` should require ≥0.92, `interview_invite` can run at 0.85, `noise` can be aggressive. The single `CLASSIFIER_AUTO_THRESHOLD` env var encodes the wrong assumption that all labels carry equal cost. Replace with a per-label threshold map at the boundary of `classifier/service.ts` or accept the env-var as a floor and have per-label overrides in code.
3. **Block auto-update on a status *regression***. If `Application.canonicalStatus` is currently `interviewing`, never auto-flip to `rejected` without human confirmation regardless of confidence. The cost of a wrong rejection on a live interview dwarfs the cost of a one-extra-click review-queue entry.
4. **The undo event must be *visually loud* in the timeline** — not a small icon. Per DESIGN.md "campaign room" tone, this is the moment to use color and weight. The visible-undo-affordance permanence is the actual mitigation, not the toast.
5. **Log every auto-update decision** — `classifier-log.jsonl` should also include the *match* (which application + why) and the *prior status*, not just the classification. When the owner asks "why did you change this?", the answer must be reproducible from the log.

**Phase to address:** `classifier` (per-label thresholds), `auto-update` (regression block + event design), `review-queue` (review-queue is the safe-default destination). Cross-cutting concern; probably warrants its own ADR ("ADR-0011: Asymmetric trust per classification label").

---

### Pitfall 5: Sender-domain matching attributes Greenhouse / Lever / LinkedIn emails to the wrong company

**What goes wrong:**
The matcher in `MATCH-02` has tiebreak: thread continuity → sender domain match → unmatched. A new email arrives from `no-reply@us.greenhouse-mail.io`. There is no thread continuity (it's a fresh thread). Domain `greenhouse-mail.io` matches no `Company.domain` you've stored, so it falls through to "unmatched." Annoying but safe. The *bad* case: the owner stored `Company.domain = 'greenhouse.io'` for an earlier company that uses Greenhouse, and now every Greenhouse email from any company gets attributed to that one company. The status auto-update rule fires against the wrong application.

**Why it happens:**
ATS platforms — Greenhouse, Lever, Workday, Ashby, Rippling — send candidate emails from their own infrastructure domains, not from the hiring company's domain. Per [Greenhouse documentation](https://support.greenhouse.io/hc/en-us/articles/17675865619099-Greenhouse-Recruiting-no-reply-email-addresses), Greenhouse uses addresses like `no-reply@us.greenhouse-mail.io`. LinkedIn InMails come from `linkedin.com` regardless of who the recruiter works for. Workday emails come from Workday-shaped domains. **Sender domain is a near-useless signal for these emails.** The hiring company is in the *display name* of the From header (`"Acme Corp <no-reply@us.greenhouse-mail.io>"`) or in the email body — never in the domain.

**Severity:** WOULD BITE EVENTUALLY (within the first 2-3 ATS emails of real use; majority of professional job applications hit at least one ATS).

**Warning signs:**
- A `Company.domain` value contains an ATS host (`greenhouse-mail.io`, `myworkdayjobs.com`, `lever.co`, `ashbyhq.com`, `mail.smartrecruiters.com`, `linkedin.com`)
- The same `Company` row is being attached to applications from visibly different companies
- The matcher returns `applicationId` for an email whose subject mentions a company that is not the matched application's company

**Prevention (actionable):**
1. **Ban known ATS domains from `Company.domain` storage** — block in the `applications` capture form Zod schema with a curated list. Even if the user types `greenhouse.io`, refuse it with a helpful error: "Greenhouse is an ATS, not a company. Enter the hiring company's website domain instead."
2. **In the matcher, downrank or exclude ATS domains** — if `email.fromDomain` is in the ATS list, *skip* the domain-match tiebreak entirely and fall straight to unmatched. Better to land in the review queue than to misattribute.
3. **Subject-line + display-name extraction** — Gmail API returns the From header parsed; the display name often contains the company name. Implement a *third* tiebreak: parse "Acme Corp <…>" → fuzzy-match "Acme Corp" against `Company.name`. Not for Lean, but design the matcher's `Result` type so this third strategy can be added without re-architecting.
4. **Test fixtures must include ATS samples.** The classifier-fixtures folder should have at least one real email per major ATS (Greenhouse, Lever, Workday) so the matcher's behavior on these is visible in tests.

**Phase to address:** `matcher` (MATCH-02 tiebreak), `capture` (CAPT-01 form validation rejecting ATS domains).

---

### Pitfall 6: LLM cost cap alert fires too late to matter

**What goes wrong:**
You add the `>$0.50/day → alert` mitigation per `CLASS-04`. A bug in the matcher causes one email to be classified 200 times in a single cron tick (no idempotency check on the email's `classification` column). The LLM bill hits $0.50 in 30 seconds. The "alert" — a `pino.warn` log line — fires after the budget is already blown, and there is no separate notification channel.

**Why it happens:**
"Alert if daily total > $0.50" is monitoring, not control. It tells you what already happened. Three failure modes compound:
1. The alert is a log line, not a kill-switch — nothing prevents the next call.
2. Daily-total is computed at end-of-period, not before-each-call. A burst within a single cron tick can blow through the budget before the daily-total is even recomputed.
3. There is no test for the *runaway* case — only for happy-path token counting.

**Severity:** WOULD BITE EVENTUALLY (when a bug runs the classifier in a loop, which is exactly when you most need the cap to work).

**Warning signs:**
- Daily token count for a 24-hour window approaches `$0.50` without an unusual volume of emails
- The same `Email.id` has been classified twice (visible from `classifier-log.jsonl` if logging includes the email ID)
- A single cron tick logs >50 LLM calls
- `Anthropic` SDK returns 529 Overloaded ([common upstream signal of high call rate](https://docs.anthropic.com/en/api/errors)) — *retry-with-backoff is your problem here*: dumb retry on 529 multiplies cost without solving the underlying bug

**Prevention (actionable):**
1. **Pre-call budget check, not post-call accounting.** Before each LLM call: read today's running cost from a small DB table or in-process counter; if `>= ENV.CLASSIFIER_DAILY_BUDGET_USD`, return `err({ _tag: 'RateLimited', retryAfterSeconds: secondsUntilMidnight })`. Trip at 80% of budget for a soft warning, hard-block at 100%.
2. **Idempotency check before classification:** in `classifier/service.ts`, refuse to classify if `email.classifiedBy != null` and `email.classification != null` unless an explicit `force: true` is passed. Most classifier loops are upstream bugs that manifest as "classify the same email 100 times."
3. **Per-batch hard cap.** A single cron tick should process at most N emails (e.g., 50) regardless of pending count. If more pending, log + carry over to next tick. Bounds the worst-case cost per tick to ≤50 × Haiku call ≈ $0.025.
4. **Wrap Anthropic SDK calls in `Result`** with explicit handling of 529 (do not bubble through retry) and 429. The SDK's default retry behavior is `2 retries with exponential backoff` — fine for one-off calls, dangerous for loops. Set `maxRetries: 0` on calls inside a cron tick and let the cron's next tick be the retry.
5. **Test the runaway scenario.** Write a vitest case that calls `classify()` 100 times on the same email and asserts ≤1 LLM call (idempotency) and that the budget guard rejects subsequent calls after N.

**Phase to address:** `classifier` (CLASS-02 LLM call wrapping + CLASS-04 logging) — extend CLASS-04 to be a *control* not just a *log*.

---

### Pitfall 7: Email body privacy rule conflicts with the review queue UX

**What goes wrong:**
Privacy rule says "≤500 char excerpt stored, full body fetched on demand for review queue display only." Day 8 of use: owner disconnects Gmail (or token expires per Pitfall 1) but still wants to review historical emails in `/inbox`. Body fetch fails because there's no valid token. Or: owner clicks an item in the review queue, the on-demand fetch hits Gmail's 250 quota-units-per-user-per-second limit because of a burst, and the page shows a stale excerpt with no error message.

**Why it happens:**
Three distinct edge cases the privacy rule didn't anticipate:
1. **Token revocation orphans historical emails.** Once Gmail is disconnected, "fetch full body on demand" silently fails forever. The 500-char excerpt is the only thing left.
2. **Gmail API rate limits are per-user-per-second**, not per-day — bursty review queue clicks (rapid arrow-key navigation) can trip the 250-quota-units limit even at low volume.
3. **Gmail thread state changes**: if the user deletes the email from Gmail (or it's an auto-archive rule), `messages.get` returns 404 and the on-demand fetch can no longer find it.

**Severity:** WOULD BITE EVENTUALLY (low frequency but high pain when it does — the user is most likely to disconnect Gmail in week 2-3 to debug something, and lose access to the review queue's full content).

**Warning signs:**
- The first time a user hits a 401 from `messages.get` after a successful initial OAuth flow
- `/inbox` items in review queue show the 500-char excerpt only and the "View full email" button errors silently
- Gmail API logs show 429 Resource Exhausted from review queue navigation

**Prevention (actionable):**
1. **Treat the 500-char excerpt as the source of truth for review-queue UX.** Display it prominently. The "view full body" affordance is a *bonus*, gated behind an explicit click, with a clear error state when it fails. Do not assume full-body fetch works.
2. **Cache the full body for the duration of a review session.** When user opens a review-queue item, fetch once, hold in component state, throw away on page navigation. Don't persist (privacy), don't re-fetch on scroll.
3. **Surface "Gmail disconnected — full bodies unavailable" in `/inbox` header** when token health check fails. The user should know what's degraded.
4. **Rate-limit per-user-per-second on the on-demand fetch endpoint** (`/api/emails/[id]/full-body`) — token bucket of 5 req/sec. The server-side rate-limit guards against bursty clicks before Gmail does.
5. **Reconsider the 500-char excerpt size.** 500 chars is ~80 words — often not enough to confidently confirm/override a classification. Empirically check 5-10 real emails: is 500 enough to triage, or is the stored excerpt actively pushing the user toward the full-body fetch? If the latter, the storage rule is a false economy. ADR territory if changed.

**Phase to address:** `gmail-ingestion` (excerpt size + token health), `review-queue` (UX-degrades-gracefully on token failure).

---

### Pitfall 8: Auto-update + undo race when classifier re-runs while user is undoing

**What goes wrong:**
At 10:14, the cron auto-classifies email A as rejection → `Application.canonicalStatus: applied → rejected`, writes `Event(type='auto_status_changed', undoable=true)`. At 10:14:30, the user clicks Undo (status flips back to `applied`, `Event(type='status_undone')` written). At 10:15, the next cron tick re-evaluates: `email.classifiedBy` is set so it skips classification (per Pitfall 6's idempotency guard), but the *act* stage doesn't have an idempotency guard — it sees a classified, matched email, confidence still ≥0.85 → reapplies the auto-update. The undo is undone. User loses faith.

**Why it happens:**
The 4-stage pipeline in PRINCIPLES.md (`ingest → match → classify → act`) has idempotency on the first three but not naturally on `act`. The `processing_status = acted` column would prevent re-acting, but only if it's checked before evaluating; and the user's undo writes a `status_undone` event but doesn't change the email's `processing_status`.

**Severity:** BLOCKING for user trust — the undo is the central trust mechanism per ADR-0006; if it can be silently re-undone the whole trust model collapses.

**Warning signs:**
- A user undoes a status change and the same status change reappears within 15 minutes
- The Event timeline for one application shows: `auto_status_changed` → `status_undone` → `auto_status_changed` (with no human action between the second pair)
- An email row has both `reviewedByUser=true` and a fresh `auto_status_changed` event newer than the review

**Prevention (actionable):**
1. **The undo writes to the email, not (just) the application.** When user clicks undo: set `email.reviewedByUser = true`, set `email.processing_status = 'reviewed'` (or `'opted_out'`), AND write the `Event(status_undone)`. The classifier/auto-update pipeline must check `reviewedByUser` before acting. One column + one check, prevents re-act.
2. **Optimistic concurrency on the application row.** When auto-update runs, include a `WHERE updatedAt = $previousUpdatedAt` clause; if zero rows updated, abort and log conflict. Prisma supports this via `update({ where: { id, updatedAt: prev } })` returning 0.
3. **Sequential undo + re-classify is OK; concurrent is not.** Use the existing `pg_try_advisory_lock` per email-id (not just per-job) for the act stage to serialize — `pg_try_advisory_lock(hashtext('act:' || email_id))`. If undo's transaction holds the lock, the cron's act stage skips. Cheap.
4. **Test the race directly.** Vitest with `Promise.all([undoStatusChange(), runActStage(email)])` — assert the application's final canonicalStatus matches the user's undo, not the cron's act.

**Phase to address:** `auto-update` (AUTO-01 + AUTO-04 — undo must touch the email, not just the application).

---

### Pitfall 9: RLS test that "passes" because both roles use superuser

**What goes wrong:**
You write `tenantDb.test.ts` with two test users, two applications, asserting that `tenantDb(userA).application.findMany()` doesn't see userB's data. Test passes. You ship. RLS is enabled at the table level. Months later you onboard a second user (or hand the app to another dev) and discover that RLS was being *bypassed* by the test's DB connection because the connection was the table-owner / superuser, and `FORCE ROW LEVEL SECURITY` wasn't on the migration.

**Why it happens:**
[Postgres RLS rules](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): superusers and roles with `BYPASSRLS` attribute always bypass policies. Table owners bypass unless `FORCE ROW LEVEL SECURITY` is set. `tenantDb` provides app-layer filtering and *will pass the test even when RLS is off*, masking the missing safety net.

**Severity:** WOULD BITE EVENTUALLY (only matters when SaaS multi-user happens, but the moment it matters it's a tenant-leak vulnerability).

**Warning signs:**
- Migration uses `ALTER TABLE … ENABLE ROW LEVEL SECURITY` without the matching `FORCE ROW LEVEL SECURITY`
- Tests connect to Postgres with the same role as the migration tool (typically a superuser)
- `\dp applications` in psql shows policies but `current_user` is the table owner

**Prevention (actionable):**
1. **Migration must include `FORCE ROW LEVEL SECURITY`** for every tenant-scoped table — this is the line that makes the policy apply to the table owner too.
2. **Tests must run as a non-superuser app role.** Create a `foray_app` role in the seed/test setup that has `SELECT, INSERT, UPDATE, DELETE` on the tenant tables but is *not* the owner and does *not* have `BYPASSRLS`. Use this role's connection string in test setup.
3. **The escape-attempt test must explicitly try to break out** (per Pitfall 2's pattern). And the test must include an assertion that *RLS is actually active*: `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'applications'` returns `(t, t)`.
4. **CI sanity check:** a one-line query that confirms RLS is enabled on every table that should have it. Fails the build if a future migration accidentally drops RLS.

**Phase to address:** `foundational-hardening` (FND-02 RLS migration + FND-03 tests).

---

### Pitfall 10: Prisma 7 generator output / config gotchas eat half a day

**What goes wrong:**
You go to add a new model to `schema.prisma`, run `pnpm prisma migrate dev`, and the migrate fails with a confusing config error. The schema looks fine. Tests start failing with "Cannot find module `@prisma/client`" because someone in another file imported the old path. Or: the build succeeds in dev but breaks in production with `Module not found: Can't resolve '...generated/prisma/client'` because Webpack/Turbopack handle the new generator output path differently.

**Why it happens:**
Prisma 7 (already adopted per `prisma/schema.prisma:11-13`) introduced several breaking changes that are *easy to violate accidentally*:
1. **`output` field is required** in the generator block (foray sets `../src/generated/prisma`, correct).
2. **Connection URL moved from schema.prisma to `prisma.config.ts`** ([Prisma 7 upgrade docs](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)). The `datasource db { provider = "postgresql" }` in current schema does not specify `url` — that's correct for Prisma 7 but trips up anyone used to Prisma ≤6.
3. **Import path changed** to `@/generated/prisma/client`. Old `@prisma/client` imports will look like they work in IDE (because the package is still installed transitively) but break at runtime.
4. **Bundler issues with ESM `.js` imports** in Next.js / Turbopack ([prisma/prisma#28627](https://github.com/prisma/prisma/issues/28627)) — needs config tweaks.
5. **Adapter is required at runtime** — `PrismaPg` from `@prisma/adapter-pg`. Forgetting this gives a confusing error on first query.

**Severity:** NICE TO PREVENT (you'll figure it out, but it's the kind of thing that eats half a day on Wednesday and you can't afford that in a 1-week milestone).

**Warning signs:**
- A new `import { PrismaClient } from '@prisma/client'` (wrong path) anywhere in the codebase — should always be `@/generated/prisma/client`
- `pnpm prisma migrate dev` errors mentioning "DATABASE_URL not found"
- Build succeeds in dev but fails in production with module-not-found on the prisma generated client
- Anyone running `pnpm prisma generate` and getting output in `node_modules/` instead of `src/generated/prisma`

**Prevention (actionable):**
1. **ESLint rule blocking `from '@prisma/client'`** with auto-fix to `@/generated/prisma/client`. One line in eslint config, prevents the entire foot-gun class.
2. **`AGENTS.md` Prisma 7 reminder section** (already referenced in CLAUDE.md §"Document map") — make this section concrete: list the 5 things above with the exact error each produces. When Wednesday happens, future-you greps "DATABASE_URL not found" and finds the answer in 30 seconds.
3. **CI step `pnpm prisma generate && pnpm typecheck`** in the same step — catches generator-output issues at PR time.
4. **The `globalForPrisma` singleton lives in `src/core/db/client.ts`** (already in PRINCIPLES.md). Do not recreate `PrismaClient` in tests; have a test helper that uses the same singleton wrapped in a transaction-rollback fixture.

**Phase to address:** `foundational-hardening` (FND-01 tenantDb extension is the natural touchpoint — anyone working on it will hit Prisma 7).

---

### Pitfall 11: "Just one more tiny field" scope creep within Lean

**What goes wrong:**
Tuesday: "I should add a `tags` field to applications." (5 min change in schema, 30 min UI). Wednesday: "I should add a tag-filter to the list view." (1 hour). Thursday: "I should add a tag-based search bar." (3 hours, plus tag-suggestion UI). Friday: tests broken, build broken, Lean ships next week. The `tags` column was already on the schema — the UI was deferred to Standard.

**Why it happens:**
The Lean → Standard → Full progression (ADR-0007) is an *engineering constraint*, but every "tiny" addition feels like it costs nothing because the schema already has the field. Three patterns:
1. **The schema is more permissive than the UI scope** — `tags`, `recruiters`, `documents`, `followUpAt` are all in `prisma/schema.prisma` but explicitly out-of-scope for Lean per `PROJECT.md`. The feature looks "almost free."
2. **Scope is checked at milestone start, not at PR time.** Once you're heads-down in a slice, "while I'm here" additions feel local.
3. **The "Out of scope" list in `lean.md` is plain markdown, not enforced anywhere.** No PR template, no CODEOWNERS check, no test that fails.

**Severity:** WOULD BITE EVENTUALLY (each individual creep is small; the cumulative effect ships the milestone late).

**Warning signs:**
- A diff touches a slice that wasn't on the milestone task list
- A new component uses a Prisma model field that the milestone doesn't expose anywhere else (e.g., `tags`, `recruiters`)
- A commit message says "while I was here…"
- The acceptance criteria in `lean.md` haven't budged but the LOC count has

**Prevention (actionable):**
1. **Open a "Standard intake" file** (`.planning/standard-backlog.md`) and dump every "tiny addition" idea there with one line of context. The act of writing it down is the deferral. Costs ~30 sec; preserves the idea.
2. **Daily check against `lean.md`'s "In scope" checkboxes.** End-of-day grep: which boxes did I tick? Did I touch anything outside of those boxes? If yes, that work doesn't count toward today and either gets reverted or moved to Standard.
3. **PR template question:** "Is this work covered by a `lean.md` checkbox? If not, link the deferral note." (Solo dev — but PR template is also a self-discipline tool.)
4. **The acceptance criteria are the gate, not the schema.** The schema includes Recruiter / Document / Tags because they're cheap to model now; UI for them is *explicitly deferred*. Treat schema fields as inert until a milestone lights them up.

**Phase to address:** Cross-cutting; primarily a `foundational-hardening` discipline + every other phase.

---

### Pitfall 12: Test count theater (≥30 tests passes; tenant isolation isn't actually tested)

**What goes wrong:**
You hit the `≥30 tests` target by writing 25 unit tests on classifier rule patterns (cheap, fast, mostly testing regex behavior) and 5 integration tests on env validation. `pnpm test:run` shows 30 green. Acceptance criterion ticked. But there are zero tests for: (a) `tenantDb` tenant isolation, (b) RLS escape attempts, (c) matcher false-positive on ATS domain, (d) the auto-update + undo race (Pitfall 8), (e) the Anthropic 529 path. The most consequential code paths are untested, and the test count gates them through.

**Why it happens:**
Counting tests is a proxy metric for confidence; it's gameable. Classifier rule tests are easy to write in volume (one fixture, 5 lines of test code, looks like real coverage). The high-value tests — multi-user isolation, RLS, race conditions, error paths — are individually slow to write, individually pull weight 10x more than a regex test, and naturally lose the race against an N-tests-passing gate.

**Severity:** WOULD BITE EVENTUALLY (test count looks healthy; the actual safety properties aren't verified).

**Warning signs:**
- The test pyramid is inverted: lots of unit tests, near-zero integration tests
- No test file in `tests/integration/` or it exists but has only happy-path tests
- `tenantDb.test.ts` doesn't exist or only tests one user
- Search the test suite for `expect(...rls...)` or `expect(...crossTenant...)` returns nothing

**Prevention (actionable):**
1. **Replace the "≥30 tests" criterion with a coverage-by-category list.** The acceptance criterion in `lean.md` should require:
   - ≥1 test for tenant isolation per tenant-scoped model (`Application`, `Email`, `Event`, `Stage`, `Company`)
   - ≥1 RLS escape-attempt test (per Pitfall 2)
   - ≥1 matcher test per tiebreak path (thread / domain / unmatched / ATS-blocked)
   - ≥1 classifier test per label (rejection / interview_invite / recruiter_outreach / noise / unmatched)
   - ≥1 auto-update + undo race test (per Pitfall 8)
   - ≥1 Anthropic 529 / runaway-loop test (per Pitfall 6)
   - Plus the rule fixtures.
   The total naturally clears 30, but the *shape* is the gate.
2. **The acceptance criterion 11 in `lean.md` ("Every Server Action returns Result<T, AppError>")** should be a CI grep: `git grep -nE 'export (async )?function' src/features/*/actions.ts` then assert each export's return type contains `Result`. No test count substitutes for an actual structural check.
3. **CI report by directory.** A per-directory test count + coverage report makes it visible that `src/core/db/` has 1 test and `src/features/classifier/rules.ts` has 25. Eyeball weekly.
4. **The hardest tests to write are the ones to write first.** RLS escape, undo race, runaway loop. If you can't write the test, the production code probably can't survive the scenario either.

**Phase to address:** `foundational-hardening` (FND-03 should be re-spec'd as the category list above) — and the principle applies to every slice's tests.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single `CLASSIFIER_AUTO_THRESHOLD` env var (one number for all labels) | Simple to set; tunable without code | Wrong threshold for any one label corrupts trust on that label class (Pitfall 4) | Only as a temporary floor; per-label override should land before owner uses on real campaign |
| Polling interval hardcoded at 15 min | One value, no UI | Burst-noisy in dev (cron fires at fixed times that don't align with debugging); wastes Anthropic quota during inactive periods | Acceptable for Lean; revisit when token cost or perceived staleness becomes a complaint |
| Storing email body excerpt as plain `Text` (no FTS index) | Schema is simple; no extension dependency | Cross-foray search (Standard milestone feature) requires retrofitting `tsvector` + reindex; not free | Acceptable for Lean (no search UI); add `@db.tsvector` migration when search lands |
| Single `DATABASE_URL` for migrations + runtime + tests | One variable, no env confusion | Tests pass with superuser RLS bypass (Pitfall 9); migrations grant superuser to runtime; multi-tenant escape goes silent | Never. Two URLs: `DATABASE_URL` (app, non-superuser role), `DATABASE_MIGRATION_URL` (migrate-only, owner role) |
| `Event.data` as untyped JSON | Flexible schema for event variants | Type errors only surface at runtime; no schema enforcement on `auto_status_changed` payload shape | Acceptable for Lean if a Zod schema per `EventType` is *parsed* on read. Just write it. |
| Skipping `pnpm depcheck` because "no new deps this PR" | Save 5 sec at commit time | First missed module-boundary violation is easier to fix in this PR than the next; CI gate per PRINCIPLES.md exists for a reason | Never. The pre-commit hook is the spec. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gmail OAuth | Storing `access_token` and re-using it across requests | Store only `refresh_token` (encrypted); fetch `access_token` per-batch via google-auth-library; never persist `access_token` |
| Gmail history.list | Treating `historyId` as permanently valid | Catch 404 → fall back to `messages.list?q=after:N` for last N days; reset `User.gmailHistoryId` after a successful full sync |
| Gmail messages.get | Calling per-email in a loop | Use `batchGet` (10x quota efficiency) or process in `Promise.all` chunks of 5; respect 250 quota-units/user/sec |
| Anthropic SDK | Letting default `maxRetries: 2` apply inside loops | `maxRetries: 0` for cron-tick calls; let the cron's next tick be the retry; otherwise burst → 529 → retry → 529 storm |
| Anthropic 529 vs 429 | Treating both the same | 429 = your quota; back off and slow. 529 = upstream capacity; retry safely (doesn't burn your quota) but don't retry-storm |
| Google OAuth scopes | Requesting `gmail.modify` or `gmail.readonly` (broad) | Use the most narrow scope foray actually needs — `gmail.metadata` doesn't return body but is sufficient for matching/threading. Trade-off: classifier needs body, so `gmail.readonly` is the right call — but be explicit about why |
| `pg` Pool sizing | Default `max: 10` everywhere | At single-user with 1 cron + 1 web request, `max: 10` is fine. If you flip to RLS via interactive transactions, each transaction holds a connection longer — bump `max` and watch `pg_stat_activity` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `findMany` without `take` | List view returns thousands of rows; React renders 5000 cards | `take: 50` default + cursor pagination; `URL` state for page | When `applications` count exceeds ~200 |
| N+1 on application detail | One query for app, then one per stage, one per event, one per email | `include: { stages: true, events: true, emails: true }` in the queries.ts call | Visible immediately; first user with >5 stages |
| Cron tick processes all unprocessed emails | Single tick takes 5 minutes; node-cron next tick overlaps; advisory lock holds; nothing happens for 30 min | Per-tick cap (e.g., 50 emails); resume from last-processed checkpoint | When unprocessed backlog grows past ~50 (first sync of a Gmail account with weeks of emails) |
| Synchronous email-by-email Gmail fetches | First sync takes 20 minutes for 500 emails | Use `batchGet` or `Promise.all(chunks)`; respect quota | First sync of any account with >100 unprocessed emails |
| Loading the full `bodyExcerpt` Text column on list queries | `/applications` page payload is huge | `select: { id: true, ..., bodyExcerpt: false }` in list queries | Visible at ~50 emails; degrades smoothly so easy to miss |
| `revalidatePath('/applications')` on every event write | Every classification triggers a page revalidation; SSR cost spikes | Batch revalidate at end of cron tick; or `revalidateTag` with a single tag per user | When cron processes >5 emails per tick |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging Anthropic prompts including email body excerpts to a file (`classifier-log.jsonl`) | The `.jsonl` file is gitignored but lives on disk indefinitely; a backup or sync (iCloud, Dropbox) leaks sensitive email content | Rotate `classifier-log.jsonl` daily; add `data/` to system Time Machine excludes; document in SETUP.md |
| Encrypting `gmail_refresh_token` with a key that lives in `.env.local` | Key + ciphertext on the same disk = no protection from disk theft | Acceptable for local-first single-user; document that disk-encryption (FileVault) is part of the threat model. Move to OS keychain when SaaS happens |
| `APP_PASSWORD`-derived HMAC secret with no rotation path | Compromised password means re-derivation invalidates all sessions including yours; no graceful rotation | Salt the HMAC with a separate `SESSION_SECRET` env var; rotate by changing the secret; document the cookie-invalidation behavior |
| Using `requireUser()` only in Server Actions (skipping Route Handlers) | The OAuth callback Route Handler at `/api/gmail/callback` is the canonical example — if it doesn't `requireUser()` first, a malicious link could attach a stranger's Gmail to your account | Every Route Handler in `src/app/api/**` begins with `requireUser()` unless it's an explicitly-public endpoint (auth/login). PRINCIPLES.md §"Security baseline" already says this; verify by grep. |
| Trusting `email.from` for sender identity | Email From headers are trivially spoofable; accepting "from: hr@google.com" as authoritative for a Google application is naive | Use `From` for matching (best-effort) but not for auth decisions; never grant any privilege based on email content |
| OAuth `redirect_uri` mismatch between dev and any future deploy | Locked-in `localhost:3000` means flipping to a domain breaks OAuth without a Google Cloud Console change | Use `env.PUBLIC_URL` for the redirect URI; keep `localhost:3000` and the future domain both in the OAuth client's allowed redirects from day one |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Toast-only undo for a 10-second window | Owner misses the toast; status change is irreversible-feeling even though the timeline event still allows undo | Permanent undo button on the timeline event for 24h after auto-action; toast is a *bonus* notification |
| Showing the LLM confidence as `0.83` (a number) in the review queue | Owner anchors on the number; doesn't develop intuition for what 0.83 means relative to 0.91 | Show as a 3-bar visual or "low / medium / high" with the precise number on hover; the number is for debugging, the bar is for triage |
| Status filter defaults to "All" | Stale-rejected applications dominate the list; today's-action items are buried | Default filter excludes `rejected` + `withdrawn`; add a count badge showing "+12 archived" so the user knows what's hidden |
| Sync-status hidden in `/settings` | Owner doesn't know polling is broken until they go looking | Persistent thin banner in main nav when `User.gmailLastSyncAt` is >2× the polling interval old (>30 min) |
| Auto-update event styled the same as manual events | Owner skims the timeline, can't tell which changes were system vs self | Auto-update events get distinct visual treatment (icon + color per DESIGN.md) — they are the *audit trail*, not just history |
| The capture form re-asks for company every time (no autocomplete) | 30-second goal gets blown to 90 seconds for the 5th application at the same company | Company autocomplete is in CAPT-01's spec; *test* it with 10 applications across 3 companies; if autocomplete UX is slow, it's not done |

## "Looks Done But Isn't" Checklist

- [ ] **Gmail OAuth flow**: Often missing token-revocation handling — verify by manually revoking access in https://myaccount.google.com/permissions and confirming foray surfaces the disconnection in `/settings`
- [ ] **Auto-update + undo**: Often missing the "next cron tick re-acts" path — verify by clicking undo, then triggering the cron immediately, and asserting the status stays undone
- [ ] **`tenantDb` wrapper**: Often missing one of `update`, `delete`, `upsert`, `count`, `aggregate` — verify by `grep "tenantDb(" src/features` and confirming every Prisma operation in scope is wrapped
- [ ] **RLS migration**: Often missing `FORCE ROW LEVEL SECURITY` — verify by `\dp <table>` in psql, looking for both `relrowsecurity` and `relforcerowsecurity`
- [ ] **Classifier rules**: Often missing the "noise" cases (newsletters, automated digests) which generate the most volume — verify by syncing a real Gmail and counting how many emails land in `unmatched` that should have been `noise`
- [ ] **Matcher**: Often missing the ATS-domain block — verify by syncing a Gmail with at least one Greenhouse / Lever / Workday email and confirming it doesn't false-attribute
- [ ] **Settings page sync state**: Often missing the "last sync at" timestamp — verify by reading `/settings` and confirming the on-screen value matches `User.gmailLastSyncAt` in DB
- [ ] **`/inbox` review queue**: Often missing the empty state — verify by acceptance-testing a fresh user with zero emails and confirming the page is welcoming, not a console error
- [ ] **Pre-commit hook**: Often missing one of the four checks — verify by running `cat .husky/pre-commit` (or whatever the hook file is) and confirming all four (`lint && typecheck && test:run && build`) plus `depcheck` are present
- [ ] **`.env.example`**: Often *includes* secrets accidentally — verify by `git diff main -- .env.example` and checking nothing has a real value

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Test-mode token expired (Pitfall 1) | LOW | Re-run OAuth flow from `/settings`; if 7-day clock will re-expire, flip OAuth to In Production with single-user audience |
| RLS not actually enforcing (Pitfall 2/9) | MEDIUM | Audit every `prisma.$queryRaw`; rewrite as `tenantDb`; add `FORCE ROW LEVEL SECURITY`; add escape-attempt test; re-run isolation tests as non-superuser role |
| Wrong auto-classification on real application (Pitfall 4) | LOW per-incident, HIGH cumulative | Use the timeline-permanent undo; raise the threshold for `rejection` specifically; add the offending email to `classifier-fixtures/should-not-have-fired.jsonl`; add a status-regression block |
| Cron double-firing (Pitfall 3) | LOW | Add the `globalThis.__forayCron` guard; restart dev server; confirm logs show one `register()` boot |
| Classifier ran in a loop (Pitfall 6) | MEDIUM | Add idempotency check on `email.classifiedBy`; add per-tick cap; check Anthropic dashboard for actual cost incurred; manually delete duplicate `classifier-log.jsonl` entries |
| Auto-update undone-then-redone (Pitfall 8) | MEDIUM | Add `email.reviewedByUser` check to act-stage; replay the affected event log; manually re-undo the application status |
| Scope crept past Lean (Pitfall 11) | HIGH (time) | Branch the in-progress feature, defer to Standard, revert main to last-Lean-passing state, ship Lean, re-merge feature work into Standard branch |
| Test count target met but real coverage missing (Pitfall 12) | MEDIUM | Re-spec FND-03 to category-based coverage list; write the missing tests *before* the next feature; treat it as Lean ship-blocking |

## Pitfall-to-Phase Mapping

| Pitfall | Severity | Prevention Phase | Verification |
|---------|----------|------------------|--------------|
| 1 — Test-mode 7-day token expiry | BLOCKING | `gmail-ingestion`, `auth` | `/settings` shows token-health banner; revoke + reauth flow exercised in QA |
| 2 — Prisma extension misses transaction context | BLOCKING | `foundational-hardening` | Escape-attempt test passes; pattern of `tx.$executeRaw` then `tx.<model>` is used everywhere |
| 3 — `node-cron` double-fires under hot reload | WOULD BITE EVENTUALLY | `gmail-ingestion` | One boot ID per dev session; advisory lock log shows no overlap |
| 4 — Trust crisis on first wrong auto-classification | BLOCKING (product) | `classifier`, `auto-update`, `review-queue` | Per-label thresholds in code; status-regression block tested; permanent undo on timeline |
| 5 — ATS sender-domain false positives | WOULD BITE EVENTUALLY | `matcher`, `capture` | ATS domains banned in capture validation; matcher test fixtures include Greenhouse/Lever/Workday samples |
| 6 — LLM cost cap is monitoring not control | WOULD BITE EVENTUALLY | `classifier` | Pre-call budget guard returns `RateLimited`; idempotency test asserts ≤1 LLM call per email |
| 7 — Privacy rule conflicts with review queue | WOULD BITE EVENTUALLY | `gmail-ingestion`, `review-queue` | Excerpt-only review works; degraded-mode banner appears on token failure |
| 8 — Auto-update + undo race | BLOCKING (product) | `auto-update` | Race test (`Promise.all(undo, act)`) asserts undo wins; `reviewedByUser` blocks re-act |
| 9 — RLS test passes via superuser bypass | WOULD BITE EVENTUALLY | `foundational-hardening` | Test connection uses non-superuser role; CI check asserts `relforcerowsecurity = true` |
| 10 — Prisma 7 generator/config gotchas | NICE TO PREVENT | `foundational-hardening` | ESLint rule blocks `from '@prisma/client'`; AGENTS.md has Prisma 7 troubleshooting section |
| 11 — "Just one more tiny field" scope creep | WOULD BITE EVENTUALLY | All phases (process discipline) | `.planning/standard-backlog.md` exists and accumulates entries; daily check against `lean.md` checkboxes |
| 12 — Test count theater | WOULD BITE EVENTUALLY | `foundational-hardening` | FND-03 re-spec'd as category list; per-directory coverage report; structural CI checks (Result return type, RLS enabled) |

---

## Sources

- [Google Cloud — Manage App Audience (test mode 100-user cap and 7-day token revocation)](https://support.google.com/cloud/answer/15549945?hl=en)
- [Google Cloud — Unverified apps screen + 100-user cap](https://support.google.com/cloud/answer/7454865?hl=en)
- [Nango — Google OAuth invalid_grant: Token has been expired or revoked](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/)
- [Gmail API — Method: users.history.list (404 + full-sync fallback)](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)
- [Greenhouse Support — no-reply email addresses](https://support.greenhouse.io/hc/en-us/articles/17675865619099-Greenhouse-Recruiting-no-reply-email-addresses)
- [Underdog.io — Stop Using No-Reply Emails for Recruiting (ATS sender-domain pattern)](https://underdog.io/blog/stop-using-noreply-emails-for-recruiting-messages)
- [Prisma Docs — Client extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
- [prisma/prisma#17948 — Client extensions in interactive transactions are bound to base client](https://github.com/prisma/prisma/issues/17948)
- [prisma/prisma#23583 — Interactive transactions with extended client for RLS in postgres causes blocking queries](https://github.com/prisma/prisma/issues/23583)
- [Prisma Docs — Upgrade to Prisma 7 (breaking changes)](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [prisma/prisma#28627 — Prisma Client 7 generated code breaks when bundling with Webpack](https://github.com/prisma/prisma/issues/28627)
- [PostgreSQL Docs — Row Security Policies (FORCE ROW LEVEL SECURITY, owner bypass)](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [pgBouncer — Features (transaction pooling and SET LOCAL caveats)](https://www.pgbouncer.org/features.html)
- [Daniel Imfeld — PostgreSQL Row Level Security notes (RLS + transaction pooling pitfalls)](https://imfeld.dev/notes/postgresql_row_level_security)
- [Blair Jordan — Testing RLS Policies in PostgreSQL with pgTAP](https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602)
- [Next.js Docs — Instrumentation hook (NEXT_RUNTIME guard, hot reload behavior)](https://nextjs.org/docs/app/guides/instrumentation)
- [Anthropic API Docs — Errors (529 vs 429 distinction)](https://docs.anthropic.com/en/api/errors)
- [TokenMix — Anthropic Overloaded Error workarounds 2026](https://tokenmix.ai/blog/anthropic-overloaded-error-why-workarounds-2026)
- foray internal: `PRINCIPLES.md`, `docs/milestones/lean.md`, `docs/decisions/0006-hybrid-trust-classifier.md`, `docs/decisions/0009-docker-and-postgres.md`, `prisma/schema.prisma`, `.planning/PROJECT.md`

---
*Pitfalls research for: foray Lean milestone (single-user job-hunt CRM with Gmail OAuth + LLM classifier on Next.js 15 + Prisma 7 + Postgres)*
*Researched: 2026-05-09*
