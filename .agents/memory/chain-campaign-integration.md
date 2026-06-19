---
name: Chain campaign integration vs other "integration" surfaces
description: Disambiguates three separate, easily-confused messaging/integration features so future work targets the right one.
---

There are three distinct, easy-to-confuse surfaces in this app. Do not conflate them:

1. **Chain campaign integration** — a backend-only feature for sending SMS/email
   campaigns to debtors. Tables: `campaign_integrations`, `campaign_logs`.
   Routes: `/api/campaign-integrations` (CRUD), `/api/campaigns/send`, plus v2
   campaign endpoints. As of the work that wrote this note it had **no frontend UI**.

2. **"Text & Email Integration" tab** (admin/integrations.tsx) — this is the
   external API v2 surface: organization-scoped Bearer **API tokens** so outside
   SMS/softphone/dialer platforms can call our API. It is NOT the campaign sender.

3. **System → company notification emails** — Nodemailer/SMTP (and any Postmark
   work) used by the super-admin system account to email companies (e.g. signup
   notifications). Stored under `email_settings` with
   `organizationId = "system-super-admin"`. Unrelated to debtor messaging.

**Why:** "integration", "email", and "campaign" each appear in multiple places;
picking the wrong one sends edits to the wrong tables/routes.
**How to apply:** When a task mentions Chain or debtor campaigns, target
`campaign_integrations`/`campaign_logs` + `/api/campaigns/*`. When it mentions
API access for third-party tools, target the v2 token UI. When it mentions
emailing the company/org itself, target the super-admin SMTP settings.
