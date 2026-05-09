# Landing Page Design — foray

**Date:** 2026-05-09
**Status:** Approved
**Deployment:** GitHub Pages (static HTML in `landing/` folder on main branch)

---

## Goal

A single-page landing page that introduces foray to developer-audience strangers. Vision-first (aspirational, not limited to current build state). Answers "what, why, how" in the first 30 seconds.

## Audience

Developers and builders who appreciate well-engineered tools, self-hosted software, and local-first architecture. They read source code. They care about tech stack decisions.

## Design System Consistency

The landing page follows DESIGN.md exactly:

| Token | Value |
|---|---|
| Background | `#fafaf9` (light) / `#0c0a09` (dark) |
| Surface | `#ffffff` / `#1c1917` |
| Border | `#e7e5e4` / `#292524` |
| Text primary | `#1c1917` / `#fafaf9` |
| Text secondary | `#57534e` / `#a8a29e` |
| Accent | `#ca8a04` (amber-600 — "interviewing" status color, used sparingly for CTAs) |
| Fonts | Geist Sans (body), Geist Mono (code, technical) |

**Rules enforced:**
- No decorative icons. Text-driven hierarchy.
- No emoji in UI chrome.
- No gradients (`bg-gradient-to-br` forbidden).
- No "delight", "you've got this", "AI-powered" copy.
- Generous whitespace. Card padding `p-6`, section gap `gap-8`.
- Warm off-white background, not pure `#ffffff`.
- Tone: calm friend with a notebook, not startup marketing.

## Page Structure (10 sections, single-page with anchor nav)

### 1. Sticky Navigation
- Logo ("foray") left-aligned
- Section links: Story, Features, Architecture, Roadmap
- GitHub CTA button (right)
- Sticky to top on scroll

### 2. Hero
- **Tagline:** "Your Gmail knows when you get rejected. Your spreadsheet doesn't. foray bridges that gap."
- **3 differentiator bullets** (above the fold):
  - Local-first — your data never leaves your machine
  - Gmail auto-classification — rejections, interviews, recruiter outreach detected automatically
  - Self-hosted, no subscription — runs on your laptop, open source
- **CTAs:** "View on GitHub" (primary), "Get Started" (scrolls to bottom)

### 3. Why This Exists (Story)
- **Heading:** "I was tracking 40 applications in a spreadsheet. It was lying to me."
- **Body:** Origin narrative. Personal, honest. "I didn't need a prettier spreadsheet. I needed something that watches my inbox."
- **Tone:** First-person, developer-to-developer.

### 4. The Problem
- **Heading:** "Your spreadsheet doesn't read your email."
- **Layout:** Side-by-side comparison
  - Left: "Without foray" — Monday apply, Wednesday rejection missed, Friday still says "Applied"
  - Right: "With foray" — rejection auto-detected, recruiter email surfaced, stale forays flagged

### 5. How It Works (Pipeline)
- **Heading:** "Four-stage email pipeline. Rules-first, LLM as fallback."
- **Visual:** `ingest → match → classify → act` pipeline diagram (horizontal, each stage in a bordered box with description below)
- **Key insight callout:** "Regex catches 80%+ of emails with zero API cost. Only ambiguous emails go to Claude Haiku — keeping LLM spend under $0.50/day."

### 6. Features (grouped by user benefit)
- **Heading:** "What you get"
- **5 feature blocks**, each with title + 2-3 sentence description:
  1. "Capture in seconds, not minutes" — manual form, company autocomplete, one transaction
  2. "Your inbox, triaged" — Gmail polling, 5 classification labels, rules-first with LLM fallback
  3. "Status updates itself" — auto-update when confident, undoable, regressions require confirmation
  4. "Review queue for the uncertain" — low-confidence emails, 0-3 items/day, first 50 always reviewed
  5. "Campaign room view" — filterable list, chronological timeline, not a spreadsheet

### 7. For Developers (Architecture)
- **Heading:** "Read the source, not just the README"
- **Tech stack grid:** 2x2 cards — Runtime (Next.js 16 + TS5), Database (Postgres 16 + Prisma 7), LLM (Claude Haiku fallback), Architecture (VSA)
- **Key decisions paragraph:** VSA, tenantDb, branded types, Result<T, AppError>, rules-first classifier, local-first

### 8. Roadmap
- **Heading:** "Three milestones"
- **3 cards** (equal width):
  - Lean (v0.1): Manual capture + Gmail + classifier + review queue
  - Standard: + Bookmarklet + Today dashboard + tags + search
  - Full: + Chrome extension + docs + calendar + analytics

### 9. Get Started
- **Heading:** "Run it locally in 3 commands"
- **Prerequisites line:** "Requires Node.js 20+ and Docker. Runs on your laptop — no cloud setup needed."
- **Code block** (dark background, mono font):
  ```
  $ pnpm install
  $ docker compose up -d db
  $ pnpm dev
  # → http://localhost:3000
  ```

### 10. Footer
- Left: "Built by Duy Pham with Claude Code"
- Right: "Personal use. Not licensed for redistribution."

## Technical Approach

- **Single HTML file** (`landing/index.html`) with inline CSS (no build step, no dependencies)
- **CSS custom properties** for dark/light mode support via `prefers-color-scheme`
- **Geist fonts** loaded from Google Fonts CDN (same as the main app)
- **Anchor navigation** with smooth scroll (`scroll-behavior: smooth`)
- **Responsive** — works on mobile (stack columns, adjust font sizes)
- **No JavaScript frameworks** — vanilla JS only for sticky nav and smooth scroll
- **GitHub Pages config:** serve from `landing/` folder on main branch. In repo Settings → Pages, set source to "Deploy from a branch", branch `main`, folder `/landing`. This keeps the landing page separate from `docs/` (which contains architecture and ADRs for contributors).

## File Structure

```
landing/
├── index.html          # Single-page landing (all HTML + CSS inline or in <style>)
└── favicon.ico         # Optional — reuse from src/app/
```

## Content Tone

Every line of copy follows DESIGN.md tone rules:
- Informational, not motivational
- "Logged. We'll watch for replies." not "Your application has been captured!"
- Never write "AI", "smart", "intelligent", "automatic" in user-facing copy
- The product is a calm friend with a notebook

## Non-Goals

- No analytics, tracking, or cookies
- No form submissions or backend
- No JavaScript frameworks (React, Vue, etc.)
- No build pipeline (no webpack, no Vite)
- No third-party CSS frameworks (Tailwind via CDN is acceptable if desired, but inline CSS is simpler for a single page)
