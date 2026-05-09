-- CreateEnum
CREATE TYPE "CanonicalStatus" AS ENUM ('applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('linkedin', 'direct', 'referral', 'recruiter', 'other');

-- CreateEnum
CREATE TYPE "EmailClassification" AS ENUM ('rejection', 'interview_invite', 'recruiter_outreach', 'noise', 'unmatched');

-- CreateEnum
CREATE TYPE "ClassifiedBy" AS ENUM ('rules', 'llm', 'manual');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('created', 'status_changed', 'auto_status_changed', 'status_undone', 'stage_added', 'stage_completed', 'email_received', 'note_added', 'manual_classification', 'document_uploaded', 'recruiter_linked', 'archived', 'unarchived');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('manual', 'gmail', 'bookmarklet', 'extension', 'cron', 'system');

-- CreateEnum
CREATE TYPE "StageOutcome" AS ENUM ('passed', 'failed', 'no_response');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('resume', 'cover_letter', 'jd_pdf', 'take_home', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "gmail_refresh_token_encrypted" TEXT,
    "gmail_last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "role_title" TEXT NOT NULL,
    "role_url" TEXT,
    "job_description" TEXT,
    "location" TEXT,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_currency" TEXT,
    "source" "ApplicationSource" NOT NULL DEFAULT 'other',
    "referred_by" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canonical_status" "CanonicalStatus" NOT NULL DEFAULT 'applied',
    "current_stage" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "follow_up_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "outcome" "StageOutcome",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "type" "EventType" NOT NULL,
    "source" "EventSource" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "undoable" BOOLEAN NOT NULL DEFAULT false,
    "undone_at" TIMESTAMP(3),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "application_id" INTEGER,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_thread_id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "from_domain" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_excerpt" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "classification" "EmailClassification",
    "confidence" DOUBLE PRECISION,
    "classified_by" "ClassifiedBy",
    "reviewed_by_user" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiters" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "linkedin_url" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_recruiters" (
    "application_id" INTEGER NOT NULL,
    "recruiter_id" INTEGER NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_recruiters_pkey" PRIMARY KEY ("application_id","recruiter_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "companies_user_id_idx" ON "companies"("user_id");

-- CreateIndex
CREATE INDEX "companies_domain_idx" ON "companies"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "companies_user_id_name_key" ON "companies"("user_id", "name");

-- CreateIndex
CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");

-- CreateIndex
CREATE INDEX "applications_company_id_idx" ON "applications"("company_id");

-- CreateIndex
CREATE INDEX "applications_canonical_status_idx" ON "applications"("canonical_status");

-- CreateIndex
CREATE INDEX "applications_last_activity_at_idx" ON "applications"("last_activity_at");

-- CreateIndex
CREATE INDEX "applications_archived_at_idx" ON "applications"("archived_at");

-- CreateIndex
CREATE INDEX "applications_follow_up_at_idx" ON "applications"("follow_up_at");

-- CreateIndex
CREATE INDEX "stages_application_id_idx" ON "stages"("application_id");

-- CreateIndex
CREATE INDEX "stages_scheduled_at_idx" ON "stages"("scheduled_at");

-- CreateIndex
CREATE INDEX "events_application_id_idx" ON "events"("application_id");

-- CreateIndex
CREATE INDEX "events_user_id_idx" ON "events"("user_id");

-- CreateIndex
CREATE INDEX "events_occurred_at_idx" ON "events"("occurred_at");

-- CreateIndex
CREATE INDEX "events_type_idx" ON "events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "emails_gmail_message_id_key" ON "emails"("gmail_message_id");

-- CreateIndex
CREATE INDEX "emails_user_id_idx" ON "emails"("user_id");

-- CreateIndex
CREATE INDEX "emails_application_id_idx" ON "emails"("application_id");

-- CreateIndex
CREATE INDEX "emails_gmail_thread_id_idx" ON "emails"("gmail_thread_id");

-- CreateIndex
CREATE INDEX "emails_from_domain_idx" ON "emails"("from_domain");

-- CreateIndex
CREATE INDEX "emails_classification_idx" ON "emails"("classification");

-- CreateIndex
CREATE INDEX "emails_reviewed_by_user_idx" ON "emails"("reviewed_by_user");

-- CreateIndex
CREATE INDEX "emails_received_at_idx" ON "emails"("received_at");

-- CreateIndex
CREATE INDEX "recruiters_user_id_idx" ON "recruiters"("user_id");

-- CreateIndex
CREATE INDEX "recruiters_company_id_idx" ON "recruiters"("company_id");

-- CreateIndex
CREATE INDEX "recruiters_email_idx" ON "recruiters"("email");

-- CreateIndex
CREATE INDEX "documents_application_id_idx" ON "documents"("application_id");

-- CreateIndex
CREATE INDEX "documents_kind_idx" ON "documents"("kind");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_recruiters" ADD CONSTRAINT "application_recruiters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_recruiters" ADD CONSTRAINT "application_recruiters_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "recruiters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
