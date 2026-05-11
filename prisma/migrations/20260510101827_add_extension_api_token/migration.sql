-- Add a hashed API token for the Chrome extension capture flow.
-- Raw extension tokens are shown once in Settings and never stored.
ALTER TABLE "users" ADD COLUMN "extension_api_token_hash" TEXT;
