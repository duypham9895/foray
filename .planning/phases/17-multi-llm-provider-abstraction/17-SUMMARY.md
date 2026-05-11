---
phase: 17-multi-llm-provider-abstraction
status: completed
date: 2026-05-11
---

# Phase 17 Summary: Multi-LLM Provider Abstraction

## Shipped

- Added a provider-neutral classifier boundary with `classifyBySelectedLlm(...)` and `getModelForProvider(...)`.
- Kept Anthropic Claude Haiku as the default provider and preserved existing rules-first, budget-gated classifier behavior.
- Added an optional OpenAI adapter using the Responses API with strict JSON schema output and the shared classifier output validator.
- Added per-user provider persistence via `User.classifierLlmProvider` and a new `LlmProvider` Prisma enum.
- Wired Gmail ingestion to use the persisted provider setting when it escalates to LLM classification.
- Added Settings UI for choosing Anthropic or OpenAI and showing provider key availability.
- Updated budget pricing to compute cost by provider model while keeping the existing cost log privacy contract.
- Updated setup, architecture, data-model, roadmap, and state docs.

## Files of Interest

- `src/features/classifier/providers.ts`
- `src/features/classifier/openai.ts`
- `src/features/classifier/service.ts`
- `src/features/classifier/budget.ts`
- `src/features/settings/actions.ts`
- `src/features/settings/components/llm-provider-section.tsx`
- `src/features/inbox/service.ts`
- `prisma/migrations/20260511024500_add_llm_provider_setting/migration.sql`

## Verification

- `pnpm db:generate`
- `pnpm test:run src/features/classifier/service.test.ts src/features/classifier/budget.test.ts src/features/classifier/providers.test.ts src/features/classifier/openai.test.ts src/features/settings/actions.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:run`
- `pnpm build`

Notes:

- `pnpm lint` still reports existing dependency-boundaries deprecation warnings, but exits 0.
- `pnpm build` still reports the known Turbopack NFT tracing warning through `src/features/classifier/budget.ts`, but exits 0.
