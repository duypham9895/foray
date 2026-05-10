# Domain Pitfalls — foray v0.3 Full Milestone

**Domain:** Chrome extension, file storage, Google Calendar sync, analytics dashboard added to existing Next.js 16 + Prisma 7 + PostgreSQL job-application tracker
**Researched:** 2026-05-10
**Confidence:** HIGH on Chrome MV3 / Next.js integration items (official docs + known breaking changes); MEDIUM on Google Calendar sync loop patterns (community-reported, not personally verified); HIGH on file storage and Prisma integration items (verified against existing schema and codebase patterns).

This document covers pitfalls specific to adding the six v0.3 Full features to foray's existing system. For Lean-milestone pitfalls (OAuth token expiry, RLS, cron double-fire, classifier trust), see the separate Lean-era PITFALLS.md research.

Severity legend:
- **BLOCKING** — ship-stopper or data-corruption risk. Discover late and the milestone slips.
- **WOULD BITE EVENTUALLY** — works on day 1, breaks within first month of real use.
- **NICE TO PREVENT** — annoyance / polish. Worth a comment but not a redesign.

---

## Critical Pitfalls

### Pitfall 1: Chrome MV3 service worker dies silently, losing badge state and queued captures

**What goes wrong:**
You build the extension popup + content scripts. Capture works when the popup is open. But the background service worker (which maintains the unreviewed-inbox badge count and queues captures when the foray server is unreachable) silently terminates after 30 seconds of inactivity per MV3 rules. The badge resets to 0. A queued capture vanishes. The owner thinks everything synced; it didn't.

**Why it happens:**
MV3 replaced persistent background pages with ephemeral service workers. Three concrete failure modes:
1. **Service worker terminates after 30s of no events** ([Chrome docs: "Service worker lifecycle"](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)). Any state held in module-scope variables is lost. `chrome.alarms` can wake the worker, but the alarm itself doesn't carry data — the worker must re-derive state from `chrome.storage.local` on every wake.
2. **`chrome.storage.local` is async** — reading it in the service worker's top-level `await` blocks worker activation. If the read takes >5s (large storage), Chrome kills the worker before it finishes.
3. **Badge count requires `chrome.action.setBadgeText`** which must be called from the service worker. If the worker is dead when a new email arrives via push, the badge never updates.

**Severity:** WOULD BITE EVENTUALLY — the extension "works" during demo (popup is open, worker is alive). Breaks on day 2 of real use when the owner closes the popup and expects the badge to track inbox state.

**Warning signs:**
- Badge shows 0 after closing the popup, even though `/inbox` has unreviewed items
- A capture initiated when the foray server was offline (laptop sleeping) never appears after reconnect
- `chrome://serviceworker-internals` shows the worker in "STOPPED" state
- Console logs from the service worker disappear between popup opens

**Prevention (actionable):**
1. **All mutable state lives in `chrome.storage.local`, never in module variables.** The service worker reads from storage on every activation, writes back on every change. Module-scope variables are a cache at best, gone at worst.
2. **Use `chrome.alarms` for periodic badge sync** — wake every 5 minutes, fetch unreviewed count from `localhost:3000/api/inbox/count`, update badge. If the server is unreachable, keep the last-known count. This is the same pattern as the existing `node-cron` Gmail poll but in extension-land.
3. **Queue failed captures in `chrome.storage.local`** with a retry-on-alarm pattern. On each alarm wake, drain the queue against `localhost:3000/api/capture`. Log successful sends, remove from queue. This is idempotent if the capture endpoint uses the existing bookmarklet dedup logic (roleUrl uniqueness).
4. **Test the dead-worker scenario explicitly.** In the test plan: open popup, initiate capture, kill the service worker via `chrome://serviceworker-internals`, reopen popup, verify the queued capture is still there and eventually syncs.

**Phase to address:** Chrome extension phase (background service worker design + badge sync).

---

### Pitfall 2: Extension content scripts break on SPA navigation (LinkedIn, Greenhouse)

**What goes wrong:**
You write a content script that scrapes the job posting from `linkedin.com/jobs/view/*`. It works on initial page load. But LinkedIn is an SPA — navigating from search results to a job detail doesn't trigger a full page load, so the content script doesn't re-inject. The popup shows stale data from the previous page. Same issue on Greenhouse's embedded job boards.

**Why it happens:**
Content scripts run once per page load per the `matches` pattern in `manifest.json`. SPAs that use `history.pushState` or client-side routing do not trigger new content script injections. Three specific failure points:
1. **LinkedIn job detail pages** use client-side routing — clicking a job card in the feed doesn't reload the page, so the content script that was injected on `/jobs/search/*` doesn't re-run on `/jobs/view/*`.
2. **Greenhouse embeds** (`boards.greenhouse.io`) load job content in iframes or dynamically — the content script may fire before the DOM has the job data.
3. **The popup reads from the content script via `chrome.tabs.sendMessage`** — if the content script is stale or dead, the popup gets empty data and the user sees blank fields.

**Severity:** WOULD BITE EVENTUALLY — the "one-click capture" promise breaks on the most common user flow (browse jobs, click one, capture).

**Warning signs:**
- Popup shows data from the previous job posting, not the current one
- Capture works on first page load but fails after SPA navigation
- Greenhouse embeds show blank fields in the popup
- `chrome.runtime.lastError` shows "Could not establish connection. Receiving end does not exist."

