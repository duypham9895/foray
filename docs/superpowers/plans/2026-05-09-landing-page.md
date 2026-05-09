# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page static HTML landing page for foray, deployable via GitHub Pages.

**Architecture:** One HTML file (`landing/index.html`) with inline `<style>` CSS. No build step, no JavaScript frameworks. Vanilla JS for sticky nav and smooth scroll only. CSS custom properties for dark/light mode via `prefers-color-scheme`.

**Tech Stack:** HTML5, CSS3 (custom properties, grid, flexbox), vanilla JS, Geist fonts from Google Fonts CDN.

**Spec:** `docs/superpowers/specs/2026-05-09-landing-page-design.md`

---

## File Structure

```
landing/
└── index.html          # Single file — all HTML + CSS + JS
```

One file. No dependencies. No build.

---

### Task 1: Create HTML boilerplate + CSS design system

**Files:**
- Create: `landing/index.html`

- [ ] **Step 1: Create `landing/index.html` with boilerplate, CSS custom properties, and font loading**

Write the full HTML file with:
- `<!DOCTYPE html>` + `<html lang="en">`
- `<meta charset="UTF-8">`, viewport meta, title "foray — A campaign room for your job hunt"
- Open Graph meta tags (title, description, type, url)
- Google Fonts link for Geist Sans and Geist Mono
- `<style>` block with CSS custom properties matching DESIGN.md:
  - `--bg: #fafaf9`, `--surface: #ffffff`, `--border: #e7e5e4`
  - `--fg: #1c1917`, `--fg-secondary: #57534e`, `--muted: #a8a29e`
  - `--accent: #ca8a04` (amber-600)
  - Dark mode via `@media (prefers-color-scheme: dark)` overriding to `--bg: #0c0a09`, `--surface: #1c1917`, etc.
- Base reset: `box-sizing: border-box`, `margin: 0`, smooth scroll on `html`
- Body styles: `background: var(--bg)`, `color: var(--fg)`, `font-family: 'Geist Sans', sans-serif`
- Max-width container: `.container { max-width: 680px; margin: 0 auto; padding: 0 24px; }`
- Typography: `h1` at `2.25rem` (hero), `h2` at `1.25rem` (sections), body at `1rem`, small at `0.875rem`
- Mono: `code, .mono { font-family: 'Geist Mono', monospace; }`

- [ ] **Step 2: Open in browser to verify fonts load and CSS variables apply**

Open `landing/index.html` in browser. Verify:
- Background is warm off-white (`#fafaf9`)
- Geist Sans renders for body text
- No console errors

---

### Task 2: Build sticky nav + hero section

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 3: Add sticky navigation bar**

Add `<nav>` inside `<body>`:
- Position: sticky, top: 0, z-index: 100
- Background: `var(--bg)` with slight opacity/blur (`backdrop-filter: blur(8px)`)
- Flex layout: logo left, links center, GitHub button right
- Logo: "foray" in `font-weight: 700`, `letter-spacing: -0.5px`
- Links: Story (`#story`), Features (`#features`), Architecture (`#architecture`), Roadmap (`#roadmap`)
- GitHub button: amber background, white text, rounded

CSS for nav:
```css
nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: 14px 0;
}
```

- [ ] **Step 4: Add hero section**

Add `<section id="hero">` after nav:
- H1: "foray" (large, `2.25rem`, `letter-spacing: -1.5px`)
- Tagline: "Your Gmail knows when you get rejected. Your spreadsheet doesn't. foray bridges that gap." (`1.125rem`, `var(--fg-secondary)`)
- 3 differentiator bullets:
  - **Local-first** — your data never leaves your machine
  - **Gmail auto-classification** — rejections, interviews, recruiter outreach detected automatically
  - **Self-hosted, no subscription** — runs on your laptop, open source
- Each bullet: bold label in `var(--fg)`, dash, description in `var(--muted)`
- Two CTA buttons: "View on GitHub" (primary, amber bg) and "Get Started" (secondary, border only)
- "Get Started" links to `#get-started` with smooth scroll

- [ ] **Step 5: Verify nav sticks and hero renders**

