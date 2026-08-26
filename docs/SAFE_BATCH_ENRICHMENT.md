# Safe batch enrichment architecture

## Existing identifier audit

The account record is `debtors`; this workflow never inserts into it. Matching is always constrained to both the authenticated `organization_id` and the accounts already referenced by the batch. The identifiers, in descending match priority, are:

1. `debtors.id` (`internalAccountId` in exports): the existing UUID primary key and safest match key.
2. `debtors.file_number` (`fileNumber`): the existing tracking/file number, unique within an existing portfolio.
3. `debtors.account_number` (`accountNumber`): the existing client/source account number.

The existing `organization_id` is the tenant boundary, `portfolio_id` is the existing portfolio relationship, and `client_id` is the existing creditor/client relationship. The current account import endpoint does not persist an import-batch foreign key on `debtors`; consequently `FILE_GROUP` uses the existing file number and does not invent an import identity. Portfolio selection uses a database predicate rather than browser-side loading.

## Safety invariants

- Batch membership stores references and identifier snapshots, not copied accounts.
- Returns only match members of the specified tenant-owned batch. Missing, ambiguous, or conflicting identifiers remain `MATCH_REVIEW_REQUIRED`; they never enter normal account creation.
- Preview stages rows. Apply is a separate explicit operation and each row is transactional, idempotent, and audited.
- Apply only inserts contact, related-person, and address data. It never updates debtor identity, balance, payment, note, ownership, portfolio, collector, or status fields.
- Existing phone records are never updated during merge, so invalid, blocked, do-not-call, wrong-number, and other suppression state represented by the existing record remains authoritative.
- File hashes and per-row hashes protect against duplicate returns, while normalized comparisons protect against duplicate enrichment items.

Run migration `0001_safe_enrichment_batches.sql` before using the API. Normal imports and their tables/routes are unchanged.
