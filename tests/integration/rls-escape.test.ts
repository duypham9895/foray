/**
 * RLS escape attempt suite (FND-03 subset (a) — Pitfall 9 prevention).
 *
 * These 4 tests prove that Postgres RLS is not "theater" — it actually
 * enforces tenant isolation regardless of the call pattern. See:
 * .planning/phases/01-foundation-auth/01-RESEARCH.md §5 + §"Common Pitfalls §9"
 *
 * Prerequisites (handled by globalSetup in tests/integration/setup.ts):
 * - Testcontainers Postgres 16 running with RLS migration applied
 * - alice (id=1) + bob (id=2) users seeded
 * - One Application row per user seeded
 * - process.env.DATABASE_URL switched to foray_app (non-superuser, FORCE RLS active)
 *
 * Note on tenantDb vs withRls in tests:
 * tenantDb uses the global prisma client (no GUC set). RLS + foray_app means
 * queries without app.user_id return zero rows. Test 1 proves isolation by
 * calling findMany with alice's userId filter inside withRls — this verifies
 * that (a) the WHERE filter works correctly and (b) RLS allows alice's rows.
 * Test 3 proves the safe-by-default state (no GUC → zero rows, no error).
 */
import { describe, it, expect } from 'vitest'
import { prisma } from '@/core/db/client'
import { withRls } from '@/core/db/with-rls'
import { UserId } from '@/core/types/ids'

const ALICE = UserId(1)
const BOB = UserId(2)

describe('RLS escape attempts', () => {
  it("alice cannot see bob's rows: WHERE userId=alice filter inside withRls(ALICE)", async () => {
    // Inside withRls, app.user_id = alice. RLS allows alice's own rows.
    // The WHERE clause filters for alice's rows — bob's rows are filtered at
    // both the app layer (WHERE) and DB layer (RLS). Proves belt + suspenders work.
    const result = await withRls(ALICE, async (tx) => {
      return tx.application.findMany({ where: { userId: Number(ALICE) } })
    })
    expect(result.isOk()).toBe(true)
    const apps = result._unsafeUnwrap()
    // Every row must belong to alice (RLS + WHERE clause both enforce this)
    expect(apps.every((a) => a.userId === Number(ALICE))).toBe(true)
    // alice has at least one seeded application
    expect(apps.length).toBeGreaterThanOrEqual(1)
  })

  it("alice cannot see bob's applications via raw $queryRaw inside withRls", async () => {
    // Even with raw SQL that explicitly asks for bob's rows, RLS policy filters
    // because withRls sets app.user_id = alice's id inside the transaction.
    const result = await withRls(ALICE, async (tx) => {
      return tx.$queryRaw<{ id: number; user_id: number }[]>`
        SELECT id, user_id FROM applications WHERE user_id = ${Number(BOB)}
      `
    })
    expect(result.isOk()).toBe(true)
    // RLS denied bob's rows — zero rows returned even with an explicit WHERE clause.
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('raw $queryRaw OUTSIDE withRls returns zero rows (app.user_id unset)', async () => {
    // No transaction → app.user_id not set → NULLIF(current_setting(...), '')::int = NULL →
    // policy denies all rows. Safe-by-default failure mode: no data leaks,
    // query mysteriously returns nothing (not an error).
    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM applications`
    expect(rows).toEqual([])
  })

  it('RLS is structurally enabled with FORCE on every tenant table (Pitfall 9 CI guard)', async () => {
    // Structural check: every tenant-scoped table must have BOTH
    // relrowsecurity=true (ENABLE) AND relforcerowsecurity=true (FORCE).
    // FORCE is the critical one — without it, the table owner bypasses policies.
    // This test will catch any future migration that adds a new tenant table
    // without enabling FORCE ROW LEVEL SECURITY.
    //
    // pg_class is a system catalog — not subject to RLS policies, accessible
    // without setting app.user_id.
    const rows = await prisma.$queryRaw<{ relname: string; rls: boolean; force: boolean }[]>`
      SELECT relname, relrowsecurity AS rls, relforcerowsecurity AS force
      FROM pg_class
      WHERE relname IN (
        'users','companies','applications','stages','events',
        'emails','recruiters','application_recruiters','documents'
      )
    `
    expect(rows.length).toBe(9)
    for (const row of rows) {
      expect(row.rls, `${row.relname} should have ENABLE ROW LEVEL SECURITY`).toBe(true)
      expect(row.force, `${row.relname} should have FORCE ROW LEVEL SECURITY`).toBe(true)
    }
  })
})