**Prevention (actionable):**
1. **Use `chrome.webNavigation.onHistoryStateUpdated`** to detect SPA navigations and re-inject the content script. This fires on `pushState`/`replaceState` — exactly what LinkedIn and Greenhouse use.
2. **Content script should self-report readiness.** After injection, send a message to the background worker: `{ type: 'content-script-ready', url: window.location.href }`. The popup queries the background worker for the latest ready state, not the content script directly.
3. **Fallback: popup scrapes via `chrome.scripting.executeScript`** instead of relying on pre-injected content scripts. This is synchronous, runs in the current tab context, and doesn't depend on the content script being alive. Slightly slower (runs on popup open) but bulletproof.
4. **Test with real SPA navigations, not just fresh page loads.** The test plan must include: load LinkedIn search, click a job card, open popup, verify data matches the clicked job (not the search page).

**Phase to address:** Chrome extension phase (content script injection strategy).

---

### Pitfall 3: `localhost:3000` API calls from extension fail due to mixed-content or CORS

**What goes wrong:**
The extension popup calls `http://localhost:3000/api/capture`. On HTTP localhost this works in Chrome (localhost is exempt from mixed-content blocking). But the extension content script running on `https://linkedin.com` tries to call `http://localhost:3000` — this is a mixed-content request from an HTTPS page. Chrome blocks it silently. The capture fails with no error visible to the user.

**Why it happens:**
MV3 extensions have three execution contexts with different security rules:
1. **Popup** (`chrome-extension://...`) — can call HTTP localhost freely. No mixed-content issue because the popup origin is `chrome-extension://`, not `https://`.
2. **Content script** (running on `https://linkedin.com`) — bound by the page's Content Security Policy. Calling `http://localhost:3000` from `https://linkedin.com` is mixed-content; Chrome blocks it.
3. **Service worker** — same as popup, can call localhost. But if you route the capture through the content script (scrape → content script → API), you hit the mixed-content wall.

**Severity:** BLOCKING — if the capture flow routes through the content script, it silently fails on every HTTPS job site (which is all of them).

**Warning signs:**
- Capture works from the popup's manual-entry form but fails from the "auto-fill from page" button
- DevTools console on the job site page shows "Mixed Content" or "blocked:mixed-content" errors
- Network tab shows the fetch to localhost as "(blocked)"

**Prevention (actionable):**
1. **Content script scrapes data, sends to service worker via `chrome.runtime.sendMessage`. Service worker calls the API.** This is the standard MV3 pattern: content script never makes network requests to external servers, it only communicates with the service worker via the Chrome messaging API. The service worker (running in `chrome-extension://` context) calls `localhost:3000` freely.
2. **Never call `fetch('http://localhost:...')` from a content script.** Add an ESLint rule or a comment-block at the top of every content script file: "NO FETCH CALLS HERE. Send to service worker."
3. **Add `host_permissions: ["http://localhost:3000/*"]` in `manifest.json`** — required even for service worker fetch calls to localhost. Without it, Chrome blocks the request with a permissions error.
4. **Test from an HTTPS page.** Don't test capture from `chrome://extensions` or the popup alone — navigate to `https://example.com`, open the popup, trigger auto-fill. If it works there, it works on LinkedIn.

**Phase to address:** Chrome extension phase (manifest permissions + architecture decision: content-scrapes, worker-fetches).

---

### Pitfall 4: Document upload path traversal and MIME-type bypass

**What goes wrong:**
The milestone spec says "local file storage under `data/uploads/{userId}/{applicationId}/`." The upload endpoint accepts a filename from the client. An attacker (or a future multi-user scenario) sends `filename: "../../etc/passwd"` or `filename: "resume.pdf" + Content-Type: application/pdf` but the actual file is an executable. The path traversal writes outside the upload directory. The MIME bypass stores a malicious file that gets served with a PDF content-type.

**Why it happens:**
Three compounding mistakes:
1. **Trusting the client-provided filename.** The browser's `File.name` is user-controlled. `path.join(uploadDir, file.name)` with `file.name = "../../evil.sh"` resolves to a path outside the upload directory.
2. **Checking `Content-Type` header instead of file magic bytes.** The client can set any Content-Type. A `.exe` with `Content-Type: application/pdf` passes naive checks.
3. **Serving files with `Content-Type` derived from the stored filename extension.** If the stored file is actually an HTML file with `<script>`, serving it as `text/html` enables XSS in the download context.

**Severity:** BLOCKING for multi-user readiness (RLS is baked in per ADR-0002; file storage must match that safety level). For single-user, the path traversal is still a local privilege escalation risk.

**Warning signs:**
- Upload endpoint uses `file.name` directly in `path.join` or `fs.writeFile`
- No file extension whitelist (accepting `.js`, `.html`, `.exe`)
- Download endpoint infers Content-Type from the stored filename
- No `Content-Disposition: attachment` header on downloads (allows inline rendering)

**Prevention (actionable):**
1. **Generate server-side filenames.** Store the original filename in DB (`Document.filename`), but the actual file on disk is `{documentId}.{ext}` where `ext` is derived from the MIME type whitelist, not the client filename. Path traversal is impossible because the filename is a DB-generated integer.
2. **Validate MIME type via magic bytes**, not Content-Type header. Use `file-type` package (or equivalent) to read the first N bytes. Accept only: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `image/png`, `image/jpeg`. Reject everything else.
3. **Serve all downloads with `Content-Disposition: attachment`** and `Content-Type: application/octet-stream` (force download, never inline rendering). This prevents XSS via uploaded HTML/SVG files.
4. **Store uploads outside the Next.js `public/` directory.** Files in `public/` are served statically with their natural Content-Type — a stored `.html` file becomes an XSS vector. Use a dedicated API route (`/api/documents/[id]/download`) that checks auth, then streams the file with safe headers.
5. **Per-document size cap (10MB)** enforced both client-side (for UX feedback) and server-side (reject before writing to disk). The 1GB total quota soft-warning from the milestone spec is a UX feature, not a security control.

**Phase to address:** Document storage phase (upload endpoint + download endpoint).

---

### Pitfall 5: Google Calendar OAuth scope addition invalidates the existing Gmail refresh token

