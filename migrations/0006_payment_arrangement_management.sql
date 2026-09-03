CREATE TABLE IF NOT EXISTS "payment_arrangement_audits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" varchar NOT NULL,
  "debtor_id" varchar NOT NULL,
  "arrangement_id" text NOT NULL,
  "mutation_id" text NOT NULL,
  "action" text NOT NULL,
  "collector_id" varchar NOT NULL,
  "request_state" text NOT NULL,
  "before_state" text NOT NULL,
  "after_state" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_arrangement_audits_org_mutation_unique"
  ON "payment_arrangement_audits" ("organization_id", "mutation_id");

CREATE INDEX IF NOT EXISTS "payment_arrangement_audits_arrangement_idx"
  ON "payment_arrangement_audits" ("organization_id", "debtor_id", "arrangement_id");