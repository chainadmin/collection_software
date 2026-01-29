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
The application is installable as a Progressive Web App (PWA) on desktop and iOS, utilizing a manifest and service worker.

### Public Signup Flow
New organizations receive a 14-day free trial without requiring a credit card. A multi-step signup process collects company information and allows plan selection. Subscription status is enforced server-side, redirecting users to a subscription page upon trial expiration.

### Payment Runner Features (Debt Collection)
The payment runner facilitates batch processing of pending debtor payments through the organization's own merchant accounts. It supports re-running failed payments, processing single payments, reversing completed payments (with gateway void and future payment cancellation), and automatically adding decline notes.

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

### Session Management
- **connect-pg-simple**: PostgreSQL session store.
- **express-session**: Session middleware.

### Build & Development
- **Vite**: Frontend dev server and bundler.
- **esbuild**: Server-side TypeScript bundling.

### Organization Subscription Billing
- **Authorize.net**: Used *only* for billing organizations for their Debt Manager Pro subscription. Not used for debtor payments. Supports subscription plans and uses sandbox/production endpoints.

### Debt Collection Merchant Gateways (Configured per organization)
- **Authorize.net**: Supported processor type for debtor payments.
- **NMI**: Supported processor type for debtor payments.
- **USAePay**: Supported processor type for debtor payments.