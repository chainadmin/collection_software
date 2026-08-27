# Saved-card security scope

Saved cards are vaulted with the organization's active processor before any
database row is created. Authorize.Net cards use CIM customer/payment profiles;
Stripe cards use a customer-attached PaymentMethod confirmed by a SetupIntent.
NMI and USAePay card saving is rejected until a verified no-charge vault
implementation is available.

The database model and APIs expose only processor references, brand, last four,
expiry, cardholder name, billing ZIP, and default/status metadata. Historical
`card_number` and `cvv` database columns remain temporarily for migration
compatibility but are not mapped, returned, or used. Their destructive purge
requires separate approval.

Because merchant publishable/client keys are not currently represented in the
tenant configuration, hosted browser fields cannot be configured. PAN and CVV
therefore pass through this application's TLS-protected server solely for the
vault request and are never logged or persisted. This keeps the application
server in PCI DSS card-data-environment scope; the organization must validate
the applicable SAQ with its acquirer/QSA (commonly SAQ D for this server-side
handling). Adding hosted fields and merchant public credentials is the
recommended scope-reduction follow-up.