import 'server-only'

import type { Result } from 'neverthrow'

import { withRls } from '@/core/db/with-rls'
import type { AppError } from '@/core/errors'
import type { RecruiterId, UserId } from '@/core/types/ids'

export type RecruiterListItem = {
  id: number
  name: string
  email: string | null
  linkedinUrl: string | null
  phone: string | null
  notes: string | null
  companyId: number | null
  companyName: string | null
  applicationCount: number
  createdAt: Date
}

export type RecruiterDetail = RecruiterListItem & {
  applications: Array<{
    applicationId: number
    role: string | null
    roleTitle: string
    companyName: string
  }>
}

export async function findRecruitersForList(
  userId: UserId,
): Promise<Result<RecruiterListItem[], AppError>> {
  return withRls(userId, async (tx) => {
    const rows = await tx.recruiter.findMany({
      where: { userId: Number(userId) },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { applications: true } },
      },
    })

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      linkedinUrl: row.linkedinUrl,
      phone: row.phone,
      notes: row.notes,
      companyId: row.companyId,
      companyName: row.company?.name ?? null,
      applicationCount: row._count.applications,
      createdAt: row.createdAt,
    }))
  })
}

export async function findRecruiterDetail(
  userId: UserId,
  recruiterId: RecruiterId,
): Promise<Result<RecruiterDetail | null, AppError>> {
  return withRls(userId, async (tx) => {
    const row = await tx.recruiter.findUnique({
      where: { id: Number(recruiterId) },
      include: {
        company: { select: { id: true, name: true } },
        applications: {
          include: {
            application: {
              select: {
                id: true,
                roleTitle: true,
                company: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!row || row.userId !== Number(userId)) return null

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      linkedinUrl: row.linkedinUrl,
      phone: row.phone,
      notes: row.notes,
      companyId: row.companyId,
      companyName: row.company?.name ?? null,
      applicationCount: row.applications.length,
      createdAt: row.createdAt,
      applications: row.applications.map((link) => ({
        applicationId: link.applicationId,
        role: link.role,
        roleTitle: link.application.roleTitle,
        companyName: link.application.company.name,
      })),
    }
  })
}
