ALTER TABLE "debtor_references" ADD COLUMN IF NOT EXISTS "phone2" text;
ALTER TABLE "debtor_references" ADD COLUMN IF NOT EXISTS "phone3" text;
ALTER TABLE "debtor_references" ADD COLUMN IF NOT EXISTS "import_slot" integer;