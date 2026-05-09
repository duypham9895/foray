import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import type { UserId } from '@/core/types/ids'

import { prisma } from './client'

// Tenant-scoped Prisma wrapper. Auto-injects userId filter into every
// query for tenant-owned models. See PRINCIPLES.md §"Database — multi-tenancy".
//
// Direct `prisma.application.*` (and other tenant models) is banned outside
// this file — enforced by .dependency-cruiser rule "no-direct-prisma" in CI.
//
// Add methods as new entities require querying. Pattern: same as application.

export function tenantDb(userId: UserId) {
  const numericUserId = Number(userId)

  return {
    application: {
      findMany: (args: Prisma.ApplicationFindManyArgs = {}) =>
        prisma.application.findMany({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      findUnique: async (args: Prisma.ApplicationFindUniqueArgs) => {
        const row = await prisma.application.findUnique(args)
        return row?.userId === numericUserId ? row : null
      },

      findFirst: (args: Prisma.ApplicationFindFirstArgs = {}) =>
        prisma.application.findFirst({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      count: (args: Prisma.ApplicationCountArgs = {}) =>
        prisma.application.count({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      aggregate: (args: Prisma.ApplicationAggregateArgs) =>
        prisma.application.aggregate({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      create: (
        args: Omit<Prisma.ApplicationCreateArgs, 'data'> & {
          data: Omit<Prisma.ApplicationCreateInput, 'user'>
        },
      ) =>
        prisma.application.create({
          ...args,
          data: { ...args.data, user: { connect: { id: numericUserId } } },
        }),

      update: (args: Prisma.ApplicationUpdateArgs) =>
        prisma.application.update({
          ...args,
          where: { ...args.where, userId: numericUserId } as Prisma.ApplicationWhereUniqueInput,
        }),

      delete: (args: Prisma.ApplicationDeleteArgs) =>
        prisma.application.delete({
          ...args,
          where: { ...args.where, userId: numericUserId } as Prisma.ApplicationWhereUniqueInput,
        }),
    },

    email: {
      findMany: (args: Prisma.EmailFindManyArgs = {}) =>
        prisma.email.findMany({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      findUnique: async (args: Prisma.EmailFindUniqueArgs) => {
        const row = await prisma.email.findUnique(args)
        return row?.userId === numericUserId ? row : null
      },

      findFirst: (args: Prisma.EmailFindFirstArgs = {}) =>
        prisma.email.findFirst({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      count: (args: Prisma.EmailCountArgs = {}) =>
        prisma.email.count({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      create: (
        args: Omit<Prisma.EmailCreateArgs, 'data'> & {
          data: Omit<Prisma.EmailCreateInput, 'user'>
        },
      ) =>
        prisma.email.create({
          ...args,
          data: { ...args.data, user: { connect: { id: numericUserId } } },
        }),

      update: (args: Prisma.EmailUpdateArgs) =>
        prisma.email.update({
          ...args,
          where: { ...args.where, userId: numericUserId } as Prisma.EmailWhereUniqueInput,
        }),
    },

    event: {
      findMany: (args: Prisma.EventFindManyArgs = {}) =>
        prisma.event.findMany({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      // Events are append-only (PRINCIPLES.md §"Email pipeline — Stage 4: act").
      // No update method — use findMany + create only.
      create: (
        args: Omit<Prisma.EventCreateArgs, 'data'> & {
          data: Omit<Prisma.EventCreateInput, 'user'>
        },
      ) =>
        prisma.event.create({
          ...args,
          data: { ...args.data, user: { connect: { id: numericUserId } } },
        }),
    },

    company: {
      findMany: (args: Prisma.CompanyFindManyArgs = {}) =>
        prisma.company.findMany({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      findUnique: async (args: Prisma.CompanyFindUniqueArgs) => {
        const row = await prisma.company.findUnique(args)
        return row?.userId === numericUserId ? row : null
      },

      findFirst: (args: Prisma.CompanyFindFirstArgs = {}) =>
        prisma.company.findFirst({
          ...args,
          where: { ...args.where, userId: numericUserId },
        }),

      upsert: (
        args: Omit<Prisma.CompanyUpsertArgs, 'create'> & {
          create: Omit<Prisma.CompanyCreateInput, 'user'>
        },
      ) =>
        prisma.company.upsert({
          ...args,
          create: { ...args.create, user: { connect: { id: numericUserId } } },
        }),

      update: (args: Prisma.CompanyUpdateArgs) =>
        prisma.company.update({
          ...args,
          where: { ...args.where, userId: numericUserId } as Prisma.CompanyWhereUniqueInput,
        }),
    },

    stage: {
      findMany: (args: Prisma.StageFindManyArgs = {}) =>
        prisma.stage.findMany({
          ...args,
          // Stage has no direct userId; filter through application ownership.
          where: {
            ...args.where,
            application: { userId: numericUserId },
          },
        }),

      /**
       * @throws {Error} if the parent application does not belong to this tenant.
       *   MUST be called inside withRls() — its fromPromise() boundary converts
       *   the throw to err(errors.db(cause)). Calling outside withRls() propagates
       *   the throw to the caller uncaught.
       */
      // Pre-flight parent check: verify the application belongs to this tenant
      // before creating the stage. RLS is the suspenders; this is the belt.
      create: async (args: Prisma.StageCreateArgs) => {
        const appId =
          (args.data as { applicationId?: number }).applicationId ??
          (args.data as { application?: { connect?: { id?: number } } }).application?.connect?.id
        const app = await prisma.application.findUnique({
          where: { id: appId },
          select: { userId: true },
        })
        if (app?.userId !== numericUserId) {
          throw new Error('Stage parent application not in tenant scope')
        }
        return prisma.stage.create(args)
      },

      /**
       * @throws {Error} if the target stage does not belong to this tenant.
       *   MUST be called inside withRls() — its fromPromise() boundary converts
       *   the throw to err(errors.db(cause)). Calling outside withRls() propagates
       *   the throw to the caller uncaught.
       */
      update: async (args: Prisma.StageUpdateArgs) => {
        // Verify the target stage belongs to this tenant via its application.
        const stage = await prisma.stage.findUnique({
          where: args.where,
          select: { application: { select: { userId: true } } },
        })
        if (stage?.application.userId !== numericUserId) {
          throw new Error('Stage not in tenant scope')
        }
        return prisma.stage.update(args)
      },

      /**
       * @throws {Error} if the target stage does not belong to this tenant.
       *   MUST be called inside withRls() — its fromPromise() boundary converts
       *   the throw to err(errors.db(cause)). Calling outside withRls() propagates
       *   the throw to the caller uncaught.
       */
      delete: async (args: Prisma.StageDeleteArgs) => {
        // Verify the target stage belongs to this tenant via its application.
        const stage = await prisma.stage.findUnique({
          where: args.where,
          select: { application: { select: { userId: true } } },
        })
        if (stage?.application.userId !== numericUserId) {
          throw new Error('Stage not in tenant scope')
        }
        return prisma.stage.delete(args)
      },
    },

    // TODO(full-milestone): add wrappers for recruiter, applicationRecruiter, document.
  }
}
