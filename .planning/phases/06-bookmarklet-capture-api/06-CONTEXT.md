# Phase 6: Bookmarklet + Capture API - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

One-click job capture from any webpage — bookmarklet extracts page info (title, URL, selected text), POSTs to `/api/capture`, redirects to prefilled form. Reduces capture time from 1-2 minutes to <30 seconds.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing `src/app/applications/new/` form with Zod validation
- `src/core/auth/requireUser()` for auth checks
- `src/core/db/tenantDb()` for multi-tenant Prisma access
- shadcn/ui component library already installed

### Established Patterns
- Server Actions for mutations (per PRINCIPLES.md)
- Result types for error handling
- Zod schemas for validation (client + server)
- Vertical slice architecture in `src/features/`

### Integration Points
- `/api/capture` — new API route (POST)
- `/applications/new` — existing form, needs prefill support via query params
- `bookmarklet/foray.js` — new source file for bookmarklet

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
