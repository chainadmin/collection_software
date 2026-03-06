# Debt Manager Pro - Debt Collection Management Software

## Overview

DebtFlow Pro is an enterprise-grade debt collection management platform designed for collection agencies. It enables comprehensive management of debtor accounts, facilitates payment processing, tracks portfolio performance, manages collector teams, and monitors liquidation rates for purchased debt portfolios. The system emphasizes efficiency, dense information display, and optimized workflows, similar to leading CRM platforms. Its core purpose is to streamline debt collection processes, improve operational efficiency, and maximize liquidation rates for agencies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React and TypeScript, using Vite for bundling, Wouter for routing, and TanStack React Query for state management. UI components are from shadcn/ui (based on Radix UI), styled with Tailwind CSS (supporting light/dark modes). Forms are managed with React Hook Form and Zod for validation.

### Backend
The backend utilizes Node.js with Express and TypeScript (ESM modules), providing a RESTful JSON API. esbuild is used for server bundling.

### Data Layer
Drizzle ORM with PostgreSQL is used for data persistence, connecting via `@neondatabase/serverless`. Schema definitions are centralized, and Drizzle-Zod provides automatic validation. A storage abstraction layer manages database operations, and migrations run at server startup.

### Multi-Organization Architecture
The system supports multiple collection agencies, each operating with complete data isolation. Data tables include an `organizationId` for tenant isolation, and the frontend manages the current organization context. API requests use an `X-Organization-Id` header for organization context.

### Key Domain Models
Core models include Organizations, Collectors (with roles), Portfolios, Debtors (with contact, employment, bank info), Payments (individual and batched), and Liquidation Snapshots.

### Design Patterns
The project employs a monorepo structure with client, server, and shared code. UI is built from composable components, and navigation features a collapsible sidebar.

### Workstation Features
Key features include click-to-call functionality, auto-saving notes, a payment calculator, filtering by collection status, flexible payment recording (card/frequency), inline editing, and bulk actions. A comprehensive search covers all debtor data.

### Collector Management
The system supports hourly wage tracking for profitability analysis, role-based permissions (e.g., Dashboard Access, Payment Runner Access), and generates profitability reports comparing wage cost to collections ROI.

### PWA Support
The application is installable as a Progressive Web App (PWA) on desktop and iOS, utilizing a manifest and service worker. Two separate PWA manifests exist:
- **Admin App** (`manifest.json`): Full application starting at `/login` with email-based authentication
- **Collector App** (`manifest-collector.json`): Collector-only workstation starting at `/collector-login` with username+password authentication and IP restriction enforcement

### Dual Login System
The application has two separate login flows:
- **Admin Login** (`/login`): Email + password authentication for admins/managers. Full access to all features.
- **Collector Login** (`/collector-login`): Username + password authentication for collectors. IP-restricted per organization. Sets `appMode: "collector"` in localStorage which locks the UI to collector-only views (workstation, whiteboard, declines, liq rates). The collector install page (`/collector-install`) handles PWA installation with the collector-specific manifest.

### Public Signup Flow
New organizations receive a 14-day free trial without requiring a credit card. A multi-step signup process collects company information and allows plan selection. Subscription status is enforced server-side, redirecting users to a subscription page upon trial expiration.

### Payment Runner Features (Debt Collection)
The payment runner facilitates batch processing of pending debtor payments through the organization's own merchant accounts. It supports re-running failed payments, processing single payments, reversing completed payments (with gateway void and future payment cancellation), and automatically adding decline notes.

### Auto Payment Runner
The system includes an automatic payment runner (`server/auto-payment-runner.ts`) that processes pending payments twice daily at 7:00 AM and 6:00 PM Eastern time. Each organization has an `autoRunnerEnabled` toggle (default: off). The scheduler checks every 60 seconds, groups payments by organization, validates each org has the toggle enabled and an active merchant, then processes through the unified payment processor. Includes double-run guard, per-org result tracking, and manual trigger capability for admins.

### Unified Payment Processor
All payment processing (manual, batch, and auto) routes through `server/payment-processor.ts` — a single `processPayment()` function that:
1. Looks up the org's active merchant
2. Routes to the correct gateway based on `processorType`: Authorize.net, NMI (Direct Post API), or USAePay (REST API)
3. Handles card and ACH payment methods
4. Updates payment status and adds decline notes automatically
5. Enforces strict org isolation — each payment always uses its own org's merchant

### Organization Merchant Configuration
Each organization configures its own merchant account credentials (e.g., Authorize.net, NMI, USAePay) for processing debtor payments, with support for test mode.

### Import/Export Features
The system allows flexible partial imports for accounts, contacts, and payments. It features upsert logic for managing existing records, cross-portfolio linking via SSN, and schema mapping. Comprehensive account data, including multiple phones, emails, employment, and references, can be imported.

