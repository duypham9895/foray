# UI — Shared Design System

Design-system primitives imported by multiple features. Keep small.

If a component is used by only one slice, it lives in `src/features/<slice>/components/` instead — see the slice anatomy in [src/features/README.md](../features/README.md).

Most primitives will land via `pnpm dlx shadcn@latest add <name>` once the design pass starts.

See [DESIGN.md](../../DESIGN.md) for visual principles ("campaign room, not robotic dashboard"), color palette, and tone of voice.
