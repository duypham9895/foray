-- Phase 16: Google Calendar integration

ALTER TABLE "users"
  ADD COLUMN "calendar_refresh_token_encrypted" TEXT,
  ADD COLUMN "calendar_last_sync_at" TIMESTAMP(3);

CREATE TABLE "calendar_events" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "application_id" INTEGER,
  "calendar_id" TEXT NOT NULL DEFAULT 'primary',
  "google_event_id" TEXT NOT NULL,
  "etag" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description_excerpt" TEXT,
  "location" TEXT,
  "html_link" TEXT,
  "hangout_link" TEXT,
  "organizer_email" TEXT,
  "attendee_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "matched_domain" TEXT,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_events_user_id_calendar_id_google_event_id_key"
  ON "calendar_events"("user_id", "calendar_id", "google_event_id");
CREATE INDEX "calendar_events_user_id_idx" ON "calendar_events"("user_id");
CREATE INDEX "calendar_events_application_id_idx" ON "calendar_events"("application_id");
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");
CREATE INDEX "calendar_events_status_idx" ON "calendar_events"("status");

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON calendar_events
  USING       (user_id = NULLIF(current_setting('app.user_id', true), '')::int)
  WITH CHECK  (user_id = NULLIF(current_setting('app.user_id', true), '')::int);
