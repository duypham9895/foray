-- Phase 17: persisted classifier LLM provider setting

CREATE TYPE "LlmProvider" AS ENUM ('anthropic', 'openai');

ALTER TABLE "users"
  ADD COLUMN "classifier_llm_provider" "LlmProvider" NOT NULL DEFAULT 'anthropic';