Scroll the page. Nav should stay fixed at top. Hero tagline and bullets should be readable. Buttons should be visually distinct.

---

### Task 3: Build Story + Problem sections

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 6: Add "Why This Exists" story section**

Add `<section id="story">`:
- Label: "WHY THIS EXISTS" (small, uppercase, `var(--muted)`, `letter-spacing: 0.5px`)
- Heading: "I was tracking 40 applications in a spreadsheet. It was lying to me."
- Body paragraphs (3):
  1. "Every cell said 'Applied' or 'Interviewing.' But half of them had been silently rejected — the emails were buried in a Gmail inbox I was too exhausted to check properly."
  2. "I didn't need a prettier spreadsheet. I needed something that watches my inbox and tells me what's actually happening — without me maintaining it."
  3. "That's foray."
- Separator: `border-top: 1px solid var(--border)` between sections

- [ ] **Step 7: Add "The Problem" comparison section**

Add `<section id="problem">`:
- Label: "THE PROBLEM"
- Heading: "Your spreadsheet doesn't read your email."
- Side-by-side grid (`display: grid; grid-template-columns: 1fr 1fr; gap: 16px`):
  - Left card ("Without foray"): border, padding, gray background
    - "Monday: Apply to Stripe"
    - "Wednesday: Stripe ATS sends rejection"
    - "Your spreadsheet still says 'Applied'" (strikethrough)
    - "Also missed a recruiter email from Vercel" (strikethrough)
  - Right card ("With foray"): border, slight green tint background
    - "Monday: Capture Stripe application"
    - "Wednesday: foray detects rejection email → status auto-updates"
    - "Review queue shows Vercel recruiter email" (accent color)
    - "Dashboard shows 2 stale forays that need follow-up"

- [ ] **Step 8: Verify sections render with correct spacing**

Check: sections separated by borders, side-by-side cards align on desktop, text is readable.

---

### Task 4: Build Pipeline + Features sections

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 9: Add "How It Works" pipeline section**

Add `<section id="pipeline">`:
- Label: "HOW IT WORKS"
- Heading: "Four-stage email pipeline. Rules-first, LLM as fallback."
- Horizontal pipeline diagram (flexbox):
  - 4 boxes: `ingest`, `match`, `classify`, `act`
  - Each box: border, mono font, centered text
  - Arrows between boxes: `→` in `var(--muted)`
  - Below each box: small description text
    - ingest: "Fetch from Gmail every 15 min"
    - match: "Link email to application"
    - classify: "Regex rules first, LLM fallback"
    - act: "Auto-update or review queue"
- Key insight paragraph: "Most rejection/interview emails follow predictable templates. Regex catches 80%+ of them with zero API cost. Only ambiguous emails go to Claude Haiku — keeping LLM spend under $0.50/day."

- [ ] **Step 10: Add "Features" section**

Add `<section id="features">`:
- Label: "FEATURES"
- Heading: "What you get"
- 5 feature blocks (stacked vertically, each with title + description):
  1. **Capture in seconds, not minutes** — "Manual form with company autocomplete, role title, URL, JD paste, salary range. One transaction creates the application + first event."
  2. **Your inbox, triaged** — "Gmail polling every 15 minutes. Each email classified as rejection, interview invite, recruiter outreach, noise, or unmatched. Rules-first with Claude Haiku fallback."
  3. **Status updates itself** — "When the classifier is confident, application status updates automatically. Every auto-change is undoable. Status regressions always require human confirmation."
  4. **Review queue for the uncertain** — "Low-confidence and unmatched emails surface in a focused queue. Typically 0–3 items per day. The first 50 emails always go to review."
  5. **Campaign room view** — "Application list filterable by canonical status. Detail view with chronological timeline. Not a spreadsheet. A room you walk into."

- [ ] **Step 11: Verify pipeline diagram and features render**

Check: pipeline boxes are horizontal on desktop, stack on mobile. Feature blocks have clear hierarchy.

---

### Task 5: Build Architecture + Roadmap + Get Started + Footer

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 12: Add "For Developers" architecture section**

