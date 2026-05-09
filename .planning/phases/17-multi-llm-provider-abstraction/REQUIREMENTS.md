# Requirements: Phase 17 - Multi-LLM Provider Abstraction

**Phase**: Future-1  
**Derived from**: User feedback + architecture review  
**Maps to**: Plans 17-01, 17-02, 17-03

---

## Functional Requirements

| Req ID | Description | Plan | Acceptance Test |
|--------|-------------|------|-----------------|
| PROV-01 | Create `ILLMProvider` interface with standard methods | 17-01 | Interface defined, all providers implement it |
| PROV-02 | Implement Anthropic adapter (existing provider) | 17-01 | Claude calls work via `AnthropicProvider` class |
| PROV-03 | Implement OpenAI adapter (GPT-4, GPT-3.5) | 17-01 | OpenAI calls work via `OpenAIProvider` class |
| PROV-04 | Implement Google Gemini adapter | 17-01 | Gemini calls work via `GeminiProvider` class |
| PROV-05 | Implement MiniMax adapter | 17-01 | MiniMax calls work via `MiniMaxProvider` class |
| PROV-06 | Provider factory instantiates correct adapter | 17-01 | `createProvider({type: 'openai', apiKey})` returns `OpenAIProvider` |
| PROV-07 | User can select provider in settings | 17-02 | Settings page shows dropdown with 4 providers |
| PROV-08 | API key encryption + secure storage | 17-02 | Keys stored encrypted, never logged |
| PROV-09 | Test connection button (verify API key works) | 17-02 | Click button → quick API call validates credentials |
| PROV-10 | Fallback provider support (if primary fails) | 17-03 | Configuration allows backup provider |
| PROV-11 | Cost calculation per call (token count × rate) | 17-03 | Each LLM call logs cost in USD |
| PROV-12 | Cost dashboard (spend by provider, comparison) | 17-03 | Analytics page shows provider costs + recommendations |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Security | API keys encrypted at rest | Use AES-256 encryption |
| Security | No API key logging | Never appears in logs, error messages, or traces |
| Security | User isolation | Users only see/manage their own keys |
| Performance | Token counting latency | <100ms per call |
| Performance | Provider failover response time | <500ms (quick switch to fallback) |
| Cost | Accurate token counting | Match each provider's official tokenizer |
| Cost | Cost calculation accuracy | Within 1% of provider's billing |
| Reliability | Provider availability | 99% uptime across all providers |
| Compatibility | Backward compatibility | Existing Anthropic-only setup still works |

---

## Boundary Conditions

- **API key storage**: Max 1000 chars per key (encrypted)
- **Supported providers**: Phase 17 implements 4 (can extend in Phase 18+)
- **Fallback chain**: Primary → Fallback only (not unlimited chain)
- **Token limits**: Respect each provider's context window (200K for Claude, 128K for GPT-4, etc.)
- **Cost currency**: All costs in USD (convert if provider prices in other currency)

---

## Success Criteria

- [ ] `ILLMProvider` interface defined + all providers implement
- [ ] Anthropic provider adapter working
- [ ] OpenAI provider adapter working
- [ ] Gemini provider adapter working
- [ ] MiniMax provider adapter working
- [ ] Factory pattern instantiates correct provider
- [ ] Settings page allows provider selection
- [ ] API keys encrypted + secured
- [ ] Test connection validates credentials
- [ ] Fallback provider logic working
- [ ] LLMCallLog table tracking cost per call
- [ ] Cost dashboard showing provider comparison
- [ ] Migration from Anthropic-only → multi-provider transparent
- [ ] All classifier calls use provider abstraction
- [ ] All pre-commit checks pass

---

## Dependencies

- **Phases 1-16 complete**: Core Foray functionality exists
- **Classifier (Phase Lean-3)**: Refactored to use `ILLMProvider`
- **Email encryption library**: For API key encryption (use NaCl or libsodium)
- **Official tokenizer libraries**: Claude, OpenAI tiktoken, Gemini, MiniMax tokenizers
- **Provider SDKs**: `@anthropic-ai/sdk`, `openai`, `@google-cloud/vertexai`, `minimax` (npm packages)

---

## Out of Scope (Phase 17)

- Kimi, MiMo providers (Phase 18+)
- Local LLM providers (Ollama, LLaMA) — future phase
- Custom fine-tuned models — out of scope
- Multi-language model selection (one model per provider in Phase 17)
- Streaming optimization (basic streaming only)
- Batch API usage (cost saving through batches) — Phase 18

---

## Integration Points

- **Phase Lean-3 (Classifier)**: Refactor from Anthropic-only → use provider interface
- **Phase 15 (Analytics)**: Extend cost tracking + provider comparison dashboard
- **Phase 16 (Settings)**: Add provider selection + API key management
- **Future phases**: Support additional providers (Kimi, MiMo, local LLMs)

---

## Data Migration

**From Phase 16 → Phase 17**:
- Create default `UserLLMSettings` for all existing users
- Default provider: `anthropic` (their current setup)
- API key: Migrate from `env` variable to encrypted DB field
- No user action required (transparent upgrade)

---

## API Endpoints

- `GET /api/llm-providers` → List available providers + pricing
- `GET /api/settings/llm` → User's current provider + fallback config
- `PUT /api/settings/llm` → Update provider selection + API keys
- `POST /api/settings/llm/test-connection` → Verify API key works
- `GET /api/cost-analytics` → Cost dashboard data (by provider, time range)
- `POST /api/cost-analytics/recommendations` → AI suggests cheapest provider for user's pattern

---

## Testing Strategy

- Unit tests: Provider interface + each adapter
- Integration tests: Provider selection, API key encryption, cost calculation
- Security tests: API key isolation, no logging of credentials
- Performance tests: Token counting latency, failover response time
- E2E tests: User selects provider → classifier works with that provider
- Cost accuracy tests: Compare calculated cost with actual provider billing

---

## Documentation Required

- `docs/providers.md`: How to add new LLM provider
- `docs/cost-optimization.md`: Guide to choosing cheapest provider
- `core/llm/PROVIDERS.md`: Provider implementation details + costs
- User guide: How to bring own API key + configure provider

---

## Post-Phase 17 Roadmap

- **Phase 18**: Add Kimi + MiMo providers
- **Phase 19**: Local LLM support (Ollama)
- **Phase 20**: Batch API usage for cost savings
- **Phase 21**: Provider-specific model selection (GPT-4 vs. GPT-3.5, etc.)