**What goes wrong:**
The existing Gmail integration stores a refresh token with `scope: ['gmail.readonly']`. The Calendar integration needs `calendar.events` + `calendar.events.readonly`. The milestone spec says "re-authentication required." What actually happens: when the user re-authenticates with the new scopes, Google issues a *new* refresh token and *invalidates the old one*. The Gmail integration, which is using the old refresh token, silently breaks. No emails are ingested until someone notices.

**Why it happens:**
Google's OAuth2 behavior: when a user re-consents with a different scope set, the previous refresh token is revoked ([Google OAuth docs: "Refresh token rotation"](https://developers.google.com/identity/protocols/oauth2/web-server#offline)). This is not documented as a "scope change" behavior specifically, but it's the observed behavior when `prompt: 'consent'` forces a new consent screen. The existing code in `src/app/api/gmail/auth/route.ts` uses `prompt: 'consent'` (line 17) which guarantees a new token on every auth.

**Severity:** BLOCKING — adding Calendar silently breaks Gmail. The owner discovers the breakage 12+ hours later when no new emails appear.

**Warning signs:**
- After Calendar re-auth, `User.gmailRefreshTokenEncrypted` is overwritten with a new value
- Gmail polling returns `invalid_grant` within minutes of Calendar auth
- Settings page shows "Gmail connected" but `gmailLastSyncAt` is stale
- The OAuth callback stores only one refresh token per user (single `gmailRefreshTokenEncrypted` column)

**Prevention (actionable):**
1. **Single OAuth flow, combined scopes.** When re-authenticating for Calendar, request BOTH `gmail.readonly` AND `calendar.events` + `calendar.events.readonly` in the same consent. One token, all scopes. The existing `gmailRefreshTokenEncrypted` column stores this combined token.
2. **Update `env.GOOGLE_REDIRECT_URI` and the auth route** to use the combined scope set. The Calendar auth route should *not* be a separate endpoint — it should be the same `/api/gmail/auth` (or a renamed `/api/google/auth`) that requests all scopes at once.
3. **After re-auth, immediately test both Gmail and Calendar access** in the callback handler. If either fails, roll back: don't overwrite the old refresh token. Store the new token tentatively, verify it works for both APIs, then commit.
4. **Surface "re-authentication needed" proactively.** If the Calendar feature is enabled but the stored token doesn't have Calendar scopes, show a banner in Settings: "Calendar sync needs additional permissions. Re-connecting will not affect Gmail." (This is true only if you do the combined-scope approach.)
5. **Consider separate refresh tokens per service.** Add a `calendarRefreshTokenEncrypted` column to `User`. This avoids the scope-conflict problem entirely but doubles the OAuth surface area. Trade-off: more columns, more auth flows, but zero risk of Calendar breaking Gmail. **Recommended approach for this project** — the single-user constraint means two auth flows is a one-time cost.

**Phase to address:** Google Calendar integration phase (OAuth scope design). Must be decided BEFORE writing the Calendar auth route.

---

### Pitfall 6: Calendar sync creates duplicate events in a loop (foray → calendar → foray → calendar...)

**What goes wrong:**
Owner creates a Stage with `scheduledAt` → foray creates a Google Calendar event. The Calendar event gets a Google-generated ID stored in the Stage. The cron polls Calendar, sees the event, tries to update the Stage — but the update triggers a "Stage changed" event, which triggers a Calendar event update, which triggers the next poll cycle. Even with idempotent checks, subtle field differences (timezone formatting, description truncation) cause the sync to detect a "change" every cycle.

**Why it happens:**
Two-way sync is the canonical hard problem of integration. Three specific failure modes:
1. **Field format mismatch.** Foray stores `scheduledAt` as UTC `DateTime` in Prisma. Google Calendar returns `dateTime` in RFC3339 with timezone (`2026-05-15T14:00:00+07:00`). Comparing these directly fails — `2026-05-15T07:00:00Z` !== `2026-05-15T14:00:00+07:00` even though they're the same instant. The sync detects a "difference" and updates, triggering the loop.
2. **Description/notes drift.** Foray puts the Stage notes in the Calendar event description. On the next poll, the Calendar description has Google's formatting (HTML entities, line-break normalization). Foray detects a difference, updates the Calendar, Calendar re-normalizes, repeat.
3. **`etag` / `updated` timestamp comparison is the right idempotency check**, but the Calendar API's `updated` field changes on *any* event mutation including attendee responses. If the owner declines their own test event, the `updated` timestamp changes, foray detects it, and the loop starts.

**Severity:** WOULD BITE EVENTUALLY — works for the first event, loops on the second when any field has a formatting difference.

**Warning signs:**
- Google Calendar event shows "last modified" updating every 15 minutes (the cron interval)
- The Stage's `updatedAt` column advances every cron tick even though no one touched it
- Logs show the same `calendarEventId` being updated on every poll cycle
- The Calendar event description accumulates duplicate content on each sync

**Prevention (actionable):**
1. **Store the Calendar `etag` on the Stage row.** Add `calendarEventEtag String? @map("calendar_event_etag")` to the Stage model. On poll: fetch event, compare etag. If unchanged, skip. If changed, update Stage. After writing to Calendar, store the new etag. Etag comparison is the only reliable idempotency check for Google Calendar.
2. **Normalize before comparing.** Parse both sides to UTC `DateTime` before comparison. Strip HTML entities and normalize whitespace in descriptions. Write a `normalizeCalendarEvent()` utility that both the write-path and the read-path use.
3. **One-way write with deferred read.** Foray writes to Calendar immediately on Stage create/update. Calendar polling is *read-only* and only updates Stage when the event was *externally modified* (declined, rescheduled by the organizer). Detect "externally modified" by checking if the `etag` changed AND the change wasn't initiated by foray (use a `lastSyncedEtag` field to distinguish).
4. **Debounce Calendar writes.** Don't write to Calendar on every Stage field change — batch changes within a 5-second window and write once. This prevents rapid-fire updates during form editing.
5. **Test the loop explicitly.** Create a Stage, let the sync run 3 times, assert the Calendar event was written exactly once and the Stage `updatedAt` didn't change on cycles 2 and 3.

