import { beforeEach, describe, expect, it } from 'vitest'

import { withRls } from '@/core/db/with-rls'
import { ApplicationId, RecruiterId, UserId } from '@/core/types/ids'
import {
  createRecruiter,
  linkRecruiterToApplication,
  unlinkRecruiterFromApplication,
  updateRecruiter,
} from '@/features/recruiters/service'

const ALICE = UserId(1)
const BOB = UserId(2)

beforeEach(async () => {
  await withRls(ALICE, async (tx) => {
    await tx.applicationRecruiter.deleteMany({
      where: { application: { userId: Number(ALICE) } },
    })
    await tx.event.deleteMany({
      where: { userId: Number(ALICE), type: 'recruiter_linked' },
    })
    await tx.recruiter.deleteMany({ where: { userId: Number(ALICE) } })
  })
  await withRls(BOB, async (tx) => {
    await tx.applicationRecruiter.deleteMany({
      where: { application: { userId: Number(BOB) } },
    })
    await tx.event.deleteMany({
      where: { userId: Number(BOB), type: 'recruiter_linked' },
    })
    await tx.recruiter.deleteMany({ where: { userId: Number(BOB) } })
  })
})

async function firstApplicationId(userId: ReturnType<typeof UserId>) {
  const result = await withRls(userId, async (tx) => {
    const app = await tx.application.findFirst({
      where: { userId: Number(userId) },
      orderBy: { id: 'asc' },
      select: { id: true },
    })
    if (!app) throw new Error('missing seeded application')
    return ApplicationId(app.id)
  })
  if (result.isErr()) throw new Error('failed to load seeded application')
  return result.value
}

describe('recruiter service', () => {
  it('creates a recruiter and reuses the same record for matching email', async () => {
    const first = await createRecruiter(ALICE, {
      name: 'Pat Recruiter',
      email: 'Pat@Example.com',
      linkedinUrl: '',
      phone: '',
      notes: '',
    })
    expect(first.isOk()).toBe(true)
    if (first.isErr()) throw new Error('expected first create to pass')

    const second = await createRecruiter(ALICE, {
      name: 'Pat Duplicate',
      email: 'pat@example.com',
      linkedinUrl: '',
      phone: '',
      notes: '',
    })
    expect(second.isOk()).toBe(true)
    if (second.isErr()) throw new Error('expected second create to pass')

    expect(second.value.recruiter.id).toBe(first.value.recruiter.id)
    expect(second.value.recruiter.email).toBe('pat@example.com')
  })

  it('updates a recruiter contact', async () => {
    const created = await createRecruiter(ALICE, {
      name: 'Sam Recruiter',
      email: 'sam@example.com',
    })
    expect(created.isOk()).toBe(true)
    if (created.isErr()) throw new Error('expected create to pass')

    const updated = await updateRecruiter(
      ALICE,
      RecruiterId(created.value.recruiter.id),
      {
        name: 'Sam Hiring',
        email: 'sam@example.com',
        phone: '+1 555 0100',
      },
    )

    expect(updated.isOk()).toBe(true)
    if (updated.isErr()) throw new Error('expected update to pass')
    expect(updated.value.recruiter.name).toBe('Sam Hiring')
    expect(updated.value.recruiter.phone).toBe('+1 555 0100')
  })

  it('links a recruiter to an application and writes a timeline event', async () => {
    const applicationId = await firstApplicationId(ALICE)
    const linked = await linkRecruiterToApplication(ALICE, applicationId, {
      name: 'Robin Recruiter',
      email: 'robin@example.com',
      role: 'Recruiter',
    })

    expect(linked.isOk()).toBe(true)
    if (linked.isErr()) throw new Error('expected link to pass')

    const verify = await withRls(ALICE, async (tx) => {
      const link = await tx.applicationRecruiter.findUnique({
        where: {
          applicationId_recruiterId: {
            applicationId: Number(applicationId),
            recruiterId: linked.value.recruiterId,
          },
        },
      })
      const event = await tx.event.findFirst({
        where: {
          applicationId: Number(applicationId),
          type: 'recruiter_linked',
        },
      })
      return { link, event }
    })

    expect(verify.isOk()).toBe(true)
    if (verify.isErr()) throw new Error('expected verification to pass')
    expect(verify.value.link?.role).toBe('Recruiter')
    expect(verify.value.event).not.toBeNull()
  })

  it('rejects linking another tenant recruiter', async () => {
    const aliceRecruiter = await createRecruiter(ALICE, {
      name: 'Alice Recruiter',
      email: 'alice-recruiter@example.com',
    })
    expect(aliceRecruiter.isOk()).toBe(true)
    if (aliceRecruiter.isErr()) throw new Error('expected create to pass')

    const bobApplicationId = await firstApplicationId(BOB)
    const result = await linkRecruiterToApplication(BOB, bobApplicationId, {
      recruiterId: aliceRecruiter.value.recruiter.id,
      role: 'Recruiter',
    })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('NotFound')
    }
  })

  it('unlinks a recruiter from an application', async () => {
    const applicationId = await firstApplicationId(ALICE)
    const linked = await linkRecruiterToApplication(ALICE, applicationId, {
      name: 'Morgan Recruiter',
      email: 'morgan@example.com',
    })
    expect(linked.isOk()).toBe(true)
    if (linked.isErr()) throw new Error('expected link to pass')

    const unlinked = await unlinkRecruiterFromApplication(
      ALICE,
      applicationId,
      RecruiterId(linked.value.recruiterId),
    )

    expect(unlinked.isOk()).toBe(true)

    const verify = await withRls(ALICE, async (tx) =>
      tx.applicationRecruiter.findUnique({
        where: {
          applicationId_recruiterId: {
            applicationId: Number(applicationId),
            recruiterId: linked.value.recruiterId,
          },
        },
      }),
    )
    expect(verify.isOk()).toBe(true)
    if (verify.isErr()) throw new Error('expected verification to pass')
    expect(verify.value).toBeNull()
  })
})
