-- Document version history is deferred for v0.3.
-- The initial scaffold had this column, but Phase 12 removed it from the Prisma schema.
ALTER TABLE "documents" DROP COLUMN IF EXISTS "version";
