# Feature Research

**Domain:** Single-user, local-first job-application tracker
**Researched:** 2026-05-09
**Confidence:** HIGH for table-stakes / anti-features (multiple independent sources, including reviews of Huntr, Teal, Simplify, JobScan, JibberJobber, Notion templates). MEDIUM for differentiator framing — derived from foray's stated positioning (ADR-0001, ADR-0006) cross-referenced against gaps in commercial tools rather than direct user-research data.

## Scope reminder

This file does **not** redesign the Lean scope. The Lean milestone is fixed by `docs/milestones/lean.md` and the Active requirements in `.planning/PROJECT.md`. The job here is to label every Lean requirement against the broader market — what's table stakes vs. differentiator vs. anti-feature — so the team knows which Lean choices are "matching what users expect" vs. "deliberately different from the herd" vs. "deliberately omitted." A cross-reference matrix at the bottom maps every CAPT-/GMAIL-/CLASS-/MATCH-/AUTO-/REVIEW-/APP-/AUTH- requirement to a feature category.

## Feature Landscape

### Table Stakes (Users Expect These)

Things that, if missing, would push the owner back to a spreadsheet or Notion within a week. Every commercial competitor (Huntr, Teal, Simplify) ships all of these; even spreadsheet templates approximate them.

| Feature | Why Expected | Complexity | Lean status |
|---------|--------------|------------|-------------|
| **Manual application capture form** with company, role, URL, location, salary, source, applied date | Every tracker has this; the spreadsheet equivalent is row-1 of any template. Without it, capture fails before automation can help. | LOW | ✅ Lean — `CAPT-01..03` |
| **Status pipeline with fixed canonical states** (applied → screening → interviewing → offer / rejected / withdrawn) | All commercial tools use a 5–7 stage canonical pipeline (Huntr Kanban, Teal kanban, Simplify dashboard). Users globally filter / count by status — needs a fixed set, not free-form text. | LOW | ✅ Lean — schema `canonicalStatus` enum + `APP-01` filter + `APP-03` quick change |
| **Per-application detail view with chronological timeline** | Without one place to see "everything that happened with this foray", the tracker becomes write-only and users abandon it. Every competitor has this. | MEDIUM | ✅ Lean — `APP-02` (Stages + Events + Emails timeline) |
| **List/table view filterable by status with counts** | The "where am I in my pipeline?" view. Notion templates default to this; Huntr/Teal start with kanban but always offer a list view. | LOW | ✅ Lean — `APP-01` |
| **Free-form notes per application** | All trackers ship this; the most-used field after status. Captures the things the schema can't anticipate (interviewer name, recruiter quirks, prep links). | LOW | ✅ Lean — `APP-04` notes field |
| **Per-application sub-stages / interview rounds** (e.g., "Tech round 2", "Hiring manager call") | Canonical status is too coarse for "I have three interview rounds left." Notion users build manual sub-tables; Huntr/Teal use task-list-style nested items. | LOW–MEDIUM | ✅ Lean — `APP-04` add/edit/complete Stages inline (free-form per ADR-0005) |
| **Email-derived status updates (rejection / interview invite detection)** | The single biggest reason users adopt a dedicated tool over a spreadsheet — manual update fatigue is the #1 abandonment driver per Huntr/Teal complaint threads. Application Tracker for Gmail, G-Track, CareerSync all build their entire product around this. | HIGH | ✅ Lean — `GMAIL-01..04` + `CLASS-01..04` + `MATCH-01..03` + `AUTO-01..04` |
| **Review queue / inbox for ambiguous classifications** | Users tolerate "robot is uncertain, please confirm" but not "robot silently changed my data." Application Tracker for Gmail uses Gmail labels; foray uses an in-app inbox. | MEDIUM | ✅ Lean — `REVIEW-01..02` + `AUTO-02..03` |
| **Stale-application visibility** ("nothing has happened with this foray in N days") | Universally requested in Reddit threads and competitor reviews. Spreadsheets fail at this; Huntr surfaces it on cards. | LOW (visual badge) — MEDIUM (proactive reminder) | 🟡 Partial — `appliedAt` / `lastActivityAt` exist in schema (`APP-01` sortable) but no badge UI. **Stale badge deferred to Standard**, proactive reminder deferred to Full. Acceptable for Lean: sort-by-lastActivityAt is the workaround. |
| **Clickable role URL back to original posting** | One-click jump back to the JD. Trivially supplied by capture form. | LOW | ✅ Lean — `roleUrl` on form `CAPT-01` |
| **Applied-date / activity timestamps** | Funnel of "how long since I applied", "when did I hear back" only works with timestamps. Auto-set by the system; users never want to type these manually. | LOW | ✅ Lean — schema `appliedAt`, `lastActivityAt`, Event timestamps |
| **One-click bookmarklet/extension capture from LinkedIn / Greenhouse / Lever** | Huntr's #1 sticky feature; Teal and Simplify ship the same pattern. Reduces capture friction from ~30s typing to ~3s clicking. | MEDIUM | ❌ **Deferred to Standard milestone** — `bookmarklet` is the explicit Standard addition. Lean compensates with a fast manual form (`CAPT-01` <30s). This is a calculated risk: form quality must be excellent or owner reverts to spreadsheet. |
| **Settings/sync UI for the email connection** with status + manual "Sync now" | Otherwise users can't tell whether automation is even running. | LOW | ✅ Lean — `GMAIL-02` |
| **Search across applications** | Notion users rely heavily on search; Teal and Huntr both ship global search. After ~30 forays, browsing the list breaks down. | MEDIUM | ❌ **Deferred to Standard** (`/search?q=...`). Acceptable for Lean: with <30 forays the filterable list (`APP-01`) covers it. Becomes painful as foray count grows. |
| **Daily landing dashboard** ("today's interviews / what's stale / week summary") | Huntr, Teal, and Simplify all have a "today" or home view. Without one, users open the list and rescan from scratch every session. | MEDIUM | ❌ **Deferred to Standard** ("Today view"). Lean substitutes the `/applications` list as the landing page. Acceptable for v0.1 single-user; first thing to add in Standard. |