**Phase to address:** Google Calendar integration phase (sync architecture design). Must settle one-way vs two-way before writing any sync code.

---

### Pitfall 7: Analytics dashboard queries are O(n^2) on the events table

**What goes wrong:**
The funnel visualization needs: for each application, trace the sequence of `canonicalStatus` changes over time. The naive query joins `applications` with `events` grouped by status. With 100 applications and ~500 events, this runs in 200ms. With 500 applications and 5000 events (3 months of active job hunting), it takes 4 seconds. The analytics page becomes unusable.

**Why it happens:**
The `events` table is append-only (per PRINCIPLES.md) and stores every status change, stage addition, email receipt, and note edit. It grows linearly with usage. Three specific performance traps:
1. **Funnel queries require window functions** (`ROW_NUMBER() OVER (PARTITION BY applicationId ORDER BY occurredAt)`) to find the *first* status change to each canonical state. Window functions on large event sets are expensive.
2. **Time-in-stage requires self-joins** — for each application, pair consecutive status-change events and compute the delta. This is an O(n) self-join per application, O(n^2) total.
3. **Filtering by date range + tags + source + industry** requires joining `applications` → `companies` → `events` with multiple WHERE clauses. Without composite indexes, Postgres does sequential scans.

**Severity:** WOULD BITE EVENTUALLY — analytics "works" with seed data, becomes sluggish after 2 months of real use. The owner stops using it.

**Warning signs:**
- Analytics page load exceeds 1 second with ~200 applications
- `EXPLAIN ANALYZE` on the funnel query shows `Seq Scan on events`
- The events table has >5000 rows with no indexes beyond the existing ones
- Browser network tab shows the analytics API response taking >2s

**Prevention (actionable):**
1. **Pre-compute daily aggregates in a materialized view.** Create `analytics_daily` table: `{ date, userId, applicationsCreated, statusChanges, source, canonicalStatus, count }`. Refresh on cron (daily) or on-demand. Analytics queries read from this 365-row-per-year table, not the raw events table.
2. **Add composite indexes for analytics query patterns:**
   ```sql
   CREATE INDEX idx_events_user_type_occurred ON events(user_id, type, occurred_at);
   CREATE INDEX idx_events_app_type_occurred ON events(application_id, type, occurred_at);
   ```
   These cover the funnel query's WHERE + ORDER BY without sequential scans.
3. **Compute time-in-stage in application code, not SQL.** Fetch all status-change events for the user (one query), compute durations in TypeScript. For 500 applications with ~3 status changes each, this is 1500 rows — trivial in memory, expensive as a SQL self-join.
4. **Benchmark early.** Before writing any analytics queries, seed 500 applications with 5000 events and `EXPLAIN ANALYZE` the funnel query. If it's >500ms, redesign before building the UI.
5. **Lazy-load analytics sections.** The page can show "Applications per week" (simple count query) immediately while the funnel and time-in-stage charts load asynchronously. Perceived performance matters more than actual query time.

**Phase to address:** Analytics dashboard phase (query design BEFORE UI). Benchmark with realistic data volumes.

---

### Pitfall 8: Document storage breaks `tenantDb` pattern because files aren't in Postgres

**What goes wrong:**
Every data access in foray goes through `tenantDb(userId)` which injects the userId filter. Documents are stored on the filesystem under `data/uploads/{userId}/{applicationId}/`. But the download API route needs to verify that the requesting user owns the document. The route reads `documentId` from the URL, looks up the `Document` row via Prisma (tenant-checked), then serves the file from `storagePath`. The pitfall: `storagePath` is a string column — if it's ever constructed from user input (e.g., the upload route), a crafted `storagePath` could serve arbitrary files from the filesystem.

**Why it happens:**
The `Document.storagePath` column stores the filesystem path. Two failure modes:
1. **Path traversal via `storagePath`.** If the upload handler writes `storagePath = '/etc/passwd'` (bug or injection), the download handler serves `/etc/passwd`. The tenantDb check on the `Document` row passes because the row is legitimately owned by the user — but the file it points to is not a document.
2. **Orphaned files on application delete.** `Application` has `onDelete: Cascade` for documents, which deletes the `Document` row. But the file on disk is not deleted by Prisma. Over time, `data/uploads/` accumulates orphaned files. Not a security issue, but a disk-space issue that compounds the 1GB quota warning.

**Severity:** WOULD BITE EVENTUALLY — the path traversal requires a specific bug, but the orphaned files are guaranteed.

**Warning signs:**
- `storagePath` column contains absolute paths or paths with `..`
- `data/uploads/` has files that don't correspond to any `Document` row
- The download route uses `storagePath` directly in `fs.readFile` without resolving against the upload root
- Application deletion doesn't log file cleanup

**Prevention (actionable):**
1. **`storagePath` is always relative to a configured upload root.** Store only `{applicationId}/{documentId}.{ext}` in the column. The download route resolves: `path.join(UPLOAD_ROOT, storagePath)`. After resolution, verify the resolved path starts with `UPLOAD_ROOT` (`path.resolve(result).startsWith(path.resolve(UPLOAD_ROOT))`). This prevents traversal even if `storagePath` is corrupted.
2. **Never construct `storagePath` from user input.** It's generated server-side from the `Document.id` (auto-increment) and the MIME-derived extension. The client never influences the path.
3. **Cleanup orphaned files on application delete.** Add a Prisma middleware or a service-layer hook: when an Application is deleted, read its Documents' `storagePath` values and `fs.unlink` each file. Wrap in a try/catch — missing files are OK, errors are logged.
4. **Add a `data/uploads/` cleanup script** to the backup/export feature (already in the Polish milestone). Run it monthly: find files not referenced by any `Document` row, log them, offer to delete.

