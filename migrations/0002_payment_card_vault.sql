-- Saved-card vault migration. Legacy PAN is retained non-destructively but is
-- no longer mapped by the application. Historical CVV is always purged.
ALTER TABLE payment_cards ADD COLUMN IF NOT EXISTS processor_type text;
ALTER TABLE payment_cards ADD COLUMN IF NOT EXISTS processor_token text;
ALTER TABLE payment_cards ADD COLUMN IF NOT EXISTS processor_customer_id text;
ALTER TABLE payment_cards ADD COLUMN IF NOT EXISTS vault_status text;

UPDATE payment_cards
SET vault_status = 'legacy_unvaulted'
WHERE vault_status IS NULL;

ALTER TABLE payment_cards
  ALTER COLUMN vault_status SET DEFAULT 'legacy_unvaulted',
  ALTER COLUMN vault_status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_cards' AND column_name = 'card_number'
  ) THEN
    ALTER TABLE payment_cards ALTER COLUMN card_number DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_cards' AND column_name = 'cvv'
  ) THEN
    EXECUTE 'UPDATE payment_cards SET cvv = NULL WHERE cvv IS NOT NULL';
  END IF;
END $$;

WITH ranked_defaults AS (
  SELECT id, row_number() OVER (
    PARTITION BY debtor_id ORDER BY added_date DESC NULLS LAST, id DESC
  ) AS rank
  FROM payment_cards WHERE is_default IS TRUE
)
UPDATE payment_cards SET is_default = false
FROM ranked_defaults
WHERE payment_cards.id = ranked_defaults.id AND ranked_defaults.rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS payment_cards_one_default_per_debtor
ON payment_cards (debtor_id) WHERE is_default IS TRUE;