### Differentiators (Foray's competitive edge)

Things foray does that the commercial competitors don't, won't, or do worse. These are the reasons to build foray instead of paying $40/mo for Huntr Pro or wrestling a Notion template.

| Feature | Value Proposition | Complexity | Lean status |
|---------|-------------------|------------|-------------|
| **Hybrid trust model** — auto-update at ≥0.85 confidence, queue at <0.85, with prominent undo | Commercial Gmail-integration tools (Application Tracker for Gmail, G-Track) tend to be all-or-nothing: either auto-label everything (silent corruption risk) or push everything to manual review (no time saved). The middle path — confident → act, ambiguous → queue, always undoable — is foray's distinguishing claim per ADR-0006. | MEDIUM | ✅ Lean — `AUTO-01..04` + `REVIEW-01..02`. **Critical:** undo affordance must be obvious (`AUTO-04`) and `Event.undoable=true` must be permanent in the timeline. First wrong silent change is fatal. |
| **Rules-first classifier with LLM fallback** | Most Gmail-tracker tools today (Application Tracker for Gmail uses GPT-4o-mini for everything; G-Track uses generic AI scan) send every email to an LLM. Foray's rules path handles the ~80% of templated rejections / interview invites for free, deterministically, and offline. LLM only fires for the genuinely ambiguous. | MEDIUM–HIGH | ✅ Lean — `CLASS-01..04`. Cost cap (`$0.50/day` alert in `CLASS-04`) and explainability (`classifiedBy` on the result) are direct consequences. |
| **First 50 emails after Gmail connect bypass auto-update** | Builds user-corrected ground truth before trusting the classifier with any record. No commercial tool does this — they treat day-1 confidence the same as day-100. Mitigates the "first wrong auto-apply destroys trust" risk identified in PROJECT.md. | LOW | ✅ Lean — `AUTO-03` |
| **Local-first storage** (Postgres in Docker, no cloud account, no SaaS sign-up) | Commercial tools require an account, store your job-search data on their servers, and may train on it. Foray runs on your machine; the only outbound call is the LLM fallback (subject + ≤500 char excerpt only, logged for inspection). For a job search where confidentiality matters (current employer doesn't know), this is meaningfully different. | LOW (already done) | ✅ Lean — Docker Postgres, ADR-0003. The OAuth refresh token is the only sensitive item, and it's encrypted at rest. |
| **Hybrid status: 6 fixed canonical states + free-form per-foray stages** | Huntr's kanban forces every foray onto the same lane set; Teal lets you rename lanes globally. Neither gives you per-foray sub-stages without nesting kludges. ADR-0005's split (`canonicalStatus` enum for global filtering, free-form `Stage[]` per foray for the actual reality) avoids both failure modes. | LOW | ✅ Lean — schema enforces both; `APP-04` exposes free-form Stages inline. |
| **Email body excerpts only (≤500 char), full body fetched on demand** | Privacy posture that paid SaaS competitors can't match (their business model needs your data resident). Mentioned in CLAUDE.md §6 and PROJECT.md Constraints. | LOW | ✅ Lean — schema/ingestion contract is metadata + 500-char excerpt. Full body via Gmail API on demand for review queue display only. |
| **Permanent, undoable event timeline** — every status change writes an `Event` with `undoable=true` (or false), nothing is silently overwritten | Commercial tools tend to mutate state without an audit trail. Foray's model says: the timeline is the source of truth; status is a derived view. Recovers gracefully from a wrong auto-classification. | LOW (schema-only at Lean; UI in Standard via toast) | ✅ Lean — `AUTO-01` writes `Event(type='auto_status_changed', undoable=true)`; `APP-02` timeline displays. Toast affordance with 10s linger is Standard. Lean has the data; Lean's undo is "click into the timeline, click undo on the event." |
| **Domain language enforced through the codebase** ("foray", not "tracker"; "campaign", not "search"; "stage", not "step") | Not a user-visible feature in v0.1, but a product-thinking discipline that keeps scope honest. Mentioned in CLAUDE.md §3. Not a competitor differentiator per se, but a meta-feature: foray will resist scope creep that other tools have lost. | LOW | ✅ Lean — vocabulary established in CLAUDE.md, schema field names align. |

### Anti-Features (Deliberately rejected, with rationale)

Things commercial competitors ship that foray will **not** build, ever or until proven wrong. Each has a concrete reason — usually traceable to an ADR.

| Feature | Why Requested | Why Foray Rejects | Foray's Alternative |
|---------|---------------|-------------------|---------------------|
| **Auto-apply bots** (LazyApply, AIApply, "apply to 200 jobs") | Saves typing, promises volume. | Per ADR-0001: violates LinkedIn ToS (section 8.2 prohibits automated access); 70–85% account-ban rate within 30 days for browser-extension auto-appliers per 2026 ConnectSafely.ai data; recruiters detect mass applications instantly ("ten resumes from one person in five minutes is an instant red flag"); dilutes serious applications. Foray is `track + capture`, never `apply`. | Capture (bookmarklet in Standard / extension in Full); user always submits via the company's own flow. |
| **AI resume tailoring per job** (Huntr Pro, Teal, JobScan) | Headline feature for paid trackers. Useful in principle. | Not in foray's core value ("one screen tells me what's happening today"). Resume work is a different product category — JobScan and Teal are better at it and integrate fine alongside foray. Building it inside foray would (a) bloat scope, (b) require LLM cost discipline beyond the $0.50/day cap, (c) compete on a feature where foray has no edge. | Use Teal/JobScan for resume work. Foray links to them via the JD-paste field if useful. |
| **Application autofill** (Simplify Copilot's headline feature) | Saves time on Workday / Greenhouse forms. | Out of scope for tracker product surface; would require browser-extension scaffolding far beyond the bookmarklet's. Standard milestone bookmarklet covers capture without the autofill complexity. Full milestone may add a manifest-V3 extension but autofill is still not planned. | Manual capture form (Lean), bookmarklet (Standard), MV3 extension for capture only (Full). |
| **Cover letter generation / interview-question AI** (Teal, Huntr Pro) | "AI does my prep" sales pitch. | Not the foray value prop; LLM cost overruns; outputs typically require heavy human rewriting per Teal user complaints ("AI quality issues — much of the AI-generated content needs human tweaking"). Foray's $0.50/day budget is for classifier fallback, period. | Use a separate tool (ChatGPT, Claude, dedicated cover-letter products) or write them yourself. |
| **Multi-user / team / SaaS deployment** | Common upgrade path for B2C tools that find a niche. | PROJECT.md Constraints + Out of Scope explicitly defer this. Multi-tenant patterns are *baked in* (tenantDb, branded IDs, RLS — ADR-0002) so SaaS isn't ruled out forever, but Lean ships single-user; SaaS is a separate decision after Lean validates. | Architecture is multi-tenant-ready; deployment is single-user. |
| **Real-time collaboration / shared boards** | Recruiting CRMs ship this; some Notion templates support it for couples job-hunting together. | Foray is single-user by definition. Adding collaboration changes the auth model, the trust model, and the conflict-resolution model. None of those serve the owner. | Single-user gate (`AUTH-01..03`). |
| **Email auto-reply / templated outreach** (Kondo, GMass) | "Send 50 follow-ups in one click." | Confuses tracker with outreach tool. Recruiter detection of templated outreach is the same problem as auto-apply. Foray reads inbound emails, never sends. | User writes follow-ups in Gmail directly; foray surfaces "stale" indicators (Standard). |
| **Calendar integration (Lean)** | Interviews live on calendar; would be nice to sync. | Per PROJECT.md Out of Scope: "Google Calendar sync — Full milestone; calendar invites stay in Gmail/Calendar manually." OAuth scope additions trigger re-consent friction; sync loops add complexity for a feature that the manual workflow handles fine. | Calendar invites stay in Gmail/Calendar; Stages with `scheduledAt` are entered manually in Lean. Calendar sync is a Full-milestone feature, gated by "did Standard prove it's actually painful." |
| **Document / resume PDF storage** | Some users want one place for everything. | Per PROJECT.md Out of Scope and `docs/milestones/full.md`: "Document upload / storage — Full milestone; resume PDFs live in Drive for now." Adds storage management, version control, quota concerns. The `Document` entity is in the schema unused. | Drive/Dropbox link in the notes field for v0.1. |
| **Recruiter contact entity UI / recruiter CRM** | Useful for high-touch executive search. | Per PROJECT.md Out of Scope: "Recruiter entity UI — Full milestone; recruiter is a free-text field in v0.1." `Recruiter` entity is in the schema unused. Adding the UI in Lean would expand the surface area without validating need. | Free-text recruiter field on Application form (Lean). Promote to entity in Full if Lean usage shows the data is structured enough to warrant it. |
| **Tags + global cross-record search** | Notion-style flexibility; Huntr ships tags. | Per PROJECT.md Out of Scope: deferred to Standard. With <30 forays, `canonicalStatus` filter (`APP-01`) is enough. Tags become valuable when the dataset is large enough to need orthogonal slicing. | `canonicalStatus` filter (Lean); tags + search (Standard). |
| **Funnel analytics dashboard** ("47% interview rate, 11% offer rate") | Sounds insightful; competitors ship it. | Per PROJECT.md Out of Scope and Full milestone notes: "Analytics view — Full milestone; no funnel/cohort metrics until owner has ≥30 forays of real data." Funnel charts on n=5 forays are vanity metrics. Recruitment-funnel research consistently warns that small-sample conversion rates are noise, not signal. Adding this in Lean would invite premature optimization of the application strategy based on garbage data. | None until ≥30 forays exist. Then evaluate whether the chart actually changed a decision; skip if not. |
| **Social / sharing / "see how others did at this company"** | Glassdoor-adjacent; networks of trackers (Levels.fyi, Blind) ship this. | Foray is private and single-user. Sharing changes the threat model around scraping prevention, recruiter confidentiality, and per-record visibility settings. | Use Glassdoor / Blind separately for company research. |
| **Email auto-reply suggestions / AI-drafted thank-you notes** | "Smart reply" UX from Gmail itself. | The classifier already sends subject + excerpt to Anthropic; adding generation flips the privacy posture from "read excerpts" to "draft replies on your behalf." Trust regression. Cost regression. Quality regression (generic templated thank-yous read worse than 30s of personal writing). | User writes their own follow-ups. Foray surfaces stale forays so the user knows *when* to write one (Standard/Full). |
| **Nag notifications / aggressive reminders** | "Engagement" feature that drives retention metrics for SaaS products. | Owner is a single technical user using foray voluntarily; ringing a bell daily is anti-value. Per `docs/milestones/full.md` Risks: "Reminder fatigue — cap suggestions at 3 per day." | Stale indicator on application cards (Standard); opt-in reminders only (Full); never push notifications without explicit setting. |
| **Real-time collaboration with auto-sync between devices** | Common in modern SaaS. | Single-user, single-machine, local-first per ADR-0003. No conflict resolution required; no sync server to operate. If multi-device use emerges as real, that's a separate ADR. | Single Docker host; back up via `pg_dump` (Full milestone). |

## Feature Dependencies

```
[Manual capture form] (CAPT-01..03)
    └──enables──> [Application list / detail] (APP-01..04)
                       └──enables──> [Status pipeline visibility]
                                          └──enables──> [Stale indicator] (Standard)

[Gmail OAuth] (GMAIL-01..02)
    └──enables──> [Polling + Email storage] (GMAIL-03..04)
                       └──enables──> [Classifier] (CLASS-01..04)
                                          ├──enables──> [Matcher] (MATCH-01..03)
                                          │                  └──enables──> [Auto-update] (AUTO-01..02)
                                          │                                    └──enables──> [Undoable timeline events]
                                          └──enables──> [Review queue] (REVIEW-01..02)

[Auth] (AUTH-01..03) ──gates──> [All authenticated routes]

[tenantDb wrapper + RLS] (FND-01..02) ──underpins──> [Every Prisma access in every slice]
```

### Dependency Notes

- **Capture form must work perfectly before any automation matters** — per ADR-0001, the manual path is the trust foundation. Lean order has `CAPT-*` shipping before `GMAIL-*` is wired to UI for this reason.
- **Classifier depends on Gmail polling, not the other way around** — never reverse this. Polling can ship dumb (no classifier) and still be useful for review-queue-only mode. Classifier without polling has no input.
- **Auto-update depends on both classifier confidence AND matcher success** — `AUTO-01` requires `confidence ≥ threshold AND application matched`. If the matcher returns null, the email goes to review queue regardless of classifier confidence. This is correct: high confidence on an unattributed email is still ambiguous (which application?).
- **First-50-emails ground-truth bypass (`AUTO-03`) depends on counting emails per user** — needs an `EmailIngestionStats` or per-user counter. Important not to overlook in implementation; otherwise day-1 risk is unmitigated.
- **Stale indicator (Standard) depends on `lastActivityAt` being kept fresh** — every status change, every linked email, every note edit must update `lastActivityAt`. Lean schema must enforce this; deferring the *display* to Standard is fine, but the *data* must be correct from Lean day 1.
- **Tags + search (Standard) conflict with no other Lean feature** — they're additive. Their absence in Lean is purely a scope cut, not a dependency block.

## MVP Definition (Lean Milestone — v0.1)

The Lean milestone *is* the MVP definition. Reproduced here as a feature checklist for cross-reference, not as a re-scoping.

### Launch With (Lean = v0.1)

- [x] **Manual capture form** — `CAPT-01..03`. Table-stakes; without it, no foray exists to track.
- [x] **Gmail OAuth + polling** — `GMAIL-01..04`. Required input for the differentiator (auto-classification).
- [x] **Hybrid classifier (rules + LLM)** — `CLASS-01..04`. The differentiator over a spreadsheet.
- [x] **Email→Application matcher** — `MATCH-01..03`. Required so classifier output goes somewhere.
- [x] **Auto-update with undo + first-50 grace period** — `AUTO-01..04`. The trust model.
- [x] **Review queue** — `REVIEW-01..02`. Where ambiguity goes.
- [x] **Application list + detail** — `APP-01..04`. Where the owner actually looks.
- [x] **Single-user auth gate** — `AUTH-01..03`. Privacy floor.
- [x] **tenantDb + RLS + tests + green pre-commit** — `FND-01..04`. Architectural floor (per PRINCIPLES.md).

### Add After Validation (Standard = v0.x+1)

Trigger: Lean shipped, owner uses it for real for ≥1 week.

- [ ] **Bookmarklet** — capture friction reduction. Trigger: owner skips logging real applications because the manual form is too slow.
- [ ] **Today dashboard** — daily ritual surface. Trigger: owner reports re-orienting from the list every session.
- [ ] **Tags + global search** — orthogonal slicing. Trigger: foray count >30 and the canonical-status filter starts feeling coarse.
- [ ] **Stale-foray badge in UI** — the data exists from Lean (`lastActivityAt`); the visual indicator is Standard. Trigger: owner reports "I forgot about that one" ≥twice.
- [ ] **Toast-with-undo affordance for auto-classifications** — Lean has the data + permanent timeline undo; Standard adds the 10-second toast UX.
- [ ] **Keyboard shortcuts** (`n`, `/`, `g a`, `g i`, `g s`).
- [ ] **Playwright E2E suite**.

### Future Consideration (Full = v0.x+2, may be skipped)

Trigger: Standard shipped, owner used it ≥3 weeks. Each Full feature is gated by "did the absence of this actually hurt?" — see `docs/milestones/full.md` "Triggers to skip Full entirely."

- [ ] Native Chrome MV3 extension (skip if bookmarklet was good enough)
- [ ] Document storage (skip if Drive links in notes were enough)
- [ ] Recruiter entity UI (skip if free-text recruiter field was enough)
- [ ] Calendar integration (skip if manual Calendar entry was enough)
- [ ] Analytics dashboard (skip if no decision was changed by missing analytics)
- [ ] Follow-up reminders (skip if owner manually nudges from `lastActivityAt`)
- [ ] Dark mode, print stylesheet, backup/restore wizard

## Feature Prioritization Matrix (Lean only)

| Feature | User Value | Implementation Cost | Priority | REQ-IDs |
|---------|------------|---------------------|----------|---------|
| Manual capture form | HIGH | LOW | P1 | CAPT-01..03 |
| Application list + filter by status | HIGH | LOW | P1 | APP-01 |
| Application detail + timeline | HIGH | MEDIUM | P1 | APP-02 |
| Quick canonical status change | HIGH | LOW | P1 | APP-03 |
| Free-form Stages + notes | HIGH | LOW | P1 | APP-04 |
| Gmail OAuth + connection UI | HIGH | MEDIUM | P1 | GMAIL-01..02 |
| Gmail polling + cron | HIGH | MEDIUM | P1 | GMAIL-03..04 |
| Rules-first classifier | HIGH | MEDIUM | P1 | CLASS-01, CLASS-03 |
| LLM fallback classifier | HIGH | MEDIUM | P1 | CLASS-02 |
| LLM cost log + alert | HIGH | LOW | P1 | CLASS-04 |
| Email→Application matcher | HIGH | MEDIUM | P1 | MATCH-01..03 |
| Auto-update on high confidence | HIGH | MEDIUM | P1 | AUTO-01 |
| Review queue routing | HIGH | LOW | P1 | AUTO-02 |
| First-50 grace period | HIGH | LOW | P1 | AUTO-03 |
| Undo affordance (event-timeline minimum) | HIGH | LOW | P1 | AUTO-04 |
| Review queue UI (`/inbox`) | HIGH | MEDIUM | P1 | REVIEW-01..02 |
| Single-user auth gate | HIGH | LOW | P1 | AUTH-01..03 |
| tenantDb method coverage | HIGH | MEDIUM | P1 | FND-01 |
| Postgres RLS migration | HIGH | MEDIUM | P1 | FND-02 |
| ≥30 tests + pre-commit gate | HIGH | MEDIUM | P1 | FND-03..04 |

**All Lean items are P1 by definition** — this is the MVP. Anything that could be P2 was already moved to Standard or Full per ADR-0007's milestone discipline. The matrix exists to let the team double-check that nothing was secretly downgraded inside Lean.

## Competitor Feature Analysis

| Feature | Huntr | Teal | Simplify Copilot | App Tracker for Gmail | Notion templates | Foray Lean approach |
|---------|-------|------|------------------|-----------------------|------------------|---------------------|
| Manual capture form | ✓ | ✓ | ✓ (auto-saved from autofill) | ✗ (Gmail-only) | ✓ | ✓ — `CAPT-01..03` |
| Status pipeline (canonical) | ✓ kanban + list | ✓ kanban + list | ✓ list | ✓ Gmail labels | ✓ varies | ✓ canonical enum + filterable list |
| Free-form sub-stages | ✗ (tasks only) | partial (sub-tasks) | partial | ✗ | ✓ (DB flexibility) | ✓ — explicit `Stage[]` per ADR-0005 |
| One-click capture from job sites | ✓ extension | ✓ extension | ✓ extension | ✗ | ✗ | ❌ Lean → ✓ Standard (bookmarklet) |
| Gmail integration | ✗ (jobs only) | partial (contacts) | partial | ✓ (entire product) | ✗ | ✓ poll + classify + auto-update |
| Auto-classification of rejection / interview emails | ✗ | ✗ | ✗ | ✓ (LLM-only, all emails) | ✗ | ✓ rules-first + LLM fallback |
| Hybrid trust (auto-apply + review queue) | n/a | n/a | n/a | ✗ (auto-label everything) | n/a | ✓ — `AUTO-01..03` + `REVIEW-01..02` |
| Permanent undoable event log | ✗ (mutates state) | ✗ | ✗ | ✗ | ✓ (history if user adds it) | ✓ — `Event(undoable=true)` schema |
| Stale-application indicator | ✓ | ✓ | partial | ✗ | manual | 🟡 Lean has data, Standard has badge |
| Today dashboard | ✓ | ✓ | ✓ | ✗ | ✓ varies | ❌ Lean → ✓ Standard |
| Search across applications | ✓ | ✓ | ✓ | ✓ Gmail search | ✓ | ❌ Lean → ✓ Standard |
| Tags / cross-record filters | ✓ | ✓ | partial | ✓ Gmail labels | ✓ | ❌ Lean → ✓ Standard |
| AI resume tailoring | ✓ Pro | ✓ paid | ✓ | ✗ | ✗ | ✗ Anti-feature (use Teal/JobScan separately) |
| Cover letter generation | ✓ Pro | ✓ paid | ✓ | ✗ | ✗ | ✗ Anti-feature |
| Application autofill | ✗ (capture only) | ✗ | ✓ (entire product) | ✗ | ✗ | ✗ Anti-feature |
| Auto-apply bot | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ **Hard anti-feature per ADR-0001** |
| Funnel analytics | ✓ Pro | ✓ paid | ✓ | partial | manual | ✗ Lean/Standard → maybe Full (gated) |
| Document/resume storage | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ Lean/Standard → maybe Full (gated) |
| Recruiter CRM | ✓ contacts | ✓ contacts | ✓ contacts | ✗ | ✓ varies | ✗ Lean/Standard → maybe Full (gated, free-text in Lean) |
| Calendar integration | ✓ | ✓ | partial | ✗ | manual | ✗ Lean/Standard → maybe Full (gated) |
| Local-first / no cloud account | ✗ SaaS | ✗ SaaS | ✗ SaaS | partial (snippets to OpenAI) | ✓ (your workspace) | ✓ Docker Postgres + minimal LLM exposure |
| Multi-user / sharing | ✗ B2C | ✗ B2C | ✗ B2C | ✗ | ✓ workspace | ✗ Single-user by design (multi-tenant scaffolding only) |
| Pricing | Free → $40/mo Pro | Free → ~$30/mo | Free | Free (BYO OpenAI key) | Free (template) | Free (self-hosted, BYO API keys) |

**Foray's distinct slot in this matrix:** the only product that combines (a) Gmail-driven auto-classification *with hybrid trust + undo*, (b) local-first storage, (c) explicit refusal of resume / cover-letter / autofill / auto-apply scope creep. The closest comparable is "Application Tracker for Gmail" — but it auto-labels everything via LLM, has no in-app review queue, and stores nothing (no per-application timeline).

## Lean Requirement → Feature Category Cross-Reference

Quick scan that confirms every Lean REQ-ID maps to a clear feature category, and that no anti-feature snuck into Lean.

| REQ-ID | Feature category | Notes |
|--------|-----------------|-------|
| CAPT-01 | Table stakes (manual capture form) | <30s target matches competitor benchmarks |
| CAPT-02 | Table stakes (validation) — quality floor, not user-facing | Zod parsed/branded types per PRINCIPLES.md |
| CAPT-03 | Table stakes (atomic create) — quality floor | Application + Event in one transaction |
| GMAIL-01 | Differentiator enabler (Gmail OAuth) | Test mode is fine for single-user |
| GMAIL-02 | Table stakes (settings UI) | Without this, sync is invisible |
| GMAIL-03 | Differentiator enabler (polling + storage) | ≤500 char excerpt = privacy differentiator |
| GMAIL-04 | Differentiator enabler (cron) | In-process node-cron is correct for single-user local |
| CLASS-01 | Differentiator (rules-first classifier) | The cost-discipline + offline path |
| CLASS-02 | Differentiator (LLM fallback) | Wrapped in Result per error-handling discipline |
| CLASS-03 | Differentiator quality floor (explainability) | `classifiedBy` field is non-negotiable |
| CLASS-04 | Differentiator quality floor (cost cap) | $0.50/day alert protects the budget constraint |
| MATCH-01 | Differentiator enabler (matcher) | Result type required |
| MATCH-02 | Differentiator quality floor (deterministic tiebreak) | Conservative: unmatched defaults to review queue |
| MATCH-03 | Architecture floor (tenantDb-only) | PRINCIPLES.md §"Multi-tenant safety" |
| AUTO-01 | **Differentiator core** (hybrid trust auto-apply) | The undoable Event is the trust hinge |
| AUTO-02 | **Differentiator core** (review queue routing) | The other half of hybrid trust |
| AUTO-03 | **Differentiator unique** (first-50 grace period) | No commercial tool does this |
| AUTO-04 | **Differentiator core** (undo affordance) | First wrong auto-apply is fatal — must be obvious |
| REVIEW-01 | Table stakes (review queue display) — but review queue itself is a differentiator | Existing data shape, dedicated `/inbox` route |
| REVIEW-02 | Table stakes (review actions) | Confirm/override/link/ignore covers the grid |
| APP-01 | Table stakes (filterable list) | The default landing page in Lean |
| APP-02 | Table stakes (detail + timeline) | Timeline = chronological merge of Stages, Events, Emails |
| APP-03 | Table stakes (quick status change) | Dropdown in detail; full re-render acceptable |
| APP-04 | Table stakes (Stages + notes inline) | Free-form per ADR-0005 |
| AUTH-01 | Architecture floor (real session check) | Wires the existing `requireUser()` shim |
| AUTH-02 | Table stakes (login UI) | Single password field, HMAC cookie |
| AUTH-03 | Defense-in-depth (middleware redirect) | Real auth check stays in `requireUser()` per PRINCIPLES.md |
| FND-01 | Architecture floor (tenantDb method coverage) | Required for slices to compile cleanly |
| FND-02 | Architecture floor (Postgres RLS) | Second line of defense per ADR-0002 |
| FND-03 | Quality floor (≥30 tests) | Spread across classifier, matcher, env, tenantDb |
| FND-04 | Quality floor (pre-commit gate green) | Non-negotiable per CLAUDE.md §2.1 |

**No Lean requirement is an anti-feature.** All anti-features (auto-apply, AI resume tailoring, autofill, calendar, document storage, recruiter UI, tags, search, today dashboard, analytics, follow-up reminders, multi-user) are correctly absent from Lean.

**Three table-stakes features are deliberately absent from Lean and acceptable:**

1. **One-click capture (bookmarklet)** — deferred to Standard. Risk: if the manual form takes >30s, owner reverts to spreadsheet. `CAPT-01`'s <30s target is the mitigation; the form fields list (`company autocomplete, role title, role URL, JD paste, location, salary range, source, applied date`) is exactly what spreadsheet users type, so parity is achievable.
2. **Search across applications** — deferred to Standard. Risk: at >30 forays, the filterable list is hard to navigate. Mitigation: <30 forays expected during Lean validation period.
3. **Today dashboard** — deferred to Standard. Risk: owner re-orients every session, friction adds up. Mitigation: `/applications` list serves as default landing; sort by `lastActivityAt` gives partial "what changed" surface.

These three are the highest-risk Lean cuts. If owner self-reports any of them as a daily pain point during Lean validation, prioritize them at the top of Standard.

## Sources

### Primary product documentation
- [Huntr Job Tracker product page](https://huntr.co/product/job-tracker) — kanban + list, capture extension
- [Huntr Pricing](https://huntr.co/pricing) — free tier limits, $40/mo Pro
- [Huntr Chrome Extension help](https://help.huntr.co/en/articles/9859408-the-huntr-chrome-extension)
- [Teal HQ Job Tracker tool page](https://www.tealhq.com/tools/job-tracker)
- [Simplify Copilot landing](https://simplify.jobs/copilot) — autofill scope, free-tier features
- [Simplify Job Application Tracker page](https://simplify.jobs/job-application-tracker)
- [Application Tracker for Gmail (Chrome Web Store)](https://chromewebstore.google.com/detail/application-tracker-for-g/ejknjnphfnlhhalfagogfejcifleeglk?hl=en-US) — closest direct competitor for the Gmail-classification pattern
- [G-Track AI Job Tracker](https://jobtrack-ai.com/) — Gmail auto-sync product
- [CareerSync (open source, Gmail-integrated)](https://github.com/Tomiwajin/CareerSync)
- [Notion Marketplace: Job Application Tracking templates](https://www.notion.com/templates/category/job-application-tracking)

### Reviews and competitive analyses
- [ResumeHog: Huntr Review 2026](https://resumehog.com/blog/posts/huntr-review-2026-is-this-job-tracker-worth-it.html) — user complaints about field limits, missing custom resume per application
- [ResumeHog: Teal HQ Review 2026](https://resumehog.com/blog/posts/teal-hq-review-2026-is-this-job-search-tool-worth-it.html) — pricing complaints, AI quality issues, "feels like a spreadsheet"
- [Best Job Search Apps: Huntr vs Teal vs JibberJobber 2026 comparison](https://bestjobsearchapps.com/articles/en/huntr-vs-teal-vs-jibberjobber-best-job-application-tracker-for-2026-full-comparison)
- [Prentus: Best Job Tracker Apps 2026 (7 tested)](https://prentus.com/blog/we-found-the-5-best-job-tracker-tools-on-the-market) — spreadsheet-vs-app abandonment patterns
- [JobShinobi: Teal vs Huntr 2026 honest comparison](https://www.jobshinobi.com/compare/teal-job-tracker-vs-huntr)
- [Jobscan: Jobscan vs Teal](https://www.jobscan.co/blog/jobscan-vs-teal/) — JobScan's resume-optimization scope vs. tracker scope
- [HirePilot: Simplify Extension review](https://hirepilot.co/simplify-extension-review-does-it-actually-work/) — autofill quality on custom forms
- [Notionland: Job Application Tracker Notion templates](https://www.notionland.co/post/job-application-tracker-notion) — what Notion templates ship vs. miss

### Anti-feature evidence
- [CO/AI: AI bots flooding LinkedIn with auto-applications](https://getcoai.com/news/ai-bots-are-flooding-linkedin-with-job-applications/) — recruiter detection of mass applications
- [Semafor: LinkedIn's have-nots and have-bots](https://www.semafor.com/article/09/12/2024/linkedins-have-nots-and-have-bots) — quality dilution
- [Growleads: LinkedIn automation 23% ban risk 2026](https://growleads.io/blog/linkedin-automation-ban-risk-2026-safe-use/) — quantified ban rates
- [Scale.jobs: LazyApply ban risk on LinkedIn](https://scale.jobs/blog/lazyapply-risk-profile-banned-linkedin) — 70–85% ban rate within 30 days

### Analytics anti-feature evidence
- [Improvado: Vanity metrics — what to track instead](https://improvado.io/blog/what-is-a-vanity-metric)
- [daily.dev: Common recruitment funnel metric mistakes](https://recruiter.daily.dev/resources/common-recruitment-funnel-metric-mistakes/) — small-sample funnel rates as noise

### Internal references
- `docs/decisions/0001-track-and-capture.md` — auto-apply rejection rationale
- `docs/decisions/0006-hybrid-trust-classifier.md` — confidence threshold + rules-first decision
- `docs/decisions/0005-hybrid-stages.md` (referenced) — canonical status + free-form Stage split
- `docs/decisions/0007-milestone-progression.md` (referenced) — Lean → Standard → Full discipline
- `docs/milestones/lean.md`, `docs/milestones/standard.md`, `docs/milestones/full.md`
- `.planning/PROJECT.md` — Active / Out of Scope requirement registry

---
*Feature research for: single-user, local-first job-application tracker (`foray`)*
*Researched: 2026-05-09*
