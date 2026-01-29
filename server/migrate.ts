import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  console.log("Running database migrations...");
  
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set, skipping migrations");
    return;
  }

  try {
    // Test connection
    await db.execute(sql`SELECT 1`);
    console.log("Database connection verified");

    // Create all tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "address" text,
        "city" text,
        "state" text,
        "zip_code" text,
        "phone" text,
        "email" text,
        "website" text,
        "timezone" text DEFAULT 'America/New_York',
        "is_active" boolean DEFAULT true,
        "created_date" text NOT NULL,
        "settings" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" text NOT NULL UNIQUE,
        "password" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
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

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "collectors" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        "role" text NOT NULL DEFAULT 'collector',
        "status" text NOT NULL DEFAULT 'active',
        "avatar_initials" text,
        "goal" integer DEFAULT 0,
        "hourly_wage" integer DEFAULT 0,
        "can_view_dashboard" boolean DEFAULT false,
        "can_view_email" boolean DEFAULT false,
        "can_view_payment_runner" boolean DEFAULT false
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "portfolios" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "client_id" varchar,
        "fee_schedule_id" varchar,
        "purchase_date" text NOT NULL,
        "purchase_price" integer NOT NULL,
        "total_face_value" integer NOT NULL,
        "total_accounts" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "creditor_name" text,
        "debt_type" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "portfolio_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "collector_id" varchar NOT NULL,
        "assigned_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "debtors" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "assigned_collector_id" varchar,
        "linked_account_id" varchar,
        "file_number" text,
        "account_number" text NOT NULL,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "date_of_birth" text,
        "ssn" text,
        "ssn_last_4" text,
        "email" text,
        "address" text,
        "city" text,
        "state" text,
        "zip_code" text,
        "original_creditor" text,
        "client_name" text,
        "client_id" varchar,
        "original_balance" integer NOT NULL,
        "current_balance" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'newbiz',
        "last_contact_date" text,
        "next_follow_up_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "debtor_contacts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "type" text NOT NULL,
        "value" text NOT NULL,
        "label" text,
        "is_primary" boolean DEFAULT false,
        "is_valid" boolean DEFAULT true,
        "last_verified" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "employment_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "employer_name" text NOT NULL,
        "employer_phone" text,
        "employer_address" text,
        "position" text,
        "start_date" text,
        "salary" integer,
        "is_current" boolean DEFAULT true,
        "verified_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "debtor_references" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "name" text NOT NULL,
        "relationship" text,
        "phone" text,
        "address" text,
        "city" text,
        "state" text,
        "zip_code" text,
        "notes" text,
        "added_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "bank_name" text NOT NULL,
        "account_type" text NOT NULL,
        "routing_number" text,
        "account_number_last_4" text,
        "is_verified" boolean DEFAULT false,
        "verified_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "payment_cards" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "card_type" text NOT NULL,
        "cardholder_name" text NOT NULL,
        "card_number" text NOT NULL,
        "card_number_last_4" text NOT NULL,
        "expiry_month" text NOT NULL,
        "expiry_year" text NOT NULL,
        "cvv" text,
        "billing_zip" text,
        "is_default" boolean DEFAULT false,
        "added_date" text NOT NULL,
        "added_by" varchar
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "batch_id" varchar,
        "card_id" varchar,
        "amount" integer NOT NULL,
        "payment_date" text NOT NULL,
        "payment_method" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "reference_number" text,
        "processed_by" varchar,
        "notes" text,
        "frequency" text,
        "next_payment_date" text,
        "specific_dates" text,
        "is_recurring" boolean DEFAULT false
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "payment_batches" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "created_by" varchar NOT NULL,
        "created_date" text NOT NULL,
        "scheduled_date" text,
        "status" text NOT NULL DEFAULT 'draft',
        "total_payments" integer DEFAULT 0,
        "total_amount" integer DEFAULT 0,
        "success_count" integer DEFAULT 0,
        "failed_count" integer DEFAULT 0,
        "processed_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "collector_id" varchar NOT NULL,
        "content" text NOT NULL,
        "note_type" text NOT NULL DEFAULT 'general',
        "created_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "liquidation_snapshots" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "snapshot_date" text NOT NULL,
        "total_collected" integer NOT NULL,
        "total_accounts" integer NOT NULL,
        "accounts_worked" integer NOT NULL,
        "liquidation_rate" integer NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "ip_whitelist" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "ip_address" text NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "created_date" text NOT NULL,
        "created_by" varchar
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "merchants" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "merchant_id" text NOT NULL,
        "processor_type" text NOT NULL,
        "is_active" boolean DEFAULT true,
        "api_key_ref" text,
        "nmi_security_key" text,
        "nmi_username" text,
        "nmi_password" text,
        "usaepay_source_key" text,
        "usaepay_pin" text,
        "test_mode" boolean DEFAULT true,
        "created_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fee_schedules" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "fee_type" text NOT NULL,
        "fee_percentage" integer,
        "flat_fee_amount" integer,
        "minimum_fee" integer,
        "is_active" boolean DEFAULT true,
        "effective_date" text NOT NULL,
        "created_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "subject" text NOT NULL,
        "body" text NOT NULL,
        "template_type" text NOT NULL,
        "is_active" boolean DEFAULT true,
        "created_date" text NOT NULL,
        "updated_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "email_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "smtp_host" text,
        "smtp_port" integer,
        "smtp_user" text,
        "smtp_secure" boolean DEFAULT true,
        "from_email" text,
        "from_name" text,
        "is_active" boolean DEFAULT false
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "remittances" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "client_name" text NOT NULL,
        "amount" integer NOT NULL,
        "remittance_date" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "check_number" text,
        "notes" text,
        "created_by" varchar
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "remittance_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "remittance_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "payment_id" varchar NOT NULL,
        "amount" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'posted',
        "decline_reason" text,
        "reverse_reason" text,
        "processed_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "time_clock_entries" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "collector_id" varchar NOT NULL,
        "clock_in" text NOT NULL,
        "clock_out" text,
        "total_minutes" integer,
        "notes" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "import_batches" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "file_name" text NOT NULL,
        "import_type" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "total_records" integer DEFAULT 0,
        "success_records" integer DEFAULT 0,
        "failed_records" integer DEFAULT 0,
        "mapping_id" varchar,
        "created_date" text NOT NULL,
        "created_by" varchar,
        "processed_date" text,
        "error_log" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "import_mappings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "import_type" text NOT NULL,
        "field_mappings" text NOT NULL,
        "is_default" boolean DEFAULT false,
        "created_date" text NOT NULL,
        "created_by" varchar
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "drop_batches" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "portfolio_id" varchar,
        "total_accounts" integer DEFAULT 0,
        "status" text NOT NULL DEFAULT 'pending',
        "created_date" text NOT NULL,
        "created_by" varchar,
        "processed_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "drop_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "drop_batch_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "collector_id" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "assigned_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "recall_batches" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "name" text NOT NULL,
        "portfolio_id" varchar,
        "client_name" text,
        "total_accounts" integer DEFAULT 0,
        "keeper_count" integer DEFAULT 0,
        "recall_count" integer DEFAULT 0,
        "status" text NOT NULL DEFAULT 'pending',
        "created_date" text NOT NULL,
        "processed_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "recall_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" varchar NOT NULL,
        "recall_batch_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "is_keeper" boolean DEFAULT false,
        "recall_reason" text,
        "keeper_reason" text,
        "processed_date" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "consolidation_companies" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "contact_name" text,
        "phone" text,
        "email" text,
        "address" text,
        "is_active" boolean DEFAULT true,
        "created_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "consolidation_cases" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "debtor_id" varchar NOT NULL,
        "consolidation_company_id" varchar NOT NULL,
        "case_number" text,
        "status" text NOT NULL DEFAULT 'active',
        "monthly_payment" integer,
        "total_settlement_amount" integer,
        "start_date" text NOT NULL,
        "end_date" text,
        "notes" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "work_queue_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "collector_id" varchar NOT NULL,
        "debtor_id" varchar NOT NULL,
        "priority" integer DEFAULT 0,
        "status" text NOT NULL DEFAULT 'pending',
        "assigned_date" text NOT NULL,
        "worked_date" text,
        "outcome" text,
        "notes" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "token" text NOT NULL UNIQUE,
        "is_active" boolean DEFAULT true,
        "permissions" text[],
        "created_date" text NOT NULL,
        "last_used_date" text,
        "expires_at" text
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "communication_attempts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "debtor_id" varchar NOT NULL,
        "collector_id" varchar,
        "attempt_type" text NOT NULL,
        "direction" text NOT NULL DEFAULT 'outbound',
        "phone_number" text,
        "email_address" text,
        "outcome" text,
        "duration" integer,
        "notes" text,
        "external_id" text,
        "created_date" text NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "global_admins" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" text NOT NULL UNIQUE,
        "email" text,
        "password" text NOT NULL,
        "name" text NOT NULL,
        "created_date" text NOT NULL,
        "is_active" boolean DEFAULT true
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "admin_notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" text NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "organization_id" varchar,
        "organization_name" text,
        "metadata" text,
        "is_read" boolean DEFAULT false,
        "created_date" text NOT NULL
      )
    `);

    console.log("All tables created successfully!");

    // Safe schema migrations for existing tables (ADD COLUMN IF NOT EXISTS)
    console.log("Running safe schema updates...");
    
    // Add username column to global_admins if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_admins' AND column_name = 'username') THEN
          ALTER TABLE global_admins ADD COLUMN username text;
        END IF;
      END $$;
    `);

    // Backfill null usernames with email or generated value before setting NOT NULL
    await db.execute(sql`
      UPDATE global_admins SET username = COALESCE(email, 'admin_' || id) WHERE username IS NULL;
    `);

    // Set username to NOT NULL if not already
    await db.execute(sql`
      DO $$ 
      BEGIN 
        ALTER TABLE global_admins ALTER COLUMN username SET NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        -- Column might already be NOT NULL, ignore error
      END $$;
    `);

    // Make email nullable if it's currently NOT NULL
    await db.execute(sql`
      DO $$ 
      BEGIN 
        ALTER TABLE global_admins ALTER COLUMN email DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        -- Column might already be nullable, ignore error
      END $$;
    `);

    // Add unique constraint to username if not exists
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_admins_username_unique') THEN
          ALTER TABLE global_admins ADD CONSTRAINT global_admins_username_unique UNIQUE (username);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Constraint might already exist, ignore error
      END $$;
    `);

    // Add customFields column to debtors if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debtors' AND column_name = 'custom_fields') THEN
          ALTER TABLE debtors ADD COLUMN custom_fields text;
        END IF;
      END $$;
    `);

    // Add account_number to bank_accounts if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bank_accounts' AND column_name = 'account_number') THEN
          ALTER TABLE bank_accounts ADD COLUMN account_number text;
        END IF;
      END $$;
    `);

    // Add Authorize.net fields to merchants if they don't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'authorize_net_api_login_id') THEN
          ALTER TABLE merchants ADD COLUMN authorize_net_api_login_id text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'authorize_net_transaction_key') THEN
          ALTER TABLE merchants ADD COLUMN authorize_net_transaction_key text;
        END IF;
      END $$;
    `);

    // Add subscription billing fields to organizations if they don't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'subscription_plan') THEN
          ALTER TABLE organizations ADD COLUMN subscription_plan text DEFAULT 'starter';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'subscription_status') THEN
          ALTER TABLE organizations ADD COLUMN subscription_status text DEFAULT 'trial';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'trial_end_date') THEN
          ALTER TABLE organizations ADD COLUMN trial_end_date text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_start_date') THEN
          ALTER TABLE organizations ADD COLUMN billing_start_date text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'first_month_free') THEN
          ALTER TABLE organizations ADD COLUMN first_month_free boolean DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'seat_limit') THEN
          ALTER TABLE organizations ADD COLUMN seat_limit integer DEFAULT 4;
        END IF;
      END $$;
    `);

    console.log("Schema updates complete!");

    // Seed chainadmin super admin - DELETE and recreate to ensure correct password
    console.log("Setting up chainadmin super admin...");
    // Password hash for VV3$0vvlif3 (SHA-256)
    const passwordHash = '67ba92b9952c2ba4d266a0c79a80f09b3a1930f6b9a95e66f37eec6df9f7bb43';
    
    // Delete existing chainadmin if present
    await db.execute(sql`
      DELETE FROM global_admins WHERE username = 'chainadmin'
    `);
    
    // Create fresh chainadmin with correct password
    await db.execute(sql`
      INSERT INTO global_admins (id, username, password, name, created_date, is_active)
      VALUES (gen_random_uuid(), 'chainadmin', ${passwordHash}, 'Chain Admin', ${new Date().toISOString().split('T')[0]}, true)
    `);
    console.log("Created chainadmin super admin with password hash: " + passwordHash.substring(0, 10) + "...");

    console.log("Database migrations complete!");
  } catch (error: any) {
    console.error("Migration error:", error.message || error);
    // Don't throw - let the server continue starting
  }
}
