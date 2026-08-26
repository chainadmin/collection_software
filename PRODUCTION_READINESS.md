# Production readiness audit

Audit date: 2026-08-26

## Scope and architecture

- **Frontend:** React 18, TypeScript, Vite, TanStack Query, Wouter, Tailwind and Radix UI.
- **Backend:** Express/TypeScript, bundled with esbuild. Authentication uses server-side PostgreSQL sessions and bcrypt, with a legacy SHA-256 password verification path.
- **Database:** PostgreSQL through Drizzle ORM. `shared/schema.ts` defines organizations, collectors, debtors, portfolios, payments, stored payment instruments, imports, communications, reporting and administrative records. Tenant records carry `organizationId`; application-layer checks provide isolation (there is no database row-level security).
- **Roles:** global admin plus organization `admin`, `manager`, and `collector`; three collector feature flags supplement roles.
- **Integrations:** Authorize.Net, Stripe, NMI, USAePay and Postmark are represented. SMS receiving, consumer self-service portal, document upload/e-signature, password reset, settlement offers and dedicated notification delivery are not implemented as complete end-to-end systems.
- **PWA:** two manifests (administrative and collector), a versioned service worker, immutable build-asset caching, network-only API requests, install hooks and a user-controlled update prompt.

## Architectural risks

1. Tenant separation is enforced in application code rather than PostgreSQL RLS. Several list operations load all tenants and filter in memory; a missed filter would disclose data and these queries will not scale.
2. The global API authentication middleware authenticates collectors but most administrative routes do not consistently enforce an `admin` or `manager` role. Hidden UI is not a security boundary.
3. Raw card numbers, CVVs, bank account numbers, and merchant credentials are modeled in the primary database and used for gateway calls. This requires a PCI-scoped design review, encryption/key management, strict retention controls, and provider tokenization before production.
4. Payment posting is a multi-step read/update workflow without a database transaction, row lock, or idempotency key. Concurrent posting can double-apply a payment.
5. The repository has no automated unit, integration, API, browser, accessibility, or tenant-isolation test suite and no lint script.
6. CSV imports and multiple reporting/list routes perform broad in-memory work. Pagination and database-side tenant filtering are required for production-scale data.
7. External provider behavior cannot be certified without sandbox/live credentials, provider dashboards, webhook endpoints, HTTPS and representative tenant data.

## Repairs completed

- Production builds no longer execute `drizzle-kit push --force`. Schema deployment is now an explicit operational step, avoiding an unsafe and surprising database mutation during compilation.
- API request logging no longer serializes response bodies, preventing consumer, payment and credential data from being copied into application logs.
- Creating a pending payment validates positive integer cents and prevents overpayment. It no longer reduces the balance before posting, which previously allowed the same payment to be counted again by the posting workflow.
- Added a persistent, accessible connectivity notice that explicitly prevents users from treating cached application chrome as current account data.
- Corrected install marketing copy so it does not claim private account data is available offline.

## Readiness matrix

| Area | Status | Evidence / limitation |
|---|---|---|
| BUILD | READY | Production client and server bundles compile. Database deployment is intentionally separate. |
| TYPESCRIPT | READY | `tsc` passes. |
| AUTH | NEEDS FIX | Session cookies are secure in production and production requires a secret; no password reset, brute-force throttling, or automated expiration/RBAC tests. |
| TENANT ISOLATION | NEEDS FIX | Many ownership checks exist, but no RLS or comprehensive direct-API regression suite; broad in-memory filtering remains. |
| DASHBOARD | IMPLEMENTED — LIVE VERIFICATION REQUIRED | Queries and UI exist; totals require seeded/live reconciliation. |
| CONSUMERS / ACCOUNTS | IMPLEMENTED — LIVE VERIFICATION REQUIRED | CRUD/search/details exist; production-volume pagination and live workflow testing remain. |
| IMPORTS | IMPLEMENTED — LIVE VERIFICATION REQUIRED | CSV mapping/import exists; large-file, duplicate and malformed-data testing require a database. |
| PAYMENTS | BLOCKER | Pending-payment double counting was fixed, but stored raw payment credentials and non-transactional posting block production. |
| PAYMENT ARRANGEMENTS | IMPLEMENTED — LIVE VERIFICATION REQUIRED | Scheduled/recurring payment fields and runner exist; gateway declines and concurrency need sandbox tests. |
| SETTLEMENTS | NEEDS FIX | No complete consumer settlement workflow was identified. |
| EMAIL | IMPLEMENTED — LIVE VERIFICATION REQUIRED | Postmark settings/templates/campaign code exists; delivery, suppression and tenant tests require provider credentials. |
| SMS | NEEDS FIX | No complete inbound/outbound SMS provider, STOP/HELP, segment accounting and delivery-status workflow was identified. |
| DOCUMENTS | NEEDS FIX | No complete secure upload/download/e-signature workflow was identified. |
| CONSUMER PORTAL | BLOCKER | No complete consumer-authenticated self-service portal was identified. |
| REPORTING | IMPLEMENTED — LIVE VERIFICATION REQUIRED | Dashboards and exports exist; totals, date boundaries and tenant isolation need representative data. |
| ADMIN | NEEDS FIX | UI and routes exist, but server-side role enforcement is inconsistent. |
| MOBILE UI | IMPLEMENTED — LIVE VERIFICATION REQUIRED | Responsive utilities and scroll patterns exist; device/browser matrix was not available in this repository-only environment. |
| VISUAL DISTORTION | IMPLEMENTED — LIVE VERIFICATION REQUIRED | No compiler-visible layout defect; authenticated screens require browser QA at specified widths. |
| PWA MANIFEST | READY | Both manifests include names, IDs, start URLs, scope, standalone display, colors and existing 72–512px icons with maskable declarations. |
| PWA SERVICE WORKER | READY | Versioned worker avoids API caching, caches hashed assets, uses network-first navigation and preserves controlled activation. |
| PWA INSTALLABILITY | IMPLEMENTED — LIVE VERIFICATION REQUIRED | Required metadata/assets exist; HTTPS browser install criteria and iOS behavior need deployed testing. |
| PWA UPDATE FLOW | READY | Waiting updates produce a dismissible refresh prompt and activate only on user action. |
| PWA SECURITY | READY | API data is network-only and responses carry `no-store`; offline UI states that current account information requires reconnection. |
| PERFORMANCE | NEEDS FIX | All-tenant and unpaginated reads remain in multiple workflows. |
| SECURITY | BLOCKER | Payment-data storage, incomplete RBAC assurance and lack of isolation/security tests block production. |

