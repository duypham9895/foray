# Phase 7: Today Dashboard - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Daily check-in view that shows today's interviews, stale forays, unreviewed emails, and week summary — the default landing page for authenticated users.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/applications/` — existing application list and detail views
- `src/app/inbox/` — review queue with email triage
- `src/features/classifier/` — classification labels and confidence
- `src/core/db/tenantDb()` — multi-tenant Prisma access
- shadcn/ui component library

### Established Patterns
- Server Components for data fetching (per Next.js App Router)
- Server Actions for mutations
- `canonicalStatus` enum for filtering
- `lastActivityAt` for staleness detection

### Integration Points
- `/today` — new page route
- `/` (root) — redirect to `/today` for authenticated users
- Existing application queries for stale foray detection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
