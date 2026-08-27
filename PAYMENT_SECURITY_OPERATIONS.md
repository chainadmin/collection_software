# Payment and tenant-security operations

## Existing payment lifecycle

Payments are scheduled by `POST /api/debtors/:id/payments`, processed by
`POST /api/payments/:id/process` (or the existing batch/automatic runner), and
sent through the active tenant merchant by `server/payment-processor.ts`.
Authorization produces a provider transaction ID and moves the existing
payment from pending/processing to processed or declined. Posting is a
separate, existing admin/manager action: it changes the payment to posted,
reduces the debtor balance, changes account status, and creates the payment
history note. Reversal, batch, recurring, messaging, merchant selection, and
bank-account behavior remain in place; saved-card PAN handling is replaced by
the vault flow below.

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

## Saved-card vaulting

Card saves are no-charge vault operations performed before a metadata row is
inserted. The application schema maps only brand, last four, expiration,
cardholder/billing metadata, processor type, reusable processor identifiers,
default selection, and vault status. PAN and CVV exist only in request memory
for the duration of the processor vault call and are never returned or logged.

Authenticated Chain requests may submit full card details to
`POST /api/v2/insert_payments_external` only when scheduling a future card
payment. The request must include a stable idempotency key. DMP reserves one
vault record for that organization and key, vaults the card immediately, then
creates the pending payment with the saved-card ID and a null payment token.
Retries reuse the same reservation. All non-card request fields are screened
for PAN/CVV values before any row is written, and API responses use an explicit
payment allowlist.

Authorize.Net uses CIM customer and payment profiles; subsequent cards reuse
the debtor's customer profile. Stripe saved-card creation is explicitly
unsupported until a tenant publishable-key plus Elements/Checkout hosted setup
flow is implemented; the server never submits raw card data to Stripe's
PaymentMethod API. NMI uses its `add_customer` customer-vault operation.
USAePay currently fails explicitly because a no-charge mechanism has not been
verified for this integration.

Provider calls use a stable per-payment order reference; Stripe additionally
uses its request-level idempotency key. A transport timeout, malformed response,
or missing processor outcome moves the payment to `needs_review`, not
`declined`. Review payments cannot be rerun automatically and do not create the
next recurring occurrence.

Safe migration leaves historical raw database columns and their values in place
to avoid destructive deletion, but removes them from the application mapping,
makes the old PAN column nullable for new rows, and marks historical cards
`legacy_unvaulted`. The payment runner refuses those rows. Production operators
must handle eventual legacy-data destruction through a separately approved
retention and backup-expiry process; never query, export, or print those values.

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
