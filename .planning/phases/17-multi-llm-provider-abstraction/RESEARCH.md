# Research: Phase 17 - Multi-LLM Provider Abstraction

**Phase**: Future-1  
**Goal**: Support multiple LLM providers (OpenAI, Google Gemini, Anthropic, MiniMax, Kimi, MiMo) with unified interface  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state** (through Phase 16): Classifier uses Anthropic Claude exclusively. Users cannot choose alternative providers. If Anthropic API goes down or becomes expensive, no fallback.

**Friction points**:
- Locked to single provider (Anthropic)
- Cannot switch to cheaper alternative (MiniMax, MiMo)
- Cannot use preferred provider (OpenAI, Gemini if user/org prefers)
- No provider failover (if Claude API fails, classifier breaks)
- Cost optimization impossible (user cannot choose best rate)

**Solution**: Provider-agnostic LLM abstraction:
- **Single interface** (`ILLMProvider`) for all API calls
- **Runtime configuration**: User/tenant selects provider in settings
- **Multi-provider support**: OpenAI, Gemini, Claude, MiniMax, Kimi, MiMo
- **Fallback logic**: If provider fails, retry with alternative
- **User brings API key**: User manages credentials for chosen provider

---

## LLM Provider Landscape

**Supported providers for Phase 17**:

| Provider | API Model | Cost Model | Latency | Notes |
|----------|-----------|-----------|---------|-------|
| **Anthropic Claude** | Claude 3 family | $3-20/MTok | Medium | Current |
| **OpenAI GPT-4** | GPT-4, GPT-3.5 | $3-30/MTok | Medium | Widely used |
| **Google Gemini** | Gemini Pro, Ultra | $0.5-10/MTok | Medium | Competitive pricing |
| **MiniMax** | abab5.5, abab6 | $0.04-0.16/MTok | Low | Very cheap, Chinese |
| **Kimi (Moonshot)** | Moonshot v1 | $0.01-0.2/MTok | Low | Chinese market |
| **MiMo** | Pricing TBD | Very low | Low | Emerging |

**Scope for Phase 17**: Implement first 4 (Claude, OpenAI, Gemini, MiniMax). Others can be added in Phase 18+.

---

## Abstract Provider Interface

```typescript
// core/llm/provider.ts
export interface ILLMProvider {
  name: string;  // 'anthropic', 'openai', 'gemini', 'minimax'
  
  // Single completion call
  complete(prompt: string, opts?: CompletionOpts): Promise<string>;
  
  // Streaming completion
  completeStream(prompt: string, opts?: CompletionOpts): AsyncIterator<string>;
  
  // Token counting (for cost estimation + context limit checking)
  countTokens(text: string): Promise<number>;
  
  // Model info
  getModel(): string;
  getContextLimit(): number;
  getCostPer1kTokens(): { input: number; output: number };
}

export interface CompletionOpts {
  temperature?: number;  // 0-2 range (normalize across providers)
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}
```

---

## Provider Implementations

**Each provider has adapter class**:
```typescript
// core/llm/providers/openai-provider.ts
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  async complete(prompt: string, opts?: CompletionOpts): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens,
    });
    return response.choices[0].message.content;
  }
  
  // ... other methods
}
```

**Factory pattern for instantiation**:
```typescript
// core/llm/provider-factory.ts
export function createProvider(config: ProviderConfig): ILLMProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider(config.apiKey);
    case 'openai':
      return new OpenAIProvider(config.apiKey);
    case 'gemini':
      return new GeminiProvider(config.apiKey);
    case 'minimax':
      return new MiniMaxProvider(config.apiKey);
    default:
      throw new Error(`Unknown provider: ${config.type}`);
  }
}
```

---

## User Configuration

**Per-user provider selection** (in settings):