**Phase to address:** Document storage phase (upload + download endpoint design).

---

### Pitfall 8b: Document storage doesn't extend `tenantDb` — new queries bypass tenant isolation

**What goes wrong:**
The existing `tenant.ts` has a TODO on line 254: `// TODO(duy, 2026-05-09): add tenantDb wrappers for recruiter, applicationRecruiter, document`. The Document, Recruiter, and ApplicationRecruiter models are in the schema but have no `tenantDb` wrappers. The new feature code queries these models directly via `prisma.document.findMany(...)` — bypassing the userId filter. In single-user mode this is invisible. In multi-user mode, it's a data leak.

**Why it happens:**
The TODO exists because the Lean milestone didn't need these models. The Full milestone wires them up, and the temptation is to use `prisma.document.*` directly (it works, tests pass, single-user). The `dependency-cruiser` rule "no-direct-prisma" may or may not cover these new models depending on how the rule is written.

**Severity:** WOULD BITE EVENTUALLY — invisible today, tenant-leak if multi-user ever happens (ADR-0002 says multi-tenant scaffolding is baked in for a reason).

**Warning signs:**
- `grep -r "prisma.document\." src/` returns hits outside `src/core/db/`
- `grep -r "prisma.recruiter\." src/` returns hits outside `src/core/db/`
- The `tenant.ts` TODO is still present after the feature is built
- Tests for Document/Recruiter queries use `prisma.*` directly instead of `tenantDb`

**Prevention (actionable):**
1. **Extend `tenantDb` BEFORE writing any feature code for Document, Recruiter, ApplicationRecruiter.** Add the wrappers as the first commit of each feature phase. Pattern: copy the existing `application` wrapper structure, adjust the model name and unique-key fields.
2. **For Document: the tenant check is via `application.userId`, not `document.userId`** (Document has no direct userId). The wrapper must join through Application: `prisma.document.findMany({ where: { application: { userId: numericUserId } } })`. This is the same pattern already used for `stage` (lines 171-179 of tenant.ts).
3. **For Recruiter: direct userId exists.** Copy the `application` wrapper pattern.
4. **For ApplicationRecruiter: tenant check via either application or recruiter.** Use the application path (more direct for the common query: "show recruiters for this application").
5. **Run `dependency-cruiser` after adding wrappers** to confirm the "no-direct-prisma" rule catches any remaining direct access.

**Phase to address:** Must be the FIRST commit of the Recruiter and Document storage phases.

---

### Pitfall 9: Recruiter email auto-link matches the wrong recruiter when multiple recruiters share an ATS domain

**What goes wrong:**
The milestone spec says: "when an Email arrives from a known recruiter's email address, link both to Recruiter and Application." The recruiter's email is `jane@greenhouse.io` (an ATS relay, not the recruiter's real email). Another recruiter, Bob, also uses `bob@greenhouse.io`. Every email from `@greenhouse.io` matches both recruiters. The auto-link picks the wrong one.

**Why it happens:**
This is the same ATS-domain problem from the Lean matcher (Pitfall 5 in the earlier research), but now it surfaces in the recruiter auto-link feature. ATS platforms relay recruiter emails through their own domains. The recruiter's actual email (which the owner entered manually) may be `jane@acme.com`, but the email arrives from `jane@greenhouse.io`.

**Severity:** WOULD BITE EVENTUALLY — any recruiter using an ATS relay email triggers this on the first email from that ATS.

**Warning signs:**
- A recruiter's stored `email` field contains an ATS domain (`greenhouse.io`, `lever.co`, etc.)
- Multiple recruiters share the same email domain and it's an ATS domain
- Auto-linked recruiter doesn't match the email's display name

**Prevention (actionable):**
1. **Ban ATS domains from `Recruiter.email` storage.** Same blocklist as the capture form (Pitfall 5 from Lean research). If the user enters `jane@greenhouse.io`, warn: "This looks like an ATS relay address. Enter the recruiter's direct email for accurate auto-linking."
2. **Auto-link matches on full email address, not domain.** The existing matcher uses domain matching as a tiebreak; the recruiter auto-link should use exact email match only. `email.from === recruiter.email` — no fuzzy matching, no domain matching.
3. **If the email is from an ATS domain, extract the display name and match against `Recruiter.name`.** `From: "Jane Smith <no-reply@us.greenhouse-mail.io>"` → parse "Jane Smith" → fuzzy match against recruiter names. Surface as a suggestion in the review queue, not an auto-link.
4. **Auto-link is a suggestion, not a hard match.** Show "Did this email come from Jane Smith?" in the review queue. The owner confirms. This is the same trust model as the classifier: auto-suggest, human confirms.

**Phase to address:** Recruiter entity phase (auto-link design). Requires the ATS domain blocklist from the capture form.

---

### Pitfall 10: Reminder cron competes with Gmail cron for the same advisory lock

**What goes wrong:**
The existing Gmail polling uses `pg_try_advisory_lock` to prevent concurrent ticks. The new reminder cron (checking `followUpAt <= today`) also needs to run on a schedule. If both crons fire at the same time and share the same lock namespace, one blocks the other. Or: if the reminder cron doesn't use advisory locks at all, it fires concurrently with itself under hot reload (the same Pitfall 3 from Lean research).