### Card Validation
Client-side card validation uses BIN lookup, issuer detection, and Luhn algorithm validation, providing real-time feedback during payment recording.

### Remittance Reports
Reports can be filtered by client, portfolio, or date range, showing per-payment breakdowns and allowing CSV export.

### Recall Management
Supports "Recall" and "Monthly Payors" categorization, flexible filtering, and batch export of recall lists with full account details.

### IP Whitelist Feature
Organizations can restrict collector login access by IP address:
- **Organization Setting**: `ipRestrictionEnabled` flag toggles enforcement
- **Whitelist Management**: CRUD operations via `/api/ip-whitelist` endpoints
- **CIDR Support**: Supports both exact IP matching (e.g., `192.168.1.100`) and CIDR notation (e.g., `192.168.1.0/24`)
- **IPv6 Normalization**: Automatically strips `::ffff:` prefix for IPv6-mapped IPv4 addresses
- **Empty Whitelist**: When restriction is enabled but whitelist is empty, all IPs are allowed
- **Multi-Tenant Isolation**: Each organization has its own isolated whitelist; cross-tenant access is prevented via organizationId validation on all CRUD operations
- **Frontend**: Managed via Admin Settings > Server Access page

### External API v2
A comprehensive external API is provided for integration with SMS platforms, soft phones, and dialers. It uses Bearer Token authentication with organization-scoped tokens. 

**Multi-Tenant Security**: All API endpoints enforce organization isolation:
- API tokens include the organizationId of the authenticated collector
- Tokens without organizationId are rejected with 403 (legacy tokens must re-authenticate)
- All endpoints validate organization ownership before returning or modifying data
- Defense-in-depth: Auth layer + endpoint-level validation

**Endpoints include**:
- Account management (get accounts by SSN, file number, portfolio)
- SMS/Email integration (send_text, send_email_c2c, record communication attempts)
- Data modification (adding notes, updating debtor fields, inserting payments)
- Softphone/Dialer functionalities:
  - GET /api/v2/softphone/queue - Call queue/worklist
  - POST /api/v2/softphone/initiate - Log outbound call
  - POST /api/v2/softphone/result - Log call outcome
  - POST /api/v2/softphone/disposition - Set disposition with status mapping
  - GET /api/v2/softphone/dispositions - Available disposition codes
  - GET /api/v2/softphone/account/:filenumber - Screen pop data
  - POST /api/v2/softphone/inbound - Inbound caller lookup
  - PUT /api/v2/softphone/markphone - Mark phone bad/wrong

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: For database migrations.

### UI Framework Dependencies
- **Radix UI**: Accessible component primitives.
- **Lucide React**: Icon library.
- **Embla Carousel**: Carousel component.
- **cmdk**: Command palette component.
- **Vaul**: Drawer component.
- **react-day-picker**: Calendar/date picker.

### Caching Strategy
- **Service Worker** (`client/public/sw.js`): Network-first for navigations and non-hashed assets, cache-first for Vite hashed assets (`/assets/*`). App shell pre-cached on install. Old caches purged on SW activation via version bump (`CACHE_NAME`).
- **Cache-Control Headers** (`server/static.ts`): Hashed assets get `max-age=1y, immutable`. HTML, `sw.js`, and `manifest.json` get `no-cache, must-revalidate`. API responses get `no-store`.
- **SW Registration** (`client/index.html`): Uses `updateViaCache: 'none'` to prevent browser from caching SW file. Auto-reloads once on SW update with loop guard via sessionStorage.

### Session Management
- **PgSessionStore** (`server/pg-session-store.ts`): Custom PostgreSQL session store using the shared pool from `server/db.ts`.
- **express-session**: Session middleware.

### Build & Development
- **Vite**: Frontend dev server and bundler.
- **esbuild**: Server-side TypeScript bundling.

### Organization Subscription Billing
- **Authorize.net**: Used *only* for billing organizations for their Debt Manager Pro subscription. Not used for debtor payments. Supports subscription plans and uses sandbox/production endpoints.

### Email Notifications (Super Admin)
- **Nodemailer**: Used to send SMTP-based email notifications from the super admin system account.
- Super admin configures SMTP settings (host, port, user, password, from email) via the Email Settings tab in the super admin dashboard.
- Settings are stored in the `email_settings` table with `organizationId = "system-super-admin"`.
- When a new organization signs up, an email notification is automatically sent to the configured notification email (default: support@chainsoftwaregroup.com).
- The password is never returned in API GET responses (only `hasPassword: boolean`).

### Debt Collection Merchant Gateways (Configured per organization)
- **Authorize.net**: Supported processor type for debtor payments.
- **NMI**: Supported processor type for debtor payments.
- **USAePay**: Supported processor type for debtor payments.