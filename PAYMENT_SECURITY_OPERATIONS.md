# Payment and tenant-security operations

## Existing payment lifecycle

Payments are scheduled by `POST /api/debtors/:id/payments`, processed by
`POST /api/payments/:id/process` (or the existing batch/automatic runner), and
sent through the active tenant merchant by `server/payment-processor.ts`.
Authorization produces a provider transaction ID and moves the existing
payment from pending/processing to processed or declined. Posting is a
separate, existing admin/manager action: it changes the payment to posted,
reduces the debtor balance, changes account status, and creates the payment
history note. Reversal, batch, recurring, messaging, merchant selection, PAN,
and bank-account behavior remain in place.

The payment row is the persistent attempt identity. `idempotency_key` protects
logical creation retries, `provider_transaction_id` protects provider callback
replays, and the processing claim prevents concurrent authorization calls.
Posting locks the payment and debtor rows in one database transaction; payment,
balance, status, and history either all commit or all roll back.

## Authorization inventory and policy

The global `/api` middleware authenticates every non-public route and reloads
the collector before allowing access. A disabled/deleted collector, stale
cross-organization session, or client-supplied conflicting organization ID is
denied. Super-admin endpoints require the independent global-admin session.
Resource routes for debtors/accounts, cards, bank accounts, payments, notes,
documents/messages/campaigns, imports/reports, users, call data, and tenant
settings must load the resource and compare its `organization_id` to the
session organization. Privileged payment posting/reversal and administrative
operations additionally reload and verify the existing admin/manager role.

The intentionally public list is maintained beside the middleware in
`server/routes.ts`; external `/api/v2` endpoints retain their existing bearer
token authorization. New routes must not accept a body/query organization ID
as authorization.

## CVV production cleanup

Historical CVV data may exist in **table `payment_cards`, column `cvv`**. A CVV
entered while scheduling a card is retained only until the first authorization
attempt so the automatic runner can submit it, then that field is cleared. A
later recurring authorization uses the existing stored card credential without
CVV. No PAN, bank account, recurring-payment credential, merchant, or provider
integration is removed.

After backup/retention approval, a production operator must run the commented
cleanup statement in migration `0001_payment_safety.sql` as a separately
reviewed change. Do not query, export, log, or print the values. Verify only an
aggregate null/non-null count, restrict column access, inspect logs/backups for
copies, and follow the organization's approved backup-expiry procedure.

## Deployment and live verification

1. Back up the database and apply `0001_payment_safety.sql` before deploying.
2. Confirm there are no duplicate non-null idempotency/provider transaction IDs
   before index creation; reconcile duplicates rather than deleting payment data.
3. Exercise each configured provider in sandbox: approval, decline, timeout,
   retry with one idempotency key, and duplicate callback.
4. Submit two concurrent process/post requests and verify one provider charge,
   one posting note, and one balance reduction.
5. Verify arrangement and settlement posting and all existing login, account,
   messaging, document, reporting, admin, Global Admin, and Voice workflows.
6. Verify direct-ID requests for another tenant return 403/404 for account,
   consumer, payment, card/document/message/report/user/call resources.

Provider-approved attempts left in `processing` because the database was
temporarily unavailable must be reconciled using the provider transaction and
the same payment/idempotency identity; operators must not create a new payment
or retry with a new identity.
