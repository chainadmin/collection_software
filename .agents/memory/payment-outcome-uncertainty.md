---
name: Payment outcome uncertainty
description: Safety rule for classifying gateway responses and retries across payment providers.
---

Treat any payment outcome that may have reached the provider—transport failure, malformed or unknown response, held-for-review state, or duplicate warning—as `needs_review`, never as a retryable decline.

**Why:** Retrying an uncertain attempt can charge the debtor twice. Provider duplicate windows are bounded and cannot replace durable application-side state.

**How to apply:** For every new gateway and every card, token, and ACH branch, require an explicit approval for success and an explicit conclusive decline for rerun eligibility. Preserve transaction references and require operator reconciliation for everything else.