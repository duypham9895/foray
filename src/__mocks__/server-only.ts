// Vitest mock for 'server-only'. The real package throws when imported outside
// a Next.js server context. Tests run in Node (no RSC runtime), so we replace
// it with a no-op. This is safe because tests never call browser-side code.
export {}
