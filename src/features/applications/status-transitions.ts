// Status-regression detection. Used by applyAutoStatusChange to refuse
// backward transitions an automated classifier should never make on its own
// (e.g., un-rejecting a foray from a single ambiguous email).
//
// Manual user changes via the dropdown bypass this guard — the user has
// context the classifier doesn't.
//
// Phase 4 (inbox/act stage) will import this module to apply the same guard
// when the classifier proposes a status change.

import type { CanonicalStatus } from '@/generated/prisma/client'

/**
 * Forward rank of each canonical status.
 *
 * applied (1) < screening (2) < interviewing (3) < offer (4)
 *
 * `rejected` and `withdrawn` are TERMINAL — equal rank (5). Transitions
 * between them and from any non-terminal to either are NOT regressions.
 * Transitions from a terminal back to a non-terminal ARE regressions.
 */
export const STATUS_RANK: Record<CanonicalStatus, number> = {
  applied: 1,
  screening: 2,
  interviewing: 3,
  offer: 4,
  rejected: 5,
  withdrawn: 5,
}

const TERMINAL_STATUSES = new Set<CanonicalStatus>(['rejected', 'withdrawn'])

/**
 * Returns true iff `next` is strictly behind `prev` in the canonical
 * lifecycle, OR transitions from a terminal status back to a non-terminal.
 *
 * Returns false for forward moves, no-op moves (same status), and
 * terminal↔terminal moves (no semantic movement).
 */
export function isStatusRegression(prev: CanonicalStatus, next: CanonicalStatus): boolean {
  if (prev === next) return false
  const prevTerminal = TERMINAL_STATUSES.has(prev)
  const nextTerminal = TERMINAL_STATUSES.has(next)
  // Terminal → non-terminal = regression (un-rejecting is a human-only action)
  if (prevTerminal && !nextTerminal) return true
  // Non-terminal → terminal = forward (closing out is normal)
  if (!prevTerminal && nextTerminal) return false
  // Terminal → terminal (rejected ↔ withdrawn) = no movement
  if (prevTerminal && nextTerminal) return false
  // Both non-terminal: compare rank
  return STATUS_RANK[next] < STATUS_RANK[prev]
}
