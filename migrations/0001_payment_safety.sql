ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_transaction_id" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_org_idempotency_unique"
  ON "payments" ("organization_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_transaction_unique"
  ON "payments" ("provider_transaction_id") WHERE "provider_transaction_id" IS NOT NULL;

-- CVV values in payment_cards predate this change.  Do not select or print
-- them during cleanup.  Production must run the separately reviewed cleanup:
-- UPDATE payment_cards SET cvv = NULL WHERE cvv IS NOT NULL;
