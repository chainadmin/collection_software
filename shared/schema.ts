import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Clients (creditors/companies who provide debt to collect)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  remittanceEmail: text("remittance_email"),
  remittanceFrequency: text("remittance_frequency").default("monthly"), // weekly, bi_weekly, monthly
  remittanceMethod: text("remittance_method").default("check"), // check, ach, wire
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdDate: text("created_date").notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Collectors (users who work accounts)
export const collectors = pgTable("collectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("collector"), // admin, manager, collector
  status: text("status").notNull().default("active"), // active, inactive, suspended
  avatarInitials: text("avatar_initials"),
  goal: integer("goal").default(0), // monthly collection goal in cents
  hourlyWage: integer("hourly_wage").default(0), // hourly wage in cents for profitability tracking
  // Role-based permissions
  canViewDashboard: boolean("can_view_dashboard").default(false),
  canViewEmail: boolean("can_view_email").default(false),
  canViewPaymentRunner: boolean("can_view_payment_runner").default(false),
});

export const insertCollectorSchema = createInsertSchema(collectors).omit({ id: true });
export type InsertCollector = z.infer<typeof insertCollectorSchema>;
export type Collector = typeof collectors.$inferSelect;

// Portfolios (groups of accounts purchased)
export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clientId: varchar("client_id"), // link to client
  feeScheduleId: varchar("fee_schedule_id"), // link to fee schedule
  purchaseDate: text("purchase_date").notNull(),
  purchasePrice: integer("purchase_price").notNull(), // in cents
  totalFaceValue: integer("total_face_value").notNull(), // in cents
  totalAccounts: integer("total_accounts").notNull(),
  status: text("status").notNull().default("active"), // active, closed, archived
  creditorName: text("creditor_name"),
  debtType: text("debt_type"), // credit_card, medical, auto, etc.
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({ id: true });
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;

// Portfolio Assignments (collector to portfolio)
export const portfolioAssignments = pgTable("portfolio_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  collectorId: varchar("collector_id").notNull(),
  assignedDate: text("assigned_date").notNull(),
});

export const insertPortfolioAssignmentSchema = createInsertSchema(portfolioAssignments).omit({ id: true });
export type InsertPortfolioAssignment = z.infer<typeof insertPortfolioAssignmentSchema>;
export type PortfolioAssignment = typeof portfolioAssignments.$inferSelect;

// Collection-specific statuses: newbiz, 1st_message, final, promise, payments_pending, decline
// Also supports: open, in_payment, settled, closed, disputed, bankruptcy, legal

// Debtors (accounts to collect)
export const debtors = pgTable("debtors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  assignedCollectorId: varchar("assigned_collector_id"),
  linkedAccountId: varchar("linked_account_id"), // links accounts for same person across portfolios (by SSN)
  fileNumber: text("file_number"), // unique tracking number for the account
  accountNumber: text("account_number").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  ssn: text("ssn"), // full SSN for display
  ssnLast4: text("ssn_last_4"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  originalCreditor: text("original_creditor"),
  clientName: text("client_name"),
  clientId: varchar("client_id"), // link to client for remittance tracking
  originalBalance: integer("original_balance").notNull(), // in cents
  currentBalance: integer("current_balance").notNull(), // in cents
  status: text("status").notNull().default("newbiz"), // newbiz, 1st_message, final, promise, payments_pending, decline, open, in_payment, settled, closed, disputed
  lastContactDate: text("last_contact_date"),
  nextFollowUpDate: text("next_follow_up_date"),
});

export const insertDebtorSchema = createInsertSchema(debtors).omit({ id: true });
export type InsertDebtor = z.infer<typeof insertDebtorSchema>;
export type Debtor = typeof debtors.$inferSelect;

// Debtor Contacts (phones, emails)
export const debtorContacts = pgTable("debtor_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  type: text("type").notNull(), // phone, email
  value: text("value").notNull(),
  label: text("label"), // home, work, mobile, etc.
  isPrimary: boolean("is_primary").default(false),
  isValid: boolean("is_valid").default(true),
  lastVerified: text("last_verified"),
});

export const insertDebtorContactSchema = createInsertSchema(debtorContacts).omit({ id: true });
export type InsertDebtorContact = z.infer<typeof insertDebtorContactSchema>;
export type DebtorContact = typeof debtorContacts.$inferSelect;

// Employment Records (POE - Place of Employment)
export const employmentRecords = pgTable("employment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  employerName: text("employer_name").notNull(),
  employerPhone: text("employer_phone"),
  employerAddress: text("employer_address"),
  position: text("position"),
  startDate: text("start_date"),
  salary: integer("salary"), // annual in cents
  isCurrent: boolean("is_current").default(true),
  verifiedDate: text("verified_date"),
});

