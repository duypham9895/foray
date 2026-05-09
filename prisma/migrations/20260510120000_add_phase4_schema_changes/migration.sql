-- AlterTable: Add gmail_history_id to users table
ALTER TABLE "users" ADD COLUMN "gmail_history_id" TEXT;

-- CreateEnum: ProcessingStatus enum for email pipeline tracking
CREATE TYPE "ProcessingStatus" AS ENUM ('received', 'matched', 'classified', 'acted', 'needs_review', 'failed');

-- AlterTable: Add processing_status to emails table
ALTER TABLE "emails" ADD COLUMN "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'received';

-- CreateIndex: Index on processing_status for filtering
CREATE INDEX "emails_processing_status_idx" ON "emails"("processing_status");
