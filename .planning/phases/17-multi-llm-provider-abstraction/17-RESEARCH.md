---
phase: 17-multi-llm-provider-abstraction
status: researched
date: 2026-05-11
---

# Phase 17 Research: Multi-LLM Provider Abstraction

## Current State

- `src/features/classifier/service.ts` directly imports `classifyByLlm` and `MODEL` from `src/features/classifier/llm.ts`.
- `src/features/classifier/llm.ts` is Anthropic-specific: SDK client construction, Claude model constant, tool definition, response parser, and Anthropic error mapping live together.
- Budget/cost logging is service-level, but pricing is currently hard-coded for Anthropic Haiku.
- `pollOnce` calls `classifyEmail({ subject, bodyExcerpt })` without user-specific classifier settings.
- Settings currently has connection/token sections, so provider selection belongs there.

## External Research

- OpenAI docs describe the Responses API as the current model endpoint, and the model catalog says current OpenAI models are available via the Responses API.
- OpenAI structured outputs support a `json_schema` response format through `text.format`, with strict schemas for model output shape.
- OpenAI lists `gpt-5.4-nano` as designed for speed/cost-sensitive classification and extraction workloads, with Responses API support and structured outputs.

Sources:

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/models/gpt-5.4-nano/
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/api-reference/responses/create

## Implementation Direction

- Keep Anthropic as the default and preserve existing behavior.
- Add `LlmProvider` as a persisted user setting with values `anthropic` and `openai`.
- Add a provider-neutral classifier adapter boundary:
  - common input/output types
  - `classifyBySelectedLlm(input, provider)`
  - `getModelForProvider(provider)`
- Keep the existing Anthropic adapter in `llm.ts` for compatibility.
- Add an OpenAI adapter using `fetch` against `/v1/responses` to avoid a new dependency.
- Reuse the existing Zod output validator for both providers.
- Update budget cost computation to use model-specific pricing.
- Add Settings UI for provider selection and key availability state.

## Risk Notes

- OpenAI provider should fail closed with `Unauthorized` if `OPENAI_API_KEY` is missing.
- Provider selection must not bypass budget checks.
- Cost log must still contain only model, token counts, cost, and email hash.
- Classifier output should stay `{ label, confidence, classifiedBy }` for downstream code.
