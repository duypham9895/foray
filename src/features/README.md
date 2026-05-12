# Features — Vertical Slices

Each subdirectory is a self-contained user-visible capability. See [PRINCIPLES.md §"Architecture — Vertical Slice"](../../PRINCIPLES.md) for the full ruleset.

## Standard slice anatomy

```
<feature>/
├── actions.ts        # Server Actions: parse → authorize → call service
├── service.ts        # Business logic; returns Result<T, AppError>
├── queries.ts        # Prisma reads via tenantDb(userId)
├── schema.ts         # Zod input/output schemas
└── components/       # UI components used ONLY by this slice
```

## Module boundary rules (CI-enforced)

- Slices may import from `src/core/` and `src/ui/`.
- Slices **must not** import from each other.
- `src/core/` cannot import from `src/features/` or `src/app/`.
- Direct `prisma.*` is banned outside `src/core/db/`.

If two slices need to share something, it goes in `src/core/` (cross-cutting) or a new shared slice (domain-specific).

## Current slices

- `analytics/` — funnel, response-rate, and activity queries
- `applications/` — CRUD, status/stage changes, notes, tags, reminders, and application UI
- `auth/` — single-user gate and login actions
- `calendar/` — Google Calendar OAuth and interview event sync
- `classifier/` — rules plus LLM email classifier
- `documents/` — local file upload, download, validation, and deletion
- `inbox/` — Gmail sync, review queue, and email pipeline orchestration
- `matcher/` — email-to-application matching
- `recruiters/` — recruiter records and application links
- `search/` — cross-record search
- `settings/` — account, integration, token, and provider settings
- `shortcuts/` — keyboard shortcut provider and UI
- `today/` — operational dashboard queries and components

Capture is implemented as a cross-origin route handler at `src/app/api/capture/route.ts` that delegates into the application/capture flow rather than a separate `src/features/capture/` slice.
