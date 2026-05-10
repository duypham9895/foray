# Phase 11: Reminders + Cron Infrastructure - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner can set follow-up dates on applications and see overdue follow-ups on the Today dashboard, powered by a robust multi-job cron infrastructure. The `followUpAt` field already exists in the Prisma schema (nullable, indexed) — this phase wires it to UI and cron.

Scope: follow-up date editor, Today dashboard "Follow-ups due" section, count badge on nav, CronRegistry pattern.
Not scope: snooze/remind-me-later, browser push notifications, calendar integration.

</domain>

<decisions>
## Implementation Decisions

### Follow-up Editor UX
- **D-01:** Dedicated section in application detail view, placed between StageEditor and NotesEditor
- **D-02:** Quick-set buttons ("Tomorrow", "Next week", "Next month") alongside a date picker
- **D-03:** "Clear" button appears next to the date when a follow-up is set; one click to remove
- **D-04:** Always-visible state: section shows "Follow-up: May 15" or "No follow-up set" with Edit button

### Follow-ups Section Display
- **D-05:** "Follow-ups due" section on Today shows ALL overdue follow-ups (followUpAt <= now())
- **D-06:** Sorted oldest first (most overdue at top)
- **D-07:** Each card shows: role title, company, days overdue; clicking navigates to application detail
- **D-08:** Follows existing `TodaySection` wrapper pattern (icon, title, emptyMessage)

### Count Badge Behavior
- **D-09:** Badge on Today nav link shows only when count > 0 (disappears when no overdue)
- **D-10:** Badge counts only overdue follow-ups (matches "Follow-ups due" section scope)
- **D-11:** Number pill style (colored pill with count inside)

### CronRegistry API Shape
- **D-12:** Job array pattern: simple array of job definitions (name, schedule, handler) registered at startup
- **D-13:** Registry absorbs the 4 existing guards centrally (NEXT_RUNTIME, NODE_ENV, globalThis, advisory lock); job definitions only need name + schedule + handler
- **D-14:** Log-only observability via Pino (job start/finish/errors); no runtime status API

### Claude's Discretion
- Badge color (use existing design system accent/error color)
- Quick-set button labels and date offsets
- Empty state copy for "Follow-ups due" section
- CronRegistry file location and internal structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `PRINCIPLES.md` — Architecture style (Vertical Slice), TypeScript discipline, error handling philosophy
- `AGENTS.md` — Where things live, how to extend, critical commands
- `DESIGN.md` — UI/UX principles, color palette, tone of voice

### Data Model
- `docs/data-model.md` — Schema reference; `followUpAt` field on Application model (line ~153 in schema.prisma)

### Decisions
- `docs/decisions/0010-architecture-vertical-slice.md` — Feature slices under `src/features/<slice>/`
- `docs/decisions/0004-responsive-ui.md` — UI patterns

### Existing Code (read before implementing)
- `src/instrumentation.ts` — Current cron setup with 4 guards; to be refactored into CronRegistry
- `src/app/today/page.tsx` — Today dashboard with 7 parallel queries and 5 sections
- `src/features/today/components/` — TodaySection wrapper, DecisionsCard, InterviewsCard, QuietCard patterns
- `src/features/today/queries.ts` — Today dashboard query functions
- `src/features/applications/components/application-detail.tsx` — Application detail view layout
- `src/components/nav-links.tsx` — Nav link component (needs badge support)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TodaySection` wrapper component — icon/title/emptyMessage pattern for dashboard sections
- `followUpAt` field in Prisma schema — already nullable and indexed, ready to use
- `node-cron` dependency — already installed, used in instrumentation.ts
- `pg_try_advisory_lock` — existing Postgres advisory lock pattern for cron overlap prevention

### Established Patterns
- Dashboard sections use `<section className="rounded-lg border bg-card p-5">` pattern
- Application detail uses sequential sections: header → StatusBadge → StageEditor → NotesEditor → TagEditor → Timeline
- Today page fetches data with 7 parallel queries in server component
- Nav links are simple `<Link>` elements — no badge/count support yet

### Integration Points
- `src/instrumentation.ts` — Refactor point: extract cron setup into CronRegistry
- `src/app/today/page.tsx` — Add follow-ups query and FollowUpsCard section
- `src/components/nav-links.tsx` — Add count badge support (server component needs async data)
- `src/features/applications/components/application-detail.tsx` — Add FollowUpEditor section

</code_context>

<specifics>
## Specific Ideas

- Quick-set buttons should be "Tomorrow", "Next week", "Next month" — common follow-up intervals
- Follow-up editor shows "Follow-up: May 15" or "No follow-up set" — owner always sees current state
- Badge uses number pill style — consistent with common badge patterns
- CronRegistry is a simple job array, not a class — minimal abstraction for 2 jobs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-reminders-cron-infrastructure*
*Context gathered: 2026-05-10*
