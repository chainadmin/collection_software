UPDATE "merchants" SET "test_mode" = false WHERE "test_mode" IS DISTINCT FROM false;
ALTER TABLE "merchants" ALTER COLUMN "test_mode" SET DEFAULT false;