**Why it happens:**
The existing cron infrastructure uses `node-cron` in `instrumentation.ts`. Adding a second cron job is architecturally simple but operationally tricky:
1. **Both crons share the same `node-cron` scheduler instance.** If the globalThis guard (Pitfall 3 fix) stops one cron on hot-reload, it must stop both. A single `__forayCron` handle can only hold one cron job.
2. **Advisory lock keys must be distinct.** If both crons use `pg_try_advisory_lock(hashtext('foray:cron'))`, one will block. The reminder cron needs its own key: `hashtext('foray:reminder')`.
3. **The Calendar sync cron (if added) is a third concurrent job.** Three crons in one process, all potentially firing at the same time, all needing distinct locks.

**Severity:** NICE TO PREVENT — the crons will eventually sort themselves out via advisory locks, but concurrent ticks waste resources and produce confusing logs.

**Warning signs:**
- Two cron jobs fire in the same second, one blocks on the advisory lock
- Hot reload in dev spawns duplicate crons (the Lean Pitfall 3 pattern)
- The `instrumentation.ts` file has multiple `cron.schedule()` calls without a unified lifecycle manager

**Prevention (actionable):**
1. **Create a `CronRegistry` in `src/core/cron/`.** A single object that manages all cron jobs: `registry.register('gmail-poll', '*/15 * * * *', pollFn)` and `registry.register('reminders', '0 9 * * *', reminderFn)`. On hot-reload, `registry.stopAll()` — one guard for all jobs.
2. **Each cron function uses its own advisory lock key.** The lock key includes the job name: `hashtext('foray:gmail-poll')`, `hashtext('foray:reminders')`, `hashtext('foray:calendar-sync')`. No collisions.
3. **Stagger cron schedules.** Gmail poll at `*/15 * * * *` (every 15 min), reminders at `0 9 * * *` (9 AM daily), Calendar sync at `5 */15 * * *` (5 min past each 15-min mark). This avoids simultaneous-fire contention.
4. **Test the registry lifecycle.** Vitest: register 2 jobs, call `stopAll()`, assert both are stopped. Register, simulate hot-reload (call register again), assert old jobs are stopped and new ones are running.

**Phase to address:** Reminders phase (cron infrastructure upgrade). Should be done before Calendar sync adds a third cron.

---

### Pitfall 11: Analytics data export CSV exposes raw event JSON payloads

**What goes wrong:**
The milestone spec includes "Export CSV button for raw data." The export query fetches events with their `data` JSON column. The `data` column stores arbitrary payloads — for `auto_status_changed` events, it includes the email excerpt that triggered the classification. Exporting this to CSV leaks email content (body excerpts, subjects) into a file that the owner might share or upload to a job-search analytics tool.

**Why it happens:**
The `Event.data` column is typed as `Json @default("{}")` in Prisma. It stores structured payloads per event type. The CSV export probably does `SELECT * FROM events` and serializes the JSON as a string column. The resulting CSV contains email body excerpts that the privacy rule (CLAUDE.md section 7) says should not be stored indefinitely.

**Severity:** NICE TO PREVENT — single-user today, but the export creates a persistent copy of data that the privacy model says should be ephemeral.

**Warning signs:**
- CSV export includes a `data` column with raw JSON
- The exported CSV file contains email body excerpts
- The export doesn't have a column-selection UI or a "what will be exported" preview

**Prevention (actionable):**
1. **Define a CSV export schema.** Explicitly list which columns are exported. For events: `type, source, occurredAt, applicationId`. Exclude `data` by default. If the user wants the JSON payload, make it opt-in with a checkbox.
2. **Redact email excerpts in the export.** If `data` includes `bodyExcerpt`, replace with `[REDACTED]` in the CSV. The owner can see the full content in the app; the export is for analytics, not archival.
3. **Add a "Download includes email content" warning** if the user opts into including the `data` column.

**Phase to address:** Analytics dashboard phase (export feature design).

---

### Pitfall 12: Next.js `output: 'standalone'` doesn't include uploaded files

**What goes wrong:**
The `next.config.ts` has `output: 'standalone'` for Docker. The standalone output copies only the files needed to run the server — `node_modules` are pruned, `public/` is included, but `data/uploads/` is not. After a Docker rebuild, all uploaded documents are gone. The owner's resumes and cover letters vanish.

**Why it happens:**
Next.js standalone output traces `require()` and `import` calls to determine which files to include. Static files in `public/` are included because Next.js serves them. But `data/uploads/` is outside the traced dependency tree — it's runtime data, not build-time code. Docker rebuilds don't preserve it unless a volume mount is configured.

**Severity:** WOULD BITE EVENTUALLY — the owner won't notice until they rebuild the Docker image and check an old application's documents.

**Warning signs:**
- `data/uploads/` is not in `.dockerignore` (should be ignored by Docker COPY, served via volume mount)
- No Docker volume mount for `data/` in `docker-compose.yml`
- The backup/export feature (Polish milestone) doesn't include `data/uploads/`
- Document upload works in dev but files disappear after `docker compose down && docker compose up`

**Prevention (actionable):**
1. **Mount `data/` as a Docker volume.** In `docker-compose.yml`: `volumes: ['./data:/app/data']`. This persists uploads across container rebuilds.
2. **Add `data/` to `.dockerignore`** so Docker doesn't COPY it into the image (it would bloat the image and still be lost on rebuild).
3. **The backup/export feature must include `data/uploads/`.** The milestone spec says "downloads ZIP of pg_dump + uploaded documents." Verify this actually works by: upload a document, export backup, delete `data/uploads/`, import backup, verify document is restored.
4. **Document the volume requirement in `SETUP.md`** or the Docker section of the README.

**Phase to address:** Document storage phase (Docker configuration) and Polish phase (backup/restore).

---

## Moderate Pitfalls

### Pitfall 13: Extension popup loses state when Chrome throttles it