Add `<section id="architecture">`:
- Label: "FOR DEVELOPERS"
- Heading: "Read the source, not just the README"
- Tech stack grid (2x2):
  - Runtime: Next.js 16 + TypeScript 5
  - Database: PostgreSQL 16 + Prisma 7
  - LLM: Claude Haiku (fallback only)
  - Architecture: Vertical Slice (VSA)
- Each card: border, padding, mono label (category), regular text (value)
- Key decisions paragraph: "Vertical Slice Architecture (feature-first). tenantDb(userId) wrapper for multi-tenant safety. Branded types for IDs. Result<T, AppError> (neverthrow) instead of throwing. Rules-first classifier keeps LLM costs near zero. Local-first by design — Docker Postgres, no cloud dependency."

- [ ] **Step 13: Add Roadmap section**

Add `<section id="roadmap">`:
- Label: "ROADMAP"
- Heading: "Three milestones"
- 3 cards in a row (flex, equal width):
  - **Lean** (v0.1): "Manual capture + Gmail polling + classifier + review queue + application views"
  - **Standard**: "+ Bookmarklet + Today dashboard + tags + cross-record search"
  - **Full**: "+ Chrome extension + document storage + calendar sync + analytics"
- Each card: border, padding, title bold, description muted

- [ ] **Step 14: Add Get Started section**

Add `<section id="get-started">`:
- Label: "GET STARTED"
- Heading: "Run it locally in 3 commands"
- Prerequisites: "Requires Node.js 20+ and Docker. Runs on your laptop — no cloud setup needed."
- Code block (dark background `#1c1917`, light text `#fafaf9`, mono font, rounded corners):
  ```
  $ pnpm install
  $ docker compose up -d db
  $ pnpm dev
  # → http://localhost:3000
  ```
- Dollar signs in `#737373` (muted), commands in white, comment in muted

- [ ] **Step 15: Add footer**

Add `<footer>`:
- `border-top: 1px solid var(--border)`
- Flex: left "Built by Duy Pham with Claude Code", right "Personal use. Not licensed for redistribution."
- Font size: `0.75rem`, color: `var(--muted)`

- [ ] **Step 16: Verify all sections render correctly**

Scroll through entire page. Check: all 10 sections present, consistent spacing, no broken layouts.

---

### Task 6: Add responsive styles + polish

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 17: Add responsive breakpoint for mobile**

Add `@media (max-width: 640px)`:
- Hero tagline: reduce to `1.25rem`
- Problem comparison: stack vertically (`grid-template-columns: 1fr`)
- Pipeline: stack vertically or wrap
- Tech stack grid: `grid-template-columns: 1fr`
- Roadmap cards: stack vertically
- Nav: hide section links, show only logo + GitHub button
- Container padding: `0 16px`

- [ ] **Step 18: Add smooth scroll + anchor offset for sticky nav**

JS (inline `<script>` at end of body):
```javascript
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
```

CSS: add `scroll-padding-top: 60px` to `html` so anchored sections don't hide behind sticky nav.

- [ ] **Step 19: Final visual polish pass**

- Verify dark mode (toggle system preference or use devtools)
- Check contrast ratios (text readable on background)
- Verify no horizontal scroll on mobile
- Check all links point to correct anchors
- Verify "View on GitHub" links to `https://github.com/duypham9895/foray`

- [ ] **Step 20: Commit**

```bash
git add landing/index.html
git commit -m "feat: add static landing page for GitHub Pages"
```

---

### Task 7: Verify GitHub Pages readiness

**Files:**
- None (configuration is in GitHub repo settings)

- [ ] **Step 21: Verify file structure**

```bash
ls -la landing/
```
Expected: `index.html` exists, is valid HTML.

- [ ] **Step 22: Validate HTML**

Open in browser, check no rendering issues. Optionally run through W3C validator.

- [ ] **Step 23: Document GitHub Pages setup**

Add a note to README.md or a comment in the HTML about GitHub Pages configuration:
- Repo Settings → Pages → Source: "Deploy from a branch"
- Branch: `main`, Folder: `/landing`
- URL: `https://duypham9895.github.io/foray`

- [ ] **Step 24: Final commit**

```bash
git add landing/
git commit -m "chore: prepare landing page for GitHub Pages deployment"
```
