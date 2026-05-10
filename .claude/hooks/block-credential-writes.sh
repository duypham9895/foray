#!/usr/bin/env bash
# PreToolUse:Write|Edit — block writes to credential / secret files.
# Foray adaptation of ringkas-devkit hook.
#
# Foray-specific extras (per CLAUDE.md §7 Privacy + Data Handling):
#   - data/classifier-log.jsonl   (gitignored, append-only-by-app)
#
# Blocked (basename or suffix):
#   .env, .env.local, .env.*, secrets.yml, credentials.json,
#   *.pem, *.p12, *.pfx, *.key, id_rsa*, id_ed25519*, id_ecdsa*
#
# Blocked (path contains):
#   /.ssh/, /.aws/, /.gnupg/, /.kube/config, /.netrc
#
# Allowed (templates and fixtures):
#   .env.example, .env.sample, .env.template, .env.dist
#   anything under tests/, fixtures/, __tests__/, test/

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/_lib.sh"

HOOK="block-credential-writes"

PAYLOAD=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
FILE_PATH=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

base="${FILE_PATH##*/}"
lower="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')"

deny() {
  hook_log "$HOOK" blocked "$1: $FILE_PATH"
  emit_pretooluse_deny "$1
File: $FILE_PATH
If this value needs to change, the engineer should edit it manually. The agent must not generate or modify credential files."
  exit 0
}

# ── Template/fixture allowlist ─────────────────────────────────────
case "$lower" in
  .env.example|.env.sample|.env.template|.env.dist|.env.default)
    hook_log "$HOOK" allowed "template file"
    exit 0
    ;;
esac

case "$FILE_PATH" in
  */tests/*|*/__tests__/*|*/fixtures/*|*/test/*|*/testdata/*)
    case "$lower" in
      *.env|*.env.*|*secrets*|*credentials*|*.pem|*.key)
        hook_log "$HOOK" allowed "test fixture: $FILE_PATH"
        exit 0
        ;;
    esac
    ;;
esac

# ── Foray-specific: classifier log (CLAUDE.md §7) ──────────────────
case "$FILE_PATH" in
  */data/classifier-log.jsonl|data/classifier-log.jsonl)
    deny "data/classifier-log.jsonl is append-only-by-app — never edited by hand."
    ;;
esac

# ── Basename blocks ────────────────────────────────────────────────
case "$lower" in
  .env|.env.production|.env.prod|.env.staging|.env.stg|.env.local|.env.dev|.env.development|.env.test|.env.qa|.env.uat)
    deny "Editing $lower is forbidden."
    ;;
  .env.*)
    deny "Editing environment file $lower is forbidden."
    ;;
  secrets.yml|secrets.yaml|credentials.json|credentials.yml|credentials.yaml|service-account.json|service-account-key.json)
    deny "Editing secret/credential file $lower is forbidden."
    ;;
  *.pem|*.p12|*.pfx|*.key|*.asc)
    deny "Editing cryptographic material ($lower) is forbidden."
    ;;
  id_rsa|id_rsa.*|id_ed25519|id_ed25519.*|id_ecdsa|id_ecdsa.*|id_dsa|id_dsa.*)
    deny "Editing SSH private key $lower is forbidden."
    ;;
esac

# ── Path-contains blocks ───────────────────────────────────────────
case "$FILE_PATH" in
  */.ssh/*|*/.aws/*|*/.gnupg/*|*/.gcloud/*|*/.docker/config*|*/.kube/config*)
    deny "Editing inside a credentials directory is forbidden."
    ;;
  */.netrc|*/.netrc.*|*/.pgpass|*/.my.cnf)
    deny "Editing $base is forbidden — it may contain passwords."
    ;;
esac

hook_log "$HOOK" allowed ""
exit 0
