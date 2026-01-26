# Debt Manager Pro - Debt Collection Management Software

## Overview

DebtFlow Pro is a professional debt collection management platform built for enterprise use. The application enables collection agencies to manage debtor accounts, process payments via merchant integrations (NMI and USAePay), track portfolio performance, manage collector teams, and monitor liquidation rates across purchased debt portfolios.

The system is designed as a data-heavy enterprise application following Carbon Design System principles, prioritizing efficiency, dense information display, and workflow optimization similar to platforms like Salesforce or HubSpot CRM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful JSON API under `/api/*` routes
- **Build System**: esbuild for server bundling, Vite for client bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Validation**: Drizzle-Zod for automatic schema-to-validation conversion
- **Storage Abstraction**: `server/storage.ts` provides an interface layer over database operations

### Multi-Organization Architecture
- **Organization Isolation**: Each collection agency operates as a separate organization with complete data isolation
- **Organization Table**: Contains company name, slug, address, timezone, and settings
- **Organization Scoping**: All data tables include organizationId foreign key for tenant isolation
- **Organization Context**: Frontend OrganizationProvider manages current organization state
- **Header-Based Routing**: X-Organization-Id header used for organization context in API requests
- **Default Organization**: Uses "default-org" ID for backward compatibility during migration

### Key Domain Models
- **Organizations**: Collection agencies with company details and settings
- **Collectors**: Staff members who work accounts (roles: admin, manager, collector)
- **Portfolios**: Groups of purchased debt accounts with face value and purchase price tracking
- **Debtors**: Individual accounts with contact info, employment, and bank account records
- **Payments**: Individual payment records organized into batches for processing
- **Payment Batches**: Groups of payments for bulk processing through the payment runner
- **Liquidation Snapshots**: Point-in-time performance metrics for portfolios

### Design Patterns
- **Monorepo Structure**: Client (`client/`), server (`server/`), and shared code (`shared/`) in one repository
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Component Composition**: UI built from composable shadcn/ui primitives
- **Collapsible Sidebar Navigation**: Fixed left sidebar with icon-only collapsed state

### Workstation Features
- **Click-to-Call**: Phone contacts are clickable, opening a Call Outcome dialog with options: Connected, No Answer, Voicemail, Busy, Wrong Number, Promise
- **Auto-Save Notes**: Notes auto-save after 3 seconds of inactivity with visual indicator
- **Payment Calculator**: Shows settlement options (50%, 40%, 25%) and monthly payment calculations
- **Work By Status Filter**: Filter accounts by collection status (newbiz, 1st message, final, promise, etc.)
- **Payment Recording**: Supports card selection from saved cards and payment frequency (one-time, weekly, bi-weekly, monthly, specific dates)
- **Inline Editing**: Edit icons for address, email, and contacts with dedicated edit dialogs
- **Bulk Add Features**: Bulk add contacts (phone/email) and bulk add notes with multi-line text input
- **Work Queue Logic**: Collectors only see their assigned accounts filtered by status
- **Comprehensive Search**: Search across all debtor data (name, account, phone, email, SSN, address, employer, references)

### Collector Management
- **Hourly Wage Tracking**: Required field for profitability analysis (replaces optional email)
- **Role-Based Permissions**: Checkboxes for Dashboard Access, Email/SMS Access, Payment Runner Access
- **Profitability Reports**: Collector reporting with wage cost vs. collections ROI analysis

### PWA Support
- **Desktop Installation**: Installable as PWA on Windows, Mac, and iOS
- **Manifest**: Located at `client/public/manifest.json`
- **Service Worker**: Located at `client/public/sw.js`

## External Dependencies

### Database
- **PostgreSQL**: Primary data store (connection via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations and schema push (`npm run db:push`)

### UI Framework Dependencies
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel component
- **cmdk**: Command palette component
- **Vaul**: Drawer component
- **react-day-picker**: Calendar/date picker

### Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **express-session**: Session middleware

### Build & Development
- **Vite**: Frontend dev server and bundler with HMR
- **esbuild**: Fast server-side TypeScript bundling
- **Replit plugins**: Development banner and cartographer for Replit environment

### Payment Runner Features
- **Batch Processing**: Process pending payments in batches through merchant gateways
- **Re-run Failed**: Re-run individual failed/declined payments with updated info
- **Run Single Payment**: Process individual payments outside of batch runs
- **Reverse Payments**: Reverse completed payments and auto-cancel future scheduled payments
- **Decline Notes**: Auto-add decline reasons to account notes when payments fail

### Import/Export Features
- **Flexible Partial Imports**: Import accounts, contacts, payments, notes independently
- **Upsert Logic**: Same portfolio/account updates existing; different portfolio/same SSN creates linked account
- **Cross-Portfolio Linking**: linkedAccountId field enables person linking via SSN across portfolios
- **Schema Mapping**: Save and reuse column mappings; clientId and portfolioId are mappable fields
- **Client/Portfolio Selection**: Required for accounts and contacts imports
- **Comprehensive Account Data**: Import includes multiple phones (1-5), emails (1-3), employment info, and up to 3 references with full address
- **Reference Support**: Personal/professional references with name, relationship, phone, address, and notes
- **Employment Import**: Employer name, phone, address, position, and salary
- **Legacy Compatibility**: Supports legacy phone/email fields for backward compatibility with old import formats

### Card Validation
- **BIN Lookup**: Client-side card validation using BIN database (no gateway authorization)
- **Issuer Detection**: Identifies card brand (Visa, Mastercard, Amex, Discover)
- **Luhn Validation**: Validates card number checksum
- **Real-time Feedback**: Visual indicators in workstation payment recording

### Remittance Reports
- **Portfolio/Client Filters**: Filter by specific client, portfolio, or date range
- **Payment Status**: Includes both "completed" and "processed" payment statuses
- **Per-Payment Breakdown**: Shows debtor details, account numbers, client/portfolio info
- **CSV Export**: Export filtered payment data for external reporting

### Recall Management
- **Recall Reasons**: "Recall" and "Monthly Payors" categorization
- **Flexible Filtering**: Filter by client only, portfolio only, or both combined
- **Batch Export**: Export recall lists with full account details