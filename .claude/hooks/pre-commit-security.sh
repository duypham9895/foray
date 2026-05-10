#!/bin/bash
# PreToolUse:Bash — fires before git commit.
# Scans staged files for hardcoded secrets. Blocks if found.
# Adapted from ringkas-devkit.

if ! command -v jq &>/dev/null; then
  echo "Warning: jq not installed — pre-commit-security hook skipped." >&2
  exit 0
fi

PAYLOAD=$(cat)
COMMAND=$(echo "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null)

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

echo "Running security scan on staged files..." >&2
ERRORS=0
STAGED=$(git diff --cached --name-only 2>/dev/null)

if [ -z "$STAGED" ]; then
  exit 0
fi

ALLOWLIST="test|mock|example|placeholder|your_|<[^>]+>|os\.environ|getenv|get_settings|process\.env|config\."

for FILE in $STAGED; do
  [ -f "$FILE" ] || continue

  FILE_CONTENT=$(git show ":$FILE" 2>/dev/null)

  # key=value style secrets
  if echo "$FILE_CONTENT" | \
    grep -nEi "(api_key|secret_key|password|passwd|token|private_key|access_key|secret)\s*[=:]\s*['\"][^'\"]{8,}['\"]" | \
    grep -vEi "$ALLOWLIST"; then
    echo "Potential hardcoded secret in $FILE" >&2
    ERRORS=1
  fi

  # AWS access key IDs
  if echo "$FILE_CONTENT" | grep -nE "AKIA[0-9A-Z]{16}"; then
    echo "Potential AWS access key in $FILE" >&2
    ERRORS=1
  fi

  if echo "$FILE_CONTENT" | \
    grep -nEi "aws_secret_access_key\s*[=:]\s*['\"]?[A-Za-z0-9/+]{40}['\"]?" | \
    grep -vEi "$ALLOWLIST"; then
    echo "Potential AWS secret key in $FILE" >&2
    ERRORS=1
  fi

  # GCP API keys
  if echo "$FILE_CONTENT" | grep -nE "AIza[0-9A-Za-z_-]{35}"; then
    echo "Potential GCP API key in $FILE" >&2
    ERRORS=1
  fi

  # Anthropic API keys (foray-specific — primary risk)
  if echo "$FILE_CONTENT" | grep -nE "sk-ant-[A-Za-z0-9_-]{20,}"; then
    echo "Potential Anthropic API key in $FILE" >&2
    ERRORS=1
  fi

  # OpenAI API keys (foray Phase 17+ multi-LLM scope)
  if echo "$FILE_CONTENT" | grep -nE "sk-[A-Za-z0-9]{32,}"; then
    echo "Potential OpenAI API key in $FILE" >&2
    ERRORS=1
  fi

  # GitHub tokens
  if echo "$FILE_CONTENT" | grep -nE "gh[pors]_[A-Za-z0-9]{36,}"; then
    echo "Potential GitHub token in $FILE" >&2
    ERRORS=1
  fi

  # Private key headers
  if echo "$FILE_CONTENT" | grep -nE "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"; then
    echo "Potential private key in $FILE" >&2
    ERRORS=1
  fi

  # URL-embedded tokens/passwords
  if echo "$FILE_CONTENT" | \
    grep -nEi "https?://[^@\s]{8,}:[^@\s]{8,}@" | \
    grep -vEi "$ALLOWLIST"; then
    echo "Potential credentials in URL in $FILE" >&2
    ERRORS=1
  fi
done

if [ "$ERRORS" -ne 0 ]; then
  echo "Security scan FAILED. Use environment variables for secrets." >&2
  echo "See: CLAUDE.md §7 Privacy + Data Handling" >&2
  exit 1
fi

echo "Security scan passed." >&2
exit 0