export const insertEmploymentRecordSchema = createInsertSchema(employmentRecords).omit({ id: true });
export type InsertEmploymentRecord = z.infer<typeof insertEmploymentRecordSchema>;
export type EmploymentRecord = typeof employmentRecords.$inferSelect;

// Bank Accounts
export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  bankName: text("bank_name").notNull(),
  accountType: text("account_type").notNull(), // checking, savings
  routingNumber: text("routing_number"),
  accountNumberLast4: text("account_number_last_4"),
  isVerified: boolean("is_verified").default(false),
  verifiedDate: text("verified_date"),
});

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;

// Payment Cards (credit/debit cards on file)
export const paymentCards = pgTable("payment_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  cardType: text("card_type").notNull(), // visa, mastercard, amex, discover
  cardholderName: text("cardholder_name").notNull(),
  cardNumber: text("card_number").notNull(), // full card number
  cardNumberLast4: text("card_number_last_4").notNull(),
  expiryMonth: text("expiry_month").notNull(),
  expiryYear: text("expiry_year").notNull(),
  cvv: text("cvv"), // CVV code
  billingZip: text("billing_zip"),
  isDefault: boolean("is_default").default(false),
  addedDate: text("added_date").notNull(),
  addedBy: varchar("added_by"), // collector id who added the card
});

export const insertPaymentCardSchema = createInsertSchema(paymentCards).omit({ id: true });
export type InsertPaymentCard = z.infer<typeof insertPaymentCardSchema>;
export type PaymentCard = typeof paymentCards.$inferSelect;

// Payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  batchId: varchar("batch_id"),
  cardId: varchar("card_id"), // reference to payment card used
  amount: integer("amount").notNull(), // in cents
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // ach, card, check, cash
  status: text("status").notNull().default("pending"), // pending, processed, failed, refunded
  referenceNumber: text("reference_number"),
  processedBy: varchar("processed_by"),
  notes: text("notes"),
  // Recurring payment fields
  frequency: text("frequency"), // one_time, weekly, bi_weekly, monthly, specific_dates
  nextPaymentDate: text("next_payment_date"),
  specificDates: text("specific_dates"), // JSON array of dates for specific_dates frequency
  isRecurring: boolean("is_recurring").default(false),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Payment Batches (for payment runner)
export const paymentBatches = pgTable("payment_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdDate: text("created_date").notNull(),
  scheduledDate: text("scheduled_date"),
  status: text("status").notNull().default("draft"), // draft, queued, processing, completed, failed
  totalPayments: integer("total_payments").default(0),
  totalAmount: integer("total_amount").default(0), // in cents
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  processedDate: text("processed_date"),
});

export const insertPaymentBatchSchema = createInsertSchema(paymentBatches).omit({ id: true });
export type InsertPaymentBatch = z.infer<typeof insertPaymentBatchSchema>;
export type PaymentBatch = typeof paymentBatches.$inferSelect;

// Notes (on debtor accounts)
export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  collectorId: varchar("collector_id").notNull(),
  content: text("content").notNull(),
  noteType: text("note_type").notNull().default("general"), // general, call, promise, dispute, etc.
  createdDate: text("created_date").notNull(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

// Liquidation Snapshots (historical performance data)
export const liquidationSnapshots = pgTable("liquidation_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  totalCollected: integer("total_collected").notNull(), // in cents
  totalAccounts: integer("total_accounts").notNull(),
  accountsWorked: integer("accounts_worked").notNull(),
  liquidationRate: integer("liquidation_rate").notNull(), // basis points (e.g., 1500 = 15%)
});

export const insertLiquidationSnapshotSchema = createInsertSchema(liquidationSnapshots).omit({ id: true });
export type InsertLiquidationSnapshot = z.infer<typeof insertLiquidationSnapshotSchema>;
export type LiquidationSnapshot = typeof liquidationSnapshots.$inferSelect;

// Dashboard Stats (computed/cached values)
export interface DashboardStats {
  collectionsToday: number;
  collectionsThisMonth: number;
  activeAccounts: number;
  accountsInPayment: number;
  recoveryRate: number;
  avgCollectionAmount: number;
  totalPortfolioValue: number;
  totalCollected: number;
}

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// IP Whitelist for collector login security
export const ipWhitelist = pgTable("ip_whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: text("ip_address").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdDate: text("created_date").notNull(),
  createdBy: varchar("created_by"),
});

export const insertIpWhitelistSchema = createInsertSchema(ipWhitelist).omit({ id: true });
export type InsertIpWhitelist = z.infer<typeof insertIpWhitelistSchema>;
export type IpWhitelist = typeof ipWhitelist.$inferSelect;