**What goes wrong:**
The extension popup shows auto-filled job data from the content script. The owner reviews the data, types a note, then clicks away to check something on the job page. The popup closes. When they reopen it, all entered data is gone — the content script re-ran and overwrote the manual edits.

**Prevention:**
1. **Persist form state in `chrome.storage.local`** keyed by tab URL. On popup open, check storage first, then content script.
2. **Clear storage on successful capture** (not on popup close).
3. **Debounce content script data** — don't overwrite user edits. Track a `dirty` flag: if the user has typed anything, don't auto-fill.

**Phase to address:** Chrome extension phase (popup state management).

---

### Pitfall 14: Recruiter entity introduces N+1 queries on the application list

**What goes wrong:**
The `/applications` list page now shows linked recruiters per application. The query fetches applications, then for each application, fetches its recruiters via the `ApplicationRecruiter` join table. With 100 applications, this is 101 queries.

**Prevention:**
1. **Use Prisma `include: { recruiters: true }` in the list query.** This generates a single query with a JOIN. The existing `tenantDb.application.findMany` wrapper accepts `args.include` — use it.
2. **If the recruiter data is only needed for display (name, role), use `select` instead of `include`** to avoid fetching `Recruiter.notes` and other large fields.
3. **Benchmark the list query with 200 applications and 300 recruiter links.** If >200ms, consider a denormalized `recruiterNames` text column on Application.

**Phase to address:** Recruiter entity phase (query optimization).

---

### Pitfall 15: Google Calendar event creation fails silently when the user's calendar is read-only

**What goes wrong:**
The OAuth scope includes `calendar.events` (read/write). But the user's primary calendar might have restricted sharing settings, or the OAuth consent might not actually grant write access (scope vs. permission mismatch). The Stage is created in foray, the Calendar event creation fails, but the error is swallowed. The owner thinks the event was created; it wasn't.

**Prevention:**
1. **Test Calendar write access immediately after OAuth callback.** Create a test event, verify it exists, delete it. If any step fails, surface the error in Settings.
2. **Store `calendarWriteEnabled: boolean` on the User row.** Set to `true` only after the post-OAuth write test passes. The Calendar sync feature checks this flag and degrades gracefully (read-only sync, no event creation) if `false`.
3. **Show Calendar sync status in Settings** — connected, read-only, or disconnected.

**Phase to address:** Google Calendar integration phase (OAuth callback + health check).

---

### Pitfall 16: Analytics chart library bloats the client bundle

**What goes wrong:**
You add a charting library (Chart.js, Recharts, Victory, etc.) for the analytics dashboard. The library is 200-500KB minified. It's imported on every page because the analytics layout is shared. The main bundle grows by 300KB. Every page load, including the Today dashboard and application list, is 300KB heavier.

**Prevention:**
1. **Dynamic import the chart library.** `const Chart = dynamic(() => import('recharts'), { ssr: false })`. Next.js code-splits this into a separate chunk that only loads on `/analytics`.
2. **Choose a lightweight library.** For simple bar/line charts, `recharts` (~200KB) or `@tremor/react` is overkill. Consider `chart.js` (~60KB) with tree-shaking, or `nivo` for React-specific charts.
3. **SSR the data, CSR the charts.** Fetch aggregate data server-side (fast), render charts client-only. The page shows data tables immediately; charts load async.

**Phase to address:** Analytics dashboard phase (library selection + dynamic import).

---

## Minor Pitfalls

### Pitfall 17: Extension version mismatch between dev and production

**What goes wrong:**
The extension is built from TypeScript via esbuild/Vite. The `manifest.json` has a `version` field. During development, you increment it manually. After a few iterations, the dev version (loaded via "Load unpacked") and the committed version diverge. A bug report references "extension v0.3.2" but the committed code is at v0.3.0.

**Prevention:**
1. **Derive extension version from `package.json` version.** The build script reads `package.json` version and writes it to `manifest.json` at build time. One source of truth.
2. **Add the extension version to the popup's settings/about section.** Visible to the owner without digging into Chrome's extension manager.

**Phase to address:** Chrome extension phase (build pipeline).

---

### Pitfall 18: Follow-up reminders fire for archived/completed applications

**What goes wrong:**
The owner sets a follow-up reminder on an application. The application gets rejected (canonicalStatus: rejected). The cron checks `followUpAt <= today` without filtering by status. The reminder fires for a dead application. Annoying.

**Prevention:**
1. **Filter reminders by active statuses only.** `WHERE followUpAt <= NOW() AND canonicalStatus NOT IN ('rejected', 'withdrawn') AND archivedAt IS NULL`.
2. **Clear `followUpAt` when application is archived or withdrawn.** Belt and suspenders with the query filter.

**Phase to address:** Reminders phase (cron query design).

---

## Integration Pitfalls (Cross-Feature)

### Pitfall 19: Extension capture bypasses the Zod validation that the web form enforces

**What goes wrong:**
The web capture form at `/applications/new` runs Zod validation client-side and server-side. The extension sends data directly to `/api/capture`. If the API route doesn't run the same Zod schema, the extension can submit invalid data (missing company name, negative salary, XSS in roleTitle). The existing bookmarklet may already have this issue.

**Prevention:**
1. **The `/api/capture` route must run the exact same Zod schema as the server action.** Import `schema.ts` from the `applications` or `capture` slice. Don't duplicate validation logic.
2. **Test the capture API with invalid payloads directly** (curl, not via the extension). Assert Zod errors are returned, not Prisma errors.

**Phase to address:** Chrome extension phase (API route validation).

---

### Pitfall 20: Multiple features add `Event` types without updating the timeline component

**What goes wrong:**
Document upload creates `Event(type='document_uploaded')`. Recruiter link creates `Event(type='recruiter_linked')`. Calendar sync creates a new event type. The timeline component in the application detail page (`/applications/[id]`) only renders known event types. New event types show as blank rows or crash the component.

