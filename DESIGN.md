# Design — `foray`

Aesthetic and UI principles. Read this before making any visual decision. AI agents: in QA mode, flag any code that violates these.

---

## The vibe

`foray` is a **campaign room**, not a robotic dashboard. The mental model is a planning room with maps on the walls and a notebook open on a desk — calm, decisive, slightly archival. Not an enterprise CRM. Not a productivity SaaS with eight gradient buttons.

The user is checking it under stress (job hunting, between meetings, before bed). The interface should feel **patient and on their side**, not noisy or aggressive about engagement.

---

## Less icons, more humanity

Same principle as eVoyage. This app should feel warm and considered, not like a robotic dashboard.

**Rules:**

- **No decorative icons.** If removing an icon doesn't hurt comprehension, remove it.
- **Text over icons.** Prefer clear, well-written text labels over icon+label combos. Words are more human than pictograms.
- **Functional icons only.** Icons are allowed when they serve a clear interaction purpose: navigation, close buttons, status indicators, calendar marks. If the user needs the icon to understand what to do, keep it. Otherwise drop it.
- **No icon grids.** Avoid the pattern of "icon in a circle + title + description" repeated 6 times. Use typography, spacing, and color hierarchy instead.
- **No emoji in UI chrome.** No emoji in tab labels, navigation, status badges, or interactive elements. Emoji are only acceptable in user-authored content (notes, captured JD text) where they came from the user.

**Why**: icons at scale create visual noise. The app's personality should come from words, layout, and the care put into micro-interactions — not a grid of SVG shapes.

**How to apply**: before adding any icon, ask "Would this section work with just text and good typography?" If yes, skip it.

---

## Color palette

Restrained, not branded. The dashboard's job is to make your data legible — not to express the app's personality.

| Role | Light mode | Dark mode |
|---|---|---|
| Background | `#fafaf9` (warm off-white) | `#0c0a09` (warm near-black) |
| Surface (cards) | `#ffffff` | `#1c1917` |
| Border | `#e7e5e4` | `#292524` |
| Text primary | `#1c1917` | `#fafaf9` |
| Text secondary | `#57534e` | `#a8a29e` |
| Text muted | `#a8a29e` | `#57534e` |

**Status colors** (used sparingly, only on canonical_status badges):

| canonical_status | Color | Why |
|---|---|---|
| `applied` | `#737373` (neutral gray) | Default state — not exciting yet |
| `screening` | `#0891b2` (cyan-600) | In progress, gentle attention |
| `interviewing` | `#ca8a04` (amber-600) | Active, earned attention |
| `offer` | `#16a34a` (green-600) | The good outcome |
| `rejected` | `#a8a29e` (warm gray) | Closed but not loud — rejections are normal, not catastrophic |
| `withdrawn` | `#a8a29e` (warm gray) | Same as rejected — closed-out states are quiet |

**Important**: rejection is rendered in muted gray, **not red**. Job hunting involves dozens of rejections; making them red turns the dashboard into a wall of alarm. Treat them as quiet closure, not failure.

---

## Typography

- **Sans (UI)**: Geist Sans (already loaded by `create-next-app`). Workhorse.
- **Mono (data, IDs, code, classifier output)**: Geist Mono. Used for technical content only.
- **No serif.** Don't reach for editorial fonts. The vibe is "campaign room", not "literary magazine".

Sizes (Tailwind shorthand):
- `text-3xl` — page H1 (one per page)
- `text-xl` — section H2
- `text-base` — body
- `text-sm` — secondary metadata
- `text-xs` — timestamps, IDs, footnotes only

Avoid `text-2xl` and `text-lg` — they create unnecessary intermediate sizes. Three is enough.

---

## Spacing

Use Tailwind's default scale. **Default to generous whitespace**; the dashboard isn't an inbox cramming for density.

- Card padding: `p-6` (or `p-4` for compact list rows)
- Section gap: `gap-8` between major sections; `gap-4` within a section
- Form fields: `space-y-4` between fields; `space-y-1` between label and input

If a layout feels cramped, the answer is almost always more whitespace, not smaller font.

---

## Component patterns

### Cards over tables for primary data

For the Today view and application list, **prefer card layouts** with clear hierarchy over dense table rows. Tables are for the dedicated all-applications page (sortable, filterable, scannable).

A card answers: "what is this thing?" "where in its lifecycle?" "what's the next action?"

### Empty states are part of the design

Every list/section needs a real empty state. Not "No results." Write something that:

1. Explains why it's empty (`No applications yet`)
2. Tells the user what to do (`Drag the bookmarklet to your bookmarks bar to capture jobs in one click — see Settings.`)
3. Has the same visual weight as the populated state (don't shrink to a tiny gray paragraph)

### Loading states are not spinners

Use skeleton placeholders that match the shape of the eventual content. A spinner says "wait." A skeleton says "this is what's coming."

### Destructive actions require confirmation

Deleting an application, disconnecting Gmail, clearing the review queue — all require a confirmation dialog. Use `<ConfirmDialog>` (will be in `src/components/ui/`).

### Forms use inline validation

Show validation errors next to the field, not in a banner at the top. Use Zod schema for both client and server-side validation (single source of truth — see `src/lib/schemas/`).

---

## Tone of voice

The product talks like a calm friend with a notebook, not a startup wanting to "supercharge your workflow."

- ✅ "Captured Stripe / Senior Product Manager."
- ❌ "🎉 Awesome! Your application has been successfully captured!"

- ✅ "Logged. We'll watch for replies."
- ❌ "✨ Application synced! AI is now monitoring your inbox 24/7."

- ✅ "Rejected from Acme. 12 days from apply to close."
- ❌ "We're sorry it didn't work out. Don't give up!"

The product is informational, not motivational. The user supplies the motivation. The product supplies the receipts.

**Specifically**: never write "AI", "smart", "intelligent", "automatic" in user-facing copy. The user knows there's an LLM in there. They don't need to be reminded.

---

## What "feels right" looks like

The app should feel:

- **Quiet** — no notifications, no badges, no exclamation marks in copy
- **Decisive** — every screen has a clear primary action
- **Honest** — never hide bad news (rejections shown clearly), never claim certainty the classifier doesn't have (low-confidence labels say "probably" or sit in the review queue)
- **Stable** — colors don't change as state changes; only the content does

If a design choice would feel out of place in a stationer's shop or a small bookshop café, it's wrong for foray.

---

## Anti-patterns (specific things to never do)

- Hero sections on internal pages
- Any use of `bg-gradient-to-br` or rainbow gradients
- Status changes that require celebrations (no confetti on offer, no skull on rejection)
- Modal dialogs with "Are you sure you want to leave?" prompts
- Toasts that appear at the top with `position: fixed` and slide in from the right (use inline status messages instead)
- The word "delight"
- The phrase "you've got this"
- Light mode that's pure white (#ffffff background) — too clinical; use warm off-white
- Dark mode that's pure black (#000000) — too OLED-y; use warm near-black
