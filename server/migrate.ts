import { sql } from "drizzle-orm";
import { db } from "./db";

export async function runMigrations() {
  console.log("Running database migrations...");
  
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    console.log("Database connection verified");

    // Create tables if they don't exist
    // api_tokens
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "token" text NOT NULL,
        "is_active" boolean DEFAULT true,
        "permissions" text[],
        "created_date" text NOT NULL,
        "last_used_date" text,
        "expires_at" text,
        CONSTRAINT "api_tokens_token_unique" UNIQUE("token")
      )
    `);

    // clients
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "contact_name" text,
        "email" text,
        "phone" text,
        "address" text,
        "city" text,
        "state" text,
        "zip_code" text,
        "remittance_email" text,
        "remittance_frequency" text DEFAULT 'monthly',
        "remittance_method" text DEFAULT 'check',
        "is_active" boolean DEFAULT true,
        "notes" text,
        "created_date" text NOT NULL
      )
    `);

    // communication_attempts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "communication_attempts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "debtor_id" varchar NOT NULL,
        "collector_id" varchar,
        "attempt_type" text NOT NULL,
        "direction" text DEFAULT 'outbound' NOT NULL,
        "phone_number" text,
        "email_address" text,
        "outcome" text,
        "duration" integer,
        "notes" text,
        "external_id" text,
        "created_date" text NOT NULL
      )
    `);

    // Add organization_id column to tables that might be missing it
    const tablesToCheck = [
      'fee_schedules',
      'bank_accounts',
      'collectors',
      'debtor_contacts',
      'debtor_references',
      'debtors',
      'drop_batches',
      'drop_items',
      'email_settings',
      'email_templates',
      'employment_records',
      'import_batches',
      'import_mappings',
      'ip_whitelist',
      'liquidation_snapshots',
      'merchants',
      'notes',
      'payment_batches',
      'payment_cards',
      'payments',
      'portfolio_assignments',
      'portfolios',
      'recall_batches',
      'recall_items',
      'remittances',
      'time_clock_entries',
    ];

    for (const table of tablesToCheck) {
      try {
        await db.execute(sql.raw(`
          ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "organization_id" VARCHAR NOT NULL DEFAULT 'default-org'
        `));
      } catch (e) {
        // Column might already exist or table doesn't exist, continue
      }
    }

    // Add unique constraint to organizations.slug if not exists
    try {
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'organizations_slug_unique'
          ) THEN
            ALTER TABLE organizations ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);
          END IF;
        END $$;
      `);
    } catch (e) {
      // Constraint might already exist
    }

    console.log("Database migrations complete");
  } catch (error) {
    console.error("Migration error:", error);
    // Don't throw - let the server continue starting
  }
}