// Merchants for payment processing
export const merchants = pgTable("merchants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  merchantId: text("merchant_id").notNull(),
  processorType: text("processor_type").notNull(), // nmi, usaepay, stripe, authorize_net
  isActive: boolean("is_active").default(true),
  apiKeyRef: text("api_key_ref"), // reference to secrets
  // NMI-specific fields
  nmiSecurityKey: text("nmi_security_key"),
  nmiUsername: text("nmi_username"),
  nmiPassword: text("nmi_password"),
  // USAePay-specific fields
  usaepaySourceKey: text("usaepay_source_key"),
  usaepayPin: text("usaepay_pin"),
  // General settings
  testMode: boolean("test_mode").default(true),
  createdDate: text("created_date").notNull(),
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({ id: true });
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchants.$inferSelect;

// Fee Schedules (created first, portfolios link to them)
export const feeSchedules = pgTable("fee_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  feeType: text("fee_type").notNull(), // contingency, flat_fee, hybrid
  feePercentage: integer("fee_percentage"), // basis points (e.g., 2500 = 25%)
  flatFeeAmount: integer("flat_fee_amount"), // in cents
  minimumFee: integer("minimum_fee"), // in cents
  isActive: boolean("is_active").default(true),
  effectiveDate: text("effective_date").notNull(),
  createdDate: text("created_date").notNull(),
});

export const insertFeeScheduleSchema = createInsertSchema(feeSchedules).omit({ id: true });
export type InsertFeeSchedule = z.infer<typeof insertFeeScheduleSchema>;
export type FeeSchedule = typeof feeSchedules.$inferSelect;

// Email Templates
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  templateType: text("template_type").notNull(), // collection, reminder, receipt, etc.
  isActive: boolean("is_active").default(true),
  createdDate: text("created_date").notNull(),
  updatedDate: text("updated_date"),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Email Settings
export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpSecure: boolean("smtp_secure").default(true),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  isActive: boolean("is_active").default(false),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({ id: true });
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

// Remittances (payments to clients/creditors)
export const remittances = pgTable("remittances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  clientName: text("client_name").notNull(),
  amount: integer("amount").notNull(), // in cents
  remittanceDate: text("remittance_date").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, confirmed
  checkNumber: text("check_number"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
});

export const insertRemittanceSchema = createInsertSchema(remittances).omit({ id: true });
export type InsertRemittance = z.infer<typeof insertRemittanceSchema>;
export type Remittance = typeof remittances.$inferSelect;

// Time Clock for collectors
export const timeClockEntries = pgTable("time_clock_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectorId: varchar("collector_id").notNull(),
  clockIn: text("clock_in").notNull(),
  clockOut: text("clock_out"),
  totalMinutes: integer("total_minutes"),
  notes: text("notes"),
});

export const insertTimeClockEntrySchema = createInsertSchema(timeClockEntries).omit({ id: true });
export type InsertTimeClockEntry = z.infer<typeof insertTimeClockEntrySchema>;
export type TimeClockEntry = typeof timeClockEntries.$inferSelect;

// Import Batches (for importing payments from external systems)
export const importBatches = pgTable("import_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  importType: text("import_type").notNull(), // payments, accounts, recalls
  status: text("status").notNull().default("pending"), // pending, validating, validated, committed, failed
  totalRecords: integer("total_records").default(0),
  successRecords: integer("success_records").default(0),
  failedRecords: integer("failed_records").default(0),
  mappingId: varchar("mapping_id"),
  createdDate: text("created_date").notNull(),
  createdBy: varchar("created_by"),
  processedDate: text("processed_date"),
  errorLog: text("error_log"),
});

export const insertImportBatchSchema = createInsertSchema(importBatches).omit({ id: true });
export type InsertImportBatch = z.infer<typeof insertImportBatchSchema>;
export type ImportBatch = typeof importBatches.$inferSelect;

// Import Mappings (field mapping templates)
export const importMappings = pgTable("import_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  importType: text("import_type").notNull(), // payments, accounts, recalls
  fieldMappings: text("field_mappings").notNull(), // JSON string of field mappings
  isDefault: boolean("is_default").default(false),
  createdDate: text("created_date").notNull(),
  createdBy: varchar("created_by"),
});

export const insertImportMappingSchema = createInsertSchema(importMappings).omit({ id: true });
export type InsertImportMapping = z.infer<typeof insertImportMappingSchema>;
export type ImportMapping = typeof importMappings.$inferSelect;

// Drop Batches (for dropping accounts to collectors)
export const dropBatches = pgTable("drop_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  portfolioId: varchar("portfolio_id"),
  totalAccounts: integer("total_accounts").default(0),
  status: text("status").notNull().default("pending"), // pending, processing, completed
  createdDate: text("created_date").notNull(),
  createdBy: varchar("created_by"),
  processedDate: text("processed_date"),
});

