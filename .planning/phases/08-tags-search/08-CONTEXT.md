# Phase 8: Tags + Search - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

User-defined tags on applications + full-text search across company names, roles, notes, and tags.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/applications/` — existing list/detail views
- `src/features/applications/` — schema, queries, components
- `src/core/db/tenantDb()` — multi-tenant Prisma access
- shadcn/ui component library

### Established Patterns
- Server Components for data fetching
- Server Actions for mutations
- Zod schemas for validation

### Integration Points
- Application detail page — tag add/remove
- Application list — tag filtering
- New search bar component

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
