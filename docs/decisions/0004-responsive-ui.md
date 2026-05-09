# ADR-0004: Responsive UI, no separate mobile app

**Status**: Accepted
**Date**: 2026-05-09

## Context

Even local-only (per [ADR-0003](./0003-local-first.md)), the owner asked for the UI to work well on mobile screen sizes — anticipating tunneling to phone, future deployment, or just narrow-window laptop use.

## Decision

The Next.js app is responsive by default using Tailwind v4 breakpoints. No separate mobile app, no PWA installation flow, no React Native client.

## Consequences

### Positive

- **One codebase, all screens.** Tailwind responsive utilities + sensible component design (cards over tables for primary data — see [DESIGN.md](../../DESIGN.md)) cover mobile naturally.
- **No design overhead.** Mobile is a constraint applied during component design, not a separate design surface.
- **Future-proof.** Whether the user accesses via Tailscale, Vercel, or a tablet, the UI works.

### Negative

- **No offline support.** PWA would have given offline; we explicitly skip it. Acceptable: the user is typically connected.
- **Native gestures (swipe-to-delete, pull-to-refresh) not built-in.** We don't need them.

## Implementation notes

- Default mobile-first: write base styles for narrow widths, add `md:` / `lg:` modifiers for larger screens
- Test responsive layouts at 375px (iPhone SE), 768px (iPad), 1280px (laptop), 1920px (external monitor)
- Touch targets ≥44×44px on mobile per Apple HIG (Tailwind `min-h-11 min-w-11` on tappables)

## Alternatives rejected

- **PWA with offline support.** Adds service worker complexity for marginal gain; user is typically connected.
- **Separate native app.** Massive scope creep for one-user personal tool.