export const insertDropBatchSchema = createInsertSchema(dropBatches).omit({ id: true });
export type InsertDropBatch = z.infer<typeof insertDropBatchSchema>;
export type DropBatch = typeof dropBatches.$inferSelect;

// Drop Items (individual account assignments)
export const dropItems = pgTable("drop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dropBatchId: varchar("drop_batch_id").notNull(),
  debtorId: varchar("debtor_id").notNull(),
  collectorId: varchar("collector_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, assigned, worked
  assignedDate: text("assigned_date").notNull(),
});

export const insertDropItemSchema = createInsertSchema(dropItems).omit({ id: true });
export type InsertDropItem = z.infer<typeof insertDropItemSchema>;
export type DropItem = typeof dropItems.$inferSelect;

// Recall Batches (for recall accounts from clients)
export const recallBatches = pgTable("recall_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  portfolioId: varchar("portfolio_id"),
  clientName: text("client_name"),
  totalAccounts: integer("total_accounts").default(0),
  keeperCount: integer("keeper_count").default(0),
  recallCount: integer("recall_count").default(0),
  status: text("status").notNull().default("pending"), // pending, processing, completed
  createdDate: text("created_date").notNull(),
  processedDate: text("processed_date"),
});

export const insertRecallBatchSchema = createInsertSchema(recallBatches).omit({ id: true });
export type InsertRecallBatch = z.infer<typeof insertRecallBatchSchema>;
export type RecallBatch = typeof recallBatches.$inferSelect;

// Recall Items (individual account recall status)
export const recallItems = pgTable("recall_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recallBatchId: varchar("recall_batch_id").notNull(),
  debtorId: varchar("debtor_id").notNull(),
  isKeeper: boolean("is_keeper").default(false),
  recallReason: text("recall_reason"),
  keeperReason: text("keeper_reason"),
  processedDate: text("processed_date"),
});

export const insertRecallItemSchema = createInsertSchema(recallItems).omit({ id: true });
export type InsertRecallItem = z.infer<typeof insertRecallItemSchema>;
export type RecallItem = typeof recallItems.$inferSelect;

// Consolidation Companies
export const consolidationCompanies = pgTable("consolidation_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  isActive: boolean("is_active").default(true),
  createdDate: text("created_date").notNull(),
});

export const insertConsolidationCompanySchema = createInsertSchema(consolidationCompanies).omit({ id: true });
export type InsertConsolidationCompany = z.infer<typeof insertConsolidationCompanySchema>;
export type ConsolidationCompany = typeof consolidationCompanies.$inferSelect;

// Consolidation Cases (accounts linked to consolidation companies)
export const consolidationCases = pgTable("consolidation_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  consolidationCompanyId: varchar("consolidation_company_id").notNull(),
  caseNumber: text("case_number"),
  status: text("status").notNull().default("active"), // active, settled, cancelled
  monthlyPayment: integer("monthly_payment"), // in cents
  totalSettlementAmount: integer("total_settlement_amount"), // in cents
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  notes: text("notes"),
});

export const insertConsolidationCaseSchema = createInsertSchema(consolidationCases).omit({ id: true });
export type InsertConsolidationCase = z.infer<typeof insertConsolidationCaseSchema>;
export type ConsolidationCase = typeof consolidationCases.$inferSelect;

// Work Queue Items (collector's assigned work)
export const workQueueItems = pgTable("work_queue_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectorId: varchar("collector_id").notNull(),
  debtorId: varchar("debtor_id").notNull(),
  priority: integer("priority").default(0), // higher = more priority
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, skipped
  assignedDate: text("assigned_date").notNull(),
  workedDate: text("worked_date"),
  outcome: text("outcome"), // contact_made, no_answer, promise, payment, etc.
  notes: text("notes"),
});

export const insertWorkQueueItemSchema = createInsertSchema(workQueueItems).omit({ id: true });
export type InsertWorkQueueItem = z.infer<typeof insertWorkQueueItemSchema>;
export type WorkQueueItem = typeof workQueueItems.$inferSelect;

// Remittance Items (individual account payments for remittance)
export const remittanceItems = pgTable("remittance_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  remittanceId: varchar("remittance_id").notNull(),
  debtorId: varchar("debtor_id").notNull(),
  paymentId: varchar("payment_id").notNull(),
  amount: integer("amount").notNull(), // in cents
  status: text("status").notNull().default("posted"), // posted, declined, reversed
  declineReason: text("decline_reason"),
  reverseReason: text("reverse_reason"),
  processedDate: text("processed_date"),
});

export const insertRemittanceItemSchema = createInsertSchema(remittanceItems).omit({ id: true });
export type InsertRemittanceItem = z.infer<typeof insertRemittanceItemSchema>;
export type RemittanceItem = typeof remittanceItems.$inferSelect;
