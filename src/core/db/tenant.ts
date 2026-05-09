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

      // TODO(lean-milestone): add create / update / delete / aggregate as feature code lands.
      // Each method must inject userId — never trust the caller to add it.
    },

    // TODO(lean-milestone): add wrappers for company, stage, event, email.
    // TODO(full-milestone): add wrappers for recruiter, document.
  }
}
