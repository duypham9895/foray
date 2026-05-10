/**
 * E2E database reset script.
 *
 * Truncates tenant-scoped tables so each E2E test starts with a clean slate.
 * Run via: pnpm e2e:reset-db
 *
 * Safe to run repeatedly — uses TRUNCATE CASCADE which is idempotent.
 */

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Order matters: child tables first, then parent.
  // CASCADE handles foreign keys, but explicit ordering is clearer.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Event",
      "Stage",
      "Email",
      "ApplicationRecruiter",
      "Application"
    CASCADE
  `);

  console.log("[e2e:reset-db] Truncated tenant-scoped tables");
}

main()
  .catch((err) => {
    console.error("[e2e:reset-db] Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