**Prevention:**
1. **The timeline component must have a default renderer for unknown event types.** Show the event type as a label, the timestamp, and the `data` JSON as a collapsible raw view. Never crash on unknown types.
2. **When adding a new `EventType` enum value, add the corresponding timeline renderer in the same PR.** Make it a PR checklist item.

**Phase to address:** Every feature phase that adds an EventType. Enforce via PR checklist.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Chrome Extension | Service worker dies, losing state (Pitfall 1) | All state in `chrome.storage.local`, alarm-based badge sync |
| Chrome Extension | SPA navigation breaks content script (Pitfall 2) | `webNavigation.onHistoryStateUpdated` re-injection |
| Chrome Extension | Mixed-content blocks API calls from content script (Pitfall 3) | Content script scrapes, service worker fetches |
| Document Storage | Path traversal via client filename (Pitfall 4) | Server-generated filenames, MIME validation via magic bytes |
| Document Storage | Orphaned files on application delete (Pitfall 8) | Cleanup hook on delete, volume-mounted storage |
| Document Storage | `tenantDb` not extended for Document (Pitfall 8b) | Add wrappers as first commit, before any feature code |
| Document Storage | Standalone Docker output loses uploads (Pitfall 12) | Volume mount `data/`, add to `.dockerignore` |
| Recruiter Entity | ATS domain auto-link misattribution (Pitfall 9) | Exact email match only, ATS domain ban, display-name suggestion |
| Recruiter Entity | N+1 queries on application list (Pitfall 14) | Prisma `include` with JOIN |
| Google Calendar | Scope addition invalidates Gmail token (Pitfall 5) | Separate refresh tokens per service, or combined-scope single token |
| Google Calendar | Sync loop from field format mismatch (Pitfall 6) | Store `etag`, normalize before compare, one-way write |
| Google Calendar | Silent failure on read-only calendar (Pitfall 15) | Post-OAuth write test, `calendarWriteEnabled` flag |
| Analytics | O(n^2) funnel queries on events table (Pitfall 7) | Materialized views, composite indexes, benchmark early |
| Analytics | CSV export leaks email content (Pitfall 11) | Column-selection UI, redact excerpts by default |
| Analytics | Chart library bloats bundle (Pitfall 16) | Dynamic import, lightweight library |
| Reminders | Cron competes with Gmail cron (Pitfall 10) | CronRegistry with per-job advisory locks |
| Reminders | Reminders fire for dead applications (Pitfall 18) | Filter by active status, clear on archive |
| Cross-Feature | Extension bypasses Zod validation (Pitfall 19) | Same schema import in API route |
| Cross-Feature | New EventTypes crash timeline (Pitfall 20) | Default renderer for unknown types |

---

## "Looks Done But Isn't" Checklist (v0.3 Specific)

- [ ] **Chrome extension**: Test on SPA navigation (LinkedIn search → click job → capture). Not just fresh page loads.
- [ ] **Chrome extension**: Test with service worker killed (`chrome://serviceworker-internals` → Stop). Verify badge and queue survive.
- [ ] **Chrome extension**: Test from HTTPS page. Verify no mixed-content errors.
- [ ] **Document upload**: Test path traversal (`filename: "../../etc/passwd"`). Verify server rejects or sanitizes.
- [ ] **Document upload**: Test with non-PDF file (`.html`, `.exe`). Verify MIME validation rejects.
- [ ] **Document download**: Test with `Content-Disposition: attachment`. Verify no inline rendering.
- [ ] **Document storage**: Upload → delete application → verify file is cleaned up from disk.
- [ ] **Document storage**: Verify `tenantDb` wrappers exist for Document, Recruiter, ApplicationRecruiter.
- [ ] **Calendar sync**: Test scope addition doesn't break Gmail. Verify both APIs work after re-auth.
- [ ] **Calendar sync**: Create event → poll 3 times → verify no duplicate updates (etag check).
- [ ] **Calendar sync**: Test with declined event. Verify foray handles external modification without looping.
- [ ] **Analytics**: Benchmark funnel query with 500 applications / 5000 events. Verify <500ms.
- [ ] **Analytics**: Test CSV export. Verify email content is not included by default.
- [ ] **Reminders**: Test that reminder cron doesn't block Gmail cron (distinct advisory locks).
- [ ] **Reminders**: Set follow-up on application → reject application → verify reminder doesn't fire.
- [ ] **Cross-feature**: Add `document_uploaded` event → verify timeline renders it correctly.
- [ ] **Docker**: Verify `data/uploads/` survives `docker compose down && docker compose up`.

---

## Sources

- [Chrome Developers — Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome Developers — Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Developers — Manifest V3 migration: Background service workers](https://developer.chrome.com/docs/extensions/develop/migrate/improve-perf)
- [Google OAuth — Refresh token behavior](https://developers.google.com/identity/protocols/oauth2/web-server#offline)
- [Google Calendar API — Events](https://developers.google.com/calendar/api/v3/reference/events)
- [Google Calendar API — Sync](https://developers.google.com/calendar/api/guides/sync)
- [Next.js Docs — Output standalone](https://nextjs.org/docs/app/api-reference/next-config-js/output)
- [Prisma Docs — Client extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
- [PostgreSQL Docs — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP — Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- foray internal: `PRINCIPLES.md`, `CLAUDE.md`, `docs/milestones/full.md`, `prisma/schema.prisma`, `src/core/db/tenant.ts`, `src/features/inbox/gmail-client.ts`, `.planning/PROJECT.md`

---

*Pitfalls research for: foray v0.3 Full milestone (Chrome extension, document storage, recruiter entity, Google Calendar, analytics, reminders)*
*Researched: 2026-05-10*
