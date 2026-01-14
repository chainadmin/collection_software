# CollectMax Pro - Debt Collection Management Software

## Overview

CollectMax Pro is a professional debt collection management platform built for enterprise use. The application enables collection agencies to manage debtor accounts, process payments in batches, track portfolio performance, manage collector teams, and monitor liquidation rates across purchased debt portfolios.

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

### Key Domain Models
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