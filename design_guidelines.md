# Debt Collection Software Design Guidelines

## Design Approach: Enterprise Data Platform

**Selected Framework:** Carbon Design System principles - optimized for data-heavy enterprise applications requiring efficiency, clarity, and dense information display.

**Core Philosophy:** Professional, efficient interface prioritizing data visibility, quick navigation, and workflow optimization. Inspired by enterprise platforms like Salesforce, HubSpot CRM, and modern debt collection platforms.

---

## Layout System

**Spacing Scale:** Tailwind units of 2, 3, 4, 6, and 8 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: space-y-4 to space-y-6
- Dense data tables: p-2 to p-3

**Grid Structure:**
- Sidebar navigation: Fixed 64px (collapsed) / 240px (expanded)
- Main content area: Fluid with max-w-full
- Data tables: Full-width within container
- Form layouts: Two-column on desktop (grid-cols-2), single on mobile

---

## Typography Hierarchy

**Fonts:** Inter (primary), JetBrains Mono (data/numbers)

**Scale:**
- Page titles: text-2xl font-semibold
- Section headers: text-lg font-medium
- Data labels: text-sm font-medium uppercase tracking-wide
- Body/table text: text-sm
- Metadata/timestamps: text-xs
- Numbers/currency: text-sm font-mono

---

## Core Component Library

**Navigation:**
- Fixed left sidebar with collapsible sections
- Top bar: Account switcher, search, notifications, user menu
- Breadcrumbs for deep navigation paths

**Dashboard Components:**
- Stat cards: KPI metrics (collections today, active accounts, recovery rate)
- Activity feed: Recent collector actions
- Portfolio summary table
- Quick action buttons (Add Debtor, Run Payment, Generate Report)

**Debtor Profile View:**
- Header: Name, account status, balance owed, last contact
- Tabbed interface: Contact Info | Payment History | Notes | Documents | Bank Info
- Contact panel: Phone numbers with click-to-call, email, DOB, POE
- Timeline of interactions

**Data Tables:**
- Sortable columns with filter dropdowns
- Row actions menu (ellipsis icon)
- Inline editing for quick updates
- Pagination with rows-per-page selector
- Bulk action toolbar when rows selected

**Payment Runner:**
- Queue management interface
- Batch processing status indicators
- Real-time progress bars
- Success/failure summary cards

**Forms:**
- Grouped fields with clear labels
- Inline validation
- Required field indicators
- Submit/cancel actions in sticky footer

**Liquidation Page:**
- Portfolio performance metrics grid
- Liquidation calculator tool
- Historical data charts
- Export functionality

**Admin/Settings:**
- Collector seat management table (add/remove/assign)
- Cost-per-seat pricing display
- Portfolio assignment interface
- User permissions matrix

---

## Interactive Patterns

**No Animations:** Static interface for maximum performance with large datasets

**States:**
- Hover: Subtle row highlighting on tables
- Active/Selected: Distinct border/background
- Disabled: Reduced opacity
- Loading: Skeleton screens for tables, spinners for actions

**Modals:**
- Add/edit debtor forms
- Confirmation dialogs
- Document viewers
- Quick action panels

---

## Images

**No Hero Section:** This is an internal tool - users login directly to dashboard

**Supporting Images:**
- Empty state illustrations (when no data exists)
- User avatars/initials for collectors
- Document thumbnail previews in debtor profiles

---

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation for tables (arrow keys)
- Focus indicators on all inputs
- Screen reader announcements for status updates
- High contrast text for data readability