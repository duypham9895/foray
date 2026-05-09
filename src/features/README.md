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

## Slices to be created (Lean milestone)

- `applications/` — CRUD + list + detail
- `capture/` — bookmarklet/extension capture flow
- `classifier/` — rules + LLM hybrid email classifier
- `matcher/` — email → application matching
- `inbox/` — Gmail sync + review queue
- `auth/` — single-user gate (Clerk-replaceable)

See [docs/milestones/lean.md](../../docs/milestones/lean.md) for deliverables.
