# ADR-0008: Project named `foray`

**Status**: Accepted
**Date**: 2026-05-09

## Context

Three candidate names emerged in brainstorming: `foray`, `trove`, `helix`.

## Decision

**`foray`** — *noun. a sudden raid or military advance; an attempt or initial venture into a particular activity or area.*

## Rationale

- **Maps to the activity.** Each application is a foray — a deliberate, time-bounded venture into a new company. The product reframes "tracking applications" as "running a campaign of forays". Mental model upgrade for free.
- **Two syllables, ends in a long vowel.** Confident, professional, slightly archival.
- **Not overused.** No SaaS, framework, or major OSS tool owns the name. Some abandoned PyPI / GitHub repos exist but no live product.
- **Elegant in commands.** `cd foray`, `pnpm foray:dev`, `foray-extension` for the browser extension.
- **Matches eVoyage naming style.** Single elegant English word with metaphorical depth, not a portmanteau or acronym.

## Alternatives considered

- **`trove`** (treasury of valuable things) — beautiful aesthetic, fits "personal archive" framing, but more passive than the activity (forays are made; troves are kept).
- **`helix`** (winding spiral path) — captures non-linear interview paths, but more taken in dev tooling and abstract metaphor.

## Use in code

- Package name: `foray` (in `package.json`)
- Database name: `foray`
- Directory: `/Users/edwardpham/Documents/Programming/Projects/foray/`
- Future GitHub repo: `duypham9895/foray` (when created)
- The noun "foray" replaces "application" in user-facing copy where it doesn't lose clarity (see [CLAUDE.md § Domain Language](../../CLAUDE.md))

## Consequences

- Some new users / contributors will need a one-line explanation of the name. Mitigated by the README opening with the etymology.
- Pronouncement (`/ˈfɔːreɪ/` — "FOR-ay") is unambiguous; not a name like `Cycript` that requires phonetic guidance.