```prisma
model UserLLMSettings {
  id Int @id
  userId String @unique
  
  selectedProvider String  // 'anthropic', 'openai', 'gemini', 'minimax'
  apiKey String          // Encrypted
  apiKeyEncryptedAt DateTime
  
  // Fallback provider (if primary fails)
  fallbackProvider String?
  fallbackApiKey String?   // Encrypted
  
  createdAt DateTime @default(now())
  
  @@index([userId])
}
```

**UI/Settings page**:
- Dropdown to select provider
- Input field for API key (masked, encrypted)
- Option to set fallback provider
- Test connection button ("Verify API key works")
- Show estimated cost per classification

---

## Cost Tracking & Optimization

**Log each LLM call**:
```prisma
model LLMCallLog {
  id Int @id
  userId String
  provider String  // Which provider was used
  model String     // GPT-4, Claude 3 Opus, etc.
  
  inputTokens Int
  outputTokens Int
  costUSD Decimal  // Calculated: (inputTokens * inputRate + outputTokens * outputRate) / 1000
  
  duration Int     // Milliseconds
  success Boolean
  errorMessage String?
  
  createdAt DateTime @default(now())
  
  @@index([userId, createdAt])
}
```

**Cost dashboard** (in analytics):
- Total spend by provider (month, year)
- Cost per classification
- Provider comparison (which is cheapest for your workload)
- Recommendation: "Kimi is 10x cheaper for your usage pattern"

---

## Failover & Retry Strategy

**On provider failure**:
```typescript
async function classifyWithFailover(email: Email, userId: string) {
  const settings = await getUserLLMSettings(userId);
  
  try {
    // Try primary provider
    const result = await settings.primaryProvider.classify(email);
    return result;
  } catch (error) {
    logger.warn(`Provider ${settings.selectedProvider} failed, trying fallback`);
    
    if (settings.fallbackProvider) {
      try {
        const result = await settings.fallbackProvider.classify(email);
        // Log: switched to fallback
        return result;
      } catch (fallbackError) {
        // Both failed, add to review queue with error
        throw new ClassificationError('All providers failed');
      }
    }
    throw error;
  }
}
```

---

## Migration Path from Anthropic-Only

**Phase 16 → Phase 17 migration**:
1. Existing users default to Anthropic (no change in behavior)
2. New users can choose provider on signup
3. Existing users can opt-in to change provider in settings
4. Classifier code updated to use `ILLMProvider` instead of direct Anthropic calls
5. All classifier calls routed through factory + provider interface

**Zero downtime migration**: Existing setup keeps working, new flexibility added.

---

## Token Counting & Context Management

**Different providers have different tokenization**:
- Claude: Uses specific tokenizer
- OpenAI: Uses tiktoken
- Gemini: Uses own tokenizer
- MiniMax: Uses own tokenizer

**Solution**: Each provider implements `countTokens()` accurately.

**Classifier usage**:
```typescript
// Before sending email to LLM, check context limit
const emailTokens = await provider.countTokens(email.body);
if (emailTokens > provider.getContextLimit() - 500) {
  // Truncate email to fit context
  const truncated = truncateEmail(email, provider.getContextLimit() - 500);
  return await provider.complete(truncated);
}
```

---

## Provider-Specific Considerations

**Anthropic Claude**:
- Strengths: Best for nuanced classification, longest context (200K tokens)
- Cost: ~$3/MTok input, $15/MTok output
- Use case: Complex email understanding

**OpenAI GPT-4**:
- Strengths: Widely used, reliable, good pricing
- Cost: ~$3/MTok input, $6/MTok output
- Use case: Fast, good cost-performance

**Google Gemini**:
- Strengths: Competitive pricing, multimodal capable
- Cost: ~$0.5/MTok input, $1/MTok output
- Use case: Cost-conscious users

**MiniMax**:
- Strengths: Extremely cheap, Chinese market focus
- Cost: ~$0.04/MTok input, $0.12/MTok output
- Use case: Cost optimization, Chinese language support

---

*Phase 17 unlocks provider flexibility. Users optimize for cost, performance, or preference. Single abstraction, infinite providers.*
