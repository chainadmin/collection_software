ALTER TABLE "collectors" ADD COLUMN IF NOT EXISTS "extension" text;
ALTER TABLE "collectors" ADD COLUMN IF NOT EXISTS "chiamo_email" text;
CREATE INDEX IF NOT EXISTS "collectors_org_chiamo_email_idx" ON "collectors" ("organization_id", "chiamo_email");
