/**
 * Phase 2 cross-tenant isolation suite.
 *
 * Closes the 4 it.todo placeholders in
 * tests/integration/tenant-db-cross-tenant-leak.test.ts (Phase 1 plan 03)
 * by using the Phase 2 services as the seed mechanism: createApplication,
 * addStage, and updateApplicationNotes. Phase 1 left these as todo because
 * Phase 2's services were the natural seed layer.
 *
 * Coverage matrix (entity × isolation behavior):
 *   - Company   : alice creates a Company → invisible to bob via withRls(BOB)
 *   - Application : alice creates an Application → invisible to bob
 *   - Event     : alice's "created" Event from createApplication invisible to bob
 *   - Stage     : alice's addStage row invisible to bob (parent-join policy)
 *   - Note Event: alice's updateApplicationNotes Event invisible to bob
 *   - Cross-tenant write rejection: alice's service call against bob's id
 *     returns NotFound (not silent success), no row appears in bob's view
 *
 * Cleanup is handled by the per-run Testcontainers lifecycle: globalSetup
 * creates a fresh Postgres container; globalTeardown disposes it.
 * Inter-test isolation comes from the deterministic seed (alice + bob via
 * withRls) plus assertions resilient to other tests in the same suite
 * having added rows. No afterEach DB cleanup needed (and DELETEing here
 * would require a second pg connection as foray_owner since RLS denies
 * bulk deletes for foray_app — not worth it for this file's purpose).
 *
 * Does NOT modify tests/integration/tenant-db-cross-tenant-leak.test.ts —
 * those it.todos remain as a documented Phase 1 marker. This file
 * completes equivalent coverage.
 */
import { describe, expect, it } from 'vitest'

import { withRls } from '@/core/db/with-rls'
import { ApplicationId, UserId } from '@/core/types/ids'
import { createApplication } from '@/features/applications/service'
import { addStage } from '@/features/applications/stages-service'
import { updateApplicationNotes } from '@/features/applications/notes-service'

const ALICE = UserId(1)
const BOB = UserId(2)

describe('Phase 2 cross-tenant isolation (closes Phase 1 plan 03 it.todos)', () => {
  it('Company isolation: alice creating a Company is invisible to bob', async () => {
    const created = await createApplication(ALICE, {
      companyName: 'Alice-Only Co',
      roleTitle: 'SWE',
      source: 'direct',
      appliedAt: new Date(),
    })
    expect(created.isOk()).toBe(true)

    const bobsView = await withRls(BOB, async (tx) =>
      tx.company.findMany({ where: { name: 'Alice-Only Co' } }),
    )
    expect(bobsView.isOk()).toBe(true)
    if (bobsView.isOk()) expect(bobsView.value).toEqual([])
  })

  it("Application isolation: bob cannot see alice's newly created Application via withRls", async () => {
    const created = await createApplication(ALICE, {
      companyName: 'Alice-Hidden Co',
      roleTitle: 'PM-isolation',
      source: 'referral',
      appliedAt: new Date(),
    })
    expect(created.isOk()).toBe(true)

    const bobsView = await withRls(BOB, async (tx) =>
      tx.application.findMany({ where: { roleTitle: 'PM-isolation' } }),
    )
    expect(bobsView.isOk()).toBe(true)
    if (bobsView.isOk()) {
      // RLS denies all of alice's rows; bob has no application with this title.
      expect(bobsView.value).toEqual([])
    }
  })

  it("Event isolation: alice's 'created' Event from createApplication is invisible to bob", async () => {
    const created = await createApplication(ALICE, {
      companyName: 'Event-Iso Co',
      roleTitle: 'EM-event-iso',
      source: 'other',
      appliedAt: new Date(),
    })
    expect(created.isOk()).toBe(true)
    if (!created.isOk()) return

    const aliceEventId = Number(created.value.eventId)

    // Direct lookup by id: even with the exact id, RLS hides alice's event from bob.
    const bobsView = await withRls(BOB, async (tx) =>
      tx.event.findUnique({ where: { id: aliceEventId } }),
    )
    expect(bobsView.isOk()).toBe(true)
    if (bobsView.isOk()) expect(bobsView.value).toBeNull()

    // Belt: any 'created' events bob CAN see must belong to bob.
    const bobsCreatedEvents = await withRls(BOB, async (tx) =>
      tx.event.findMany({ where: { type: 'created' } }),
    )
    expect(bobsCreatedEvents.isOk()).toBe(true)
    if (bobsCreatedEvents.isOk()) {
      expect(bobsCreatedEvents.value.every((e) => e.userId === Number(BOB))).toBe(true)
    }
  })

  it("Stage isolation: alice's addStage row invisible to bob via parent-join policy", async () => {
    const created = await createApplication(ALICE, {
      companyName: 'Stage-Iso Co',
      roleTitle: 'SRE-stage-iso',
      source: 'direct',
      appliedAt: new Date(),
    })
    expect(created.isOk()).toBe(true)
    if (!created.isOk()) return
    const aliceAppId = ApplicationId(created.value.applicationId)

    const stageResult = await addStage(ALICE, aliceAppId, {
      name: 'Recruiter call alice-only',
    })
    expect(stageResult.isOk()).toBe(true)

    const bobsView = await withRls(BOB, async (tx) =>
      tx.stage.findMany({ where: { name: 'Recruiter call alice-only' } }),
    )
    expect(bobsView.isOk()).toBe(true)
    if (bobsView.isOk()) expect(bobsView.value).toEqual([])
  })

  it("Notes update isolation: alice's note_added Event invisible to bob", async () => {
    const created = await createApplication(ALICE, {
      companyName: 'Notes-Iso Co',
      roleTitle: 'CFO-notes-iso',
      source: 'other',
      appliedAt: new Date(),
    })
    expect(created.isOk()).toBe(true)
    if (!created.isOk()) return
    const appId = ApplicationId(created.value.applicationId)

    const notesResult = await updateApplicationNotes(ALICE, appId, {
      notes: 'sensitive note from alice',
    })
    expect(notesResult.isOk()).toBe(true)

    // Any note_added events bob can see must belong to bob (alice's are filtered by RLS).
    const bobsView = await withRls(BOB, async (tx) =>
      tx.event.findMany({ where: { type: 'note_added' } }),
    )
    expect(bobsView.isOk()).toBe(true)
    if (bobsView.isOk()) {
      expect(bobsView.value.every((e) => e.userId === Number(BOB))).toBe(true)
    }
  })

  it("Cross-tenant write rejection: alice's service call with bob's applicationId returns NotFound", async () => {
    // Bob's seeded application id is 2 (from setup.ts).
    const bobAppId = ApplicationId(2)

    const stageResult = await addStage(ALICE, bobAppId, {
      name: 'Sneaky stage cross-tenant',
    })
    expect(stageResult.isErr()).toBe(true)
    if (stageResult.isErr()) {
      expect(stageResult.error._tag).toBe('NotFound')
    }

    // Verify no row leaked into bob's view either — the write must have been
    // refused, not silently moved or partially applied.
    const bobsView = await withRls(BOB, async (tx) =>
      tx.stage.findMany({ where: { name: 'Sneaky stage cross-tenant' } }),
    )
    expect(bobsView.isOk()).toBe(true)
    if (bobsView.isOk()) expect(bobsView.value).toEqual([])
  })
})
