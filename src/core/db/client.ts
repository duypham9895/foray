import 'server-only'

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. See .env.example.')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg(pool) })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
