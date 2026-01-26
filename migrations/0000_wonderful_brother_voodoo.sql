CREATE TABLE "api_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"permissions" text[],
	"created_date" text NOT NULL,
	"last_used_date" text,
	"expires_at" text,
	CONSTRAINT "api_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"bank_name" text NOT NULL,
	"account_type" text NOT NULL,
	"routing_number" text,
	"account_number_last_4" text,
	"is_verified" boolean DEFAULT false,
	"verified_date" text
);
--> statement-breakpoint
CREATE TABLE "clients" (
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
);
--> statement-breakpoint
CREATE TABLE "collectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'collector' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"avatar_initials" text,
	"goal" integer DEFAULT 0,
	"hourly_wage" integer DEFAULT 0,
	"can_view_dashboard" boolean DEFAULT false,
	"can_view_email" boolean DEFAULT false,
	"can_view_payment_runner" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "communication_attempts" (
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
);
--> statement-breakpoint
CREATE TABLE "consolidation_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debtor_id" varchar NOT NULL,
	"consolidation_company_id" varchar NOT NULL,
	"case_number" text,
	"status" text DEFAULT 'active' NOT NULL,
	"monthly_payment" integer,
	"total_settlement_amount" integer,
	"start_date" text NOT NULL,
	"end_date" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "consolidation_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"is_active" boolean DEFAULT true,
	"created_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debtor_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false,
	"is_valid" boolean DEFAULT true,
	"last_verified" text
);
--> statement-breakpoint
CREATE TABLE "debtor_references" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "debtors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"status" text DEFAULT 'newbiz' NOT NULL,
	"last_contact_date" text,
	"next_follow_up_date" text
);
--> statement-breakpoint
CREATE TABLE "drop_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"portfolio_id" varchar,
	"total_accounts" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_date" text NOT NULL,
	"created_by" varchar,
	"processed_date" text
);
--> statement-breakpoint
CREATE TABLE "drop_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"drop_batch_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"collector_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_secure" boolean DEFAULT true,
	"from_email" text,
	"from_name" text,
	"is_active" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"template_type" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_date" text NOT NULL,
	"updated_date" text
);
--> statement-breakpoint
CREATE TABLE "employment_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "fee_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"file_name" text NOT NULL,
	"import_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_records" integer DEFAULT 0,
	"success_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"mapping_id" varchar,
	"created_date" text NOT NULL,
	"created_by" varchar,
	"processed_date" text,
	"error_log" text
);
--> statement-breakpoint
CREATE TABLE "import_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"import_type" text NOT NULL,
	"field_mappings" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_date" text NOT NULL,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "ip_whitelist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"ip_address" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_date" text NOT NULL,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "liquidation_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"snapshot_date" text NOT NULL,
	"total_collected" integer NOT NULL,
	"total_accounts" integer NOT NULL,
	"accounts_worked" integer NOT NULL,
	"liquidation_rate" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"collector_id" varchar NOT NULL,
	"content" text NOT NULL,
	"note_type" text DEFAULT 'general' NOT NULL,
	"created_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
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
	"settings" text,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_date" text NOT NULL,
	"scheduled_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_payments" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"processed_date" text
);
--> statement-breakpoint
CREATE TABLE "payment_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"batch_id" varchar,
	"card_id" varchar,
	"amount" integer NOT NULL,
	"payment_date" text NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference_number" text,
	"processed_by" varchar,
	"notes" text,
	"frequency" text,
	"next_payment_date" text,
	"specific_dates" text,
	"is_recurring" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "portfolio_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"collector_id" varchar NOT NULL,
	"assigned_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"client_id" varchar,
	"fee_schedule_id" varchar,
	"purchase_date" text NOT NULL,
	"purchase_price" integer NOT NULL,
	"total_face_value" integer NOT NULL,
	"total_accounts" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"creditor_name" text,
	"debt_type" text
);
--> statement-breakpoint
CREATE TABLE "recall_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"portfolio_id" varchar,
	"client_name" text,
	"total_accounts" integer DEFAULT 0,
	"keeper_count" integer DEFAULT 0,
	"recall_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_date" text NOT NULL,
	"processed_date" text
);
--> statement-breakpoint
CREATE TABLE "recall_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"recall_batch_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"is_keeper" boolean DEFAULT false,
	"recall_reason" text,
	"keeper_reason" text,
	"processed_date" text
);
--> statement-breakpoint
CREATE TABLE "remittance_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remittance_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"payment_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"decline_reason" text,
	"reverse_reason" text,
	"processed_date" text
);
--> statement-breakpoint
CREATE TABLE "remittances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"client_name" text NOT NULL,
	"amount" integer NOT NULL,
	"remittance_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"check_number" text,
	"notes" text,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "time_clock_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"collector_id" varchar NOT NULL,
	"clock_in" text NOT NULL,
	"clock_out" text,
	"total_minutes" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "work_queue_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collector_id" varchar NOT NULL,
	"debtor_id" varchar NOT NULL,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_date" text NOT NULL,
	"worked_date" text,
	"outcome" text,
	"notes" text
);
