ALTER TABLE payment_cards
  ADD COLUMN IF NOT EXISTS external_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_cards_org_external_idempotency_unique
  ON payment_cards (organization_id, external_idempotency_key)
  WHERE external_idempotency_key IS NOT NULL;