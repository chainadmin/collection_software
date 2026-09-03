ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "arrangement_id" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "arrangement_index" integer;
ALTER TABLE "payment_cards" ADD COLUMN IF NOT EXISTS "merchant_id" varchar;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_org_arrangement_row_unique"
  ON "payments" ("organization_id", "arrangement_id", "arrangement_index");