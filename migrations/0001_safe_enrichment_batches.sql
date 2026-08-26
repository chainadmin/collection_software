ALTER TABLE debtor_contacts ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';
ALTER TABLE debtor_contacts ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE debtor_contacts ADD COLUMN IF NOT EXISTS source_batch_id varchar;
ALTER TABLE debtor_contacts ADD COLUMN IF NOT EXISTS date_added text;
ALTER TABLE debtor_references ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE debtor_references ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE debtor_references ADD COLUMN IF NOT EXISTS source_batch_id varchar;

CREATE TABLE IF NOT EXISTS enrichment_batches (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar NOT NULL, created_by varchar NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL, source_type text NOT NULL CHECK (source_type IN ('MANUAL_SELECTION','FILE_GROUP','PORTFOLIO','FILTERED_SET','OTHER')), source_reference varchar, account_count integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'CREATED', exported_at timestamptz, returned_at timestamptz, processed_at timestamptz, return_file_hash text, notes text);
CREATE INDEX IF NOT EXISTS enrichment_batches_org_idx ON enrichment_batches (organization_id);
CREATE TABLE IF NOT EXISTS enrichment_batch_members (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), batch_id varchar NOT NULL REFERENCES enrichment_batches(id) ON DELETE CASCADE, organization_id varchar NOT NULL, debtor_id varchar NOT NULL REFERENCES debtors(id), existing_file_number text, existing_account_number text NOT NULL, added_at timestamptz NOT NULL DEFAULT now(), UNIQUE(batch_id, debtor_id));
CREATE INDEX IF NOT EXISTS enrichment_members_debtor_idx ON enrichment_batch_members (organization_id, debtor_id);
CREATE TABLE IF NOT EXISTS enrichment_batch_results (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), batch_id varchar NOT NULL REFERENCES enrichment_batches(id) ON DELETE CASCADE, organization_id varchar NOT NULL, row_number integer NOT NULL, row_hash text NOT NULL, debtor_id varchar REFERENCES debtors(id), match_method text, status text NOT NULL, input_data text NOT NULL, preview_data text, error text, processed_by varchar, processed_at timestamptz, manual_override boolean DEFAULT false, UNIQUE(batch_id,row_hash));
CREATE INDEX IF NOT EXISTS enrichment_results_review_idx ON enrichment_batch_results (organization_id,batch_id,status);
CREATE TABLE IF NOT EXISTS debtor_addresses (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar NOT NULL, debtor_id varchar NOT NULL REFERENCES debtors(id), address text NOT NULL, city text, state text, zip_code text, source text, source_batch_id varchar REFERENCES enrichment_batches(id), added_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS debtor_addresses_debtor_idx ON debtor_addresses (organization_id,debtor_id);
CREATE TABLE IF NOT EXISTS enrichment_audit_log (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar NOT NULL, batch_id varchar NOT NULL REFERENCES enrichment_batches(id), debtor_id varchar NOT NULL REFERENCES debtors(id), result_id varchar, actor_id varchar NOT NULL, action text NOT NULL, field text, previous_value text, new_value text, match_method text, manual_override boolean DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS enrichment_audit_debtor_idx ON enrichment_audit_log (organization_id,debtor_id);
