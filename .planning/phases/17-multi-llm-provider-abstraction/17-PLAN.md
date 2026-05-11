---
phase: 17-multi-llm-provider-abstraction
status: planned
date: 2026-05-11
---

# Phase 17 Plan: Multi-LLM Provider Abstraction

## Success Criteria

1. Classifier service depends on a provider-neutral LLM boundary.
2. Anthropic remains the default provider with unchanged behavior.
3. OpenAI can be selected as an optional provider from Settings.
4. Provider selection is persisted per user and used by Gmail ingestion.
5. Budget checks and cost logging still run before/after any provider call.
6. Tests cover provider selection, OpenAI adapter parsing/error paths, and Settings action validation.

## Tasks

1. Add schema/env support.
   - Add Prisma enum and `User.classifierLlmProvider`.
   - Add `OPENAI_API_KEY` to env and `.env.example`.
   - Generate Prisma client.

2. Add provider abstraction.
   - Add provider-neutral types and dispatcher.
   - Keep Anthropic adapter as default.
   - Add OpenAI Responses API adapter with structured JSON schema output.
   - Update budget pricing by model.

3. Wire runtime usage.
   - Load provider setting in `pollOnce`.
   - Pass provider to `classifyEmail`.
   - Preserve old tests by defaulting to Anthropic.

4. Build Settings UI.
   - Add server action to update provider.
   - Add client selector section with provider status.
   - Localize copy.

5. Verify.
   - Add/update unit tests.
   - Run targeted tests, typecheck, lint, full tests, and build.
