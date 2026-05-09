# ADR-0010: Vertical Slice Architecture, with thin `core/` for cross-cutting

**Status**: Accepted
**Date**: 2026-05-09

## Context

After scaffolding (commits up to v0.1.0), we needed an architectural stance before feature work began. The choice shapes folder layout, module boundaries, testing strategy, and cognitive load per change. Three real options:

1. **Layered (Clean Architecture / Hexagonal / Ports & Adapters)** — strict horizontal layers (entities → use cases → adapters), dependency direction enforced inward
2. **Vertical Slice Architecture (VSA)** — feature-first folders, each slice contains its own actions/service/queries/schema/components
3. **Just well-organized layers** — pragmatic mix, no formal pattern

Internet research (~24 sources, 3 parallel research agents) on what works at single-dev scale for Next.js 16 + Prisma 7 + Postgres apps. Strong signal from Bogard, Fowler, and recent VSA-vs-Clean comparisons that **layered architectures are insurance for events that don't happen at our scale**.

## Decision

Adopt **Vertical Slice Architecture**, feature-first, with a thin `src/core/` for genuinely cross-cutting concerns.

### Folder structure

```
src/
├── app/             # Next.js App Router (thin — delegate to slice services)
├── features/        # Feature slices: actions/service/queries/schema/components per slice
├── core/            # Cross-cutting: db, logger, errors, types, auth (KEEP SMALL)
├── ui/              # Shared design-system primitives
├── generated/       # Prisma generated client (gitignored)
└── test/            # Factories, fixtures, db helpers
```

Slices may import from `core/` and `ui/`. Slices **must not** import from each other (enforced by `dependency-cruiser`). `core/` cannot import from `features/` or `app/`.

### Auth + multi-tenant safety in the type system

- `tenantDb(userId)` wrapper in `src/core/db/` — every Prisma query for a tenant-scoped model goes through it. Direct `prisma.application.*` outside `core/db/` is banned by ESLint.
- Branded ID types (`UserId`, `ApplicationId`) in `src/core/types/ids.ts` so `userId`/`applicationId` mixups are compile-time errors.
- Postgres RLS as belt-and-suspenders, added in Lean milestone migrations.

### Error handling

`Result<T, AppError>` from `neverthrow` at expected-failure boundaries. Throw only for genuine programmer errors. Flat `AppError` taxonomy in `src/core/errors/`. ESLint plugin (`eslint-plugin-neverthrow`) fails CI on unhandled Results.

### When we'd reconsider VSA

- A second adapter for the same port enters production (e.g., second DB engine alongside Postgres)
- A second team owns a subset of `features/`
- A single feature exceeds ~600 LOC of business logic AND Prisma types are leaking into business code repeatedly

Until any of those: VSA is correct. Don't preemptively layer.

## Consequences

### Positive

- **Cognitive load per change is bounded.** A feature change touches one folder. The whole change is on screen at once.
- **Easier to delete features.** Vertical isolation means removing `features/recruiter/` is a folder delete, not an archeology dig across layers.
- **Type-system-enforced safety.** `tenantDb` + branded types catch the multi-tenant bugs that would silently leak data under "discipline alone."
- **Lower abstraction tax in v1.** No premature ports/adapters. Add layers when the second instance arrives.

### Negative

- **Empty slice stubs look weird until features land.** Acceptable: each empty file documents a future commitment.
- **Some duplication across slices** (each has its own `service.ts`, `schema.ts`). Acceptable per Sandi Metz's rule: duplication is far cheaper than the wrong abstraction.
- **`core/` discipline matters.** It's tempting to dump everything there. Mitigation: ESLint rule that `core/**` cannot import from `features/**`; periodic review that `core/` files are genuinely cross-cutting.

## Tooling

- `dependency-cruiser` — boundary enforcement in CI (5 rules, see PRINCIPLES.md §"Module boundaries")
- `eslint-plugin-boundaries` — editor-time feedback
- `eslint-plugin-neverthrow` — fails on unhandled Results
- `dotenv` — already added; envs validated by Zod in `src/core/env.ts`
- `pino` — structured logging
- `fishery` — test factories (added when first test lands)

## References

- [Bogard — Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/)
- [VSA vs Clean Architecture (2025) — Nadirbad](https://nadirbad.dev/vertical-slice-vs-clean-architecture)
- [Multi-Tenant SaaS Data Isolation with Prisma](https://dev.to/whoffagents/multi-tenant-saas-data-isolation-row-level-security-tenant-scoping-and-plan-enforcement-with-1gd4)
- [neverthrow — README](https://github.com/supermacro/neverthrow)
- [Casey Muratori — "Clean" Code, Horrible Performance](https://www.computerenhance.com/p/clean-code-horrible-performance)

## Supersedes

None. Establishes initial architectural stance.
