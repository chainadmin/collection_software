---
name: Multi-tenant org isolation
description: How tenant ownership must be enforced on routes, and which tables can't be filtered by org directly
---

# Org isolation pattern (debt collection app)

Every route that accepts a resource id (URL param or body field) must verify the
resource belongs to the caller's org BEFORE reading, writing, updating, or
deleting it. The codebase has helpers for this (an org-from-session getter and an
ownership validator); the main debtor GET route is the reference implementation.
This applies to creates too: validate every foreign-key id in the body
(debtorId, collectorId, companyId, etc.) belongs to the caller's org, or you
allow cross-tenant data injection.

**Why:** during a pre-launch audit, many sub-resource routes (debtor
bank-accounts/cards/payments/notes, card delete, collector get, recall items,
consolidation cases, work queue) had no ownership check — allowing cross-tenant
read AND write. One payment-create path even adjusted another org's debtor
balance.

**How to apply:** treat any handler that trusts a client-supplied id without an
ownership check as a bug, even if the table has an org column on the new row.

## Tables WITHOUT an organizationId column
`consolidation_cases` and `work_queue_items` have no org column. Do NOT try to
filter them directly by org — scope through a related entity that does carry org
(consolidation cases via their consolidation company; work-queue items via their
collector). Note: insert handlers that spread an `organizationId` into these
tables silently drop it (the ORM ignores keys that aren't columns), so isolation
must come from the related-entity check, not the stored row.
