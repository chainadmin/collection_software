DROP INDEX IF EXISTS payments_provider_transaction_unique;

CREATE UNIQUE INDEX IF NOT EXISTS payments_org_provider_transaction_unique
  ON payments (organization_id, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

ALTER TABLE payment_cards
  ADD COLUMN IF NOT EXISTS external_credential_fingerprint text;