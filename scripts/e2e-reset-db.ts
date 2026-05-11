/**
 * E2E database reset script.
 *
 * Truncates tenant-scoped tables so each E2E test starts with a clean slate.
 * Run via: pnpm e2e:reset-db
 *
 * Safe to run repeatedly — uses TRUNCATE CASCADE which is idempotent.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Order matters: child tables first, then parent.
  // CASCADE handles foreign keys, but explicit ordering is clearer.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      calendar_events,
      documents,
      application_recruiters,
      events,
      stages,
      emails,
      applications,
      recruiters,
      companies
    RESTART IDENTITY CASCADE
  `);

  console.log("[e2e:reset-db] Truncated tenant-scoped tables");
}

main()
  .catch((err) => {
    console.error("[e2e:reset-db] Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