## Environment configuration

### Required

- `DATABASE_URL`: PostgreSQL application and session database.
- `SESSION_SECRET`: high-entropy secret; startup correctly fails without it in production.
- `NODE_ENV=production`: enables secure cookies, proxy trust and production provider selection.

### Conditionally required

- `APP_BASE_URL`: canonical HTTPS URL for billing redirects (recommended in every deployment).
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: SaaS subscription billing.
- `POSTMARK_SERVER_TOKEN`: email when an organization-specific token is not configured.
- `AUTHORIZENET_API_LOGIN_ID` and `AUTHORIZENET_TRANSACTION_KEY`: legacy/global Authorize.Net configuration; organization merchant records are also supported.
- `PORT`: optional platform listen port; defaults to `5000`.
- `REPL_ID`: development-only Vite/Replit plugin selection.

No frontend `VITE_*` secret variables were identified. Merchant secrets stored in database records must never be exposed to client responses.

## Database migrations

No schema migration was added. The build-time forced schema push was removed. Apply reviewed migrations as a separate, backed-up deployment operation; never point development commands at production.

## Required live tests

1. Run two isolated tenant fixtures and attempt every resource ID from tenant A while authenticated as tenant B, including collectors, debtors, payments, instruments, imports, messages, reports and administration.
2. Exercise every actual role against direct API requests, particularly organization/user management, merchants, billing, imports, payment posting/reversal, reporting and automation settings.
3. Use each payment provider sandbox for approval, decline, timeout, duplicate submission, webhook replay, posting, reversal and recurring-payment failure. Confirm no PAN, CVV, bank number, token or secret reaches logs.
4. Reconcile original balance, pending amounts, processed amounts, posted amounts, reversals and final status under concurrent requests.
5. Test Postmark delivery/error/bounce behavior and campaign tenant isolation. Do not certify SMS, documents/e-signatures, settlements or a consumer portal until those systems are implemented.
6. Deploy over HTTPS and run Chromium installability/Lighthouse checks, Android install, Edge install and iOS Add to Home Screen. Test first load, authenticated relaunch, logout, offline launch, API failure and update during an unsaved/payment workflow.
7. Browser-test 320, 375, 390, 414, 768, 1024 and 1440+ pixel widths, including tables, navigation, dialogs, dashboards, imports, payment runner and administration; inspect console and network panels.

## Manual QA checklist

- Valid/invalid login, logout, idle expiration, disabled user and stale-role session.
- Dashboard empty/loading/error/retry and reconciliation against database totals.
- Consumer list search/filter/detail/history/notes and cross-tenant denial.
- CSV valid/bad/duplicate/large import with partial-failure reporting.
- Payment scheduling, decline, retry, post, receipt, reversal and duplicate-click behavior.
- Recurring schedule minimums, rounding, completion, broken promise and final payment.
- Email templates, campaign logging and provider failure.
- Reports date/timezone boundaries, exports and tenant scope.
- Keyboard navigation, visible focus, labels, modal focus/escape and non-color status cues.
- PWA icons/name/start routes, offline notice, no cached API/private documents and deferred update refresh.

## Launch verdict

**NOT READY**

The collection software **IS NOT ready for production use**. Exact blockers are: raw sensitive payment credentials in application storage/processing, non-transactional and non-idempotent payment posting, incomplete server-side role assurance, no automated tenant-isolation/security regression tests, and absent complete consumer portal/settlement/document/SMS workflows requested for launch. A controlled internal pilot using synthetic data may proceed only with payments disabled and strict network/access controls.
