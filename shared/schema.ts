import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Collectors (users who work accounts)
export const collectors = pgTable("collectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("collector"), // admin, manager, collector
  status: text("status").notNull().default("active"), // active, inactive, suspended
  avatarInitials: text("avatar_initials"),
  costPerSeat: integer("cost_per_seat").default(150),
});

export const insertCollectorSchema = createInsertSchema(collectors).omit({ id: true });
export type InsertCollector = z.infer<typeof insertCollectorSchema>;
export type Collector = typeof collectors.$inferSelect;

// Portfolios (groups of accounts purchased)
export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
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

// Debtors (accounts to collect)
export const debtors = pgTable("debtors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  assignedCollectorId: varchar("assigned_collector_id"),
  accountNumber: text("account_number").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  ssnLast4: text("ssn_last_4"),
  originalBalance: integer("original_balance").notNull(), // in cents
  currentBalance: integer("current_balance").notNull(), // in cents
  status: text("status").notNull().default("open"), // open, in_payment, settled, closed, disputed
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

// Payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  debtorId: varchar("debtor_id").notNull(),
  batchId: varchar("batch_id"),
  amount: integer("amount").notNull(), // in cents
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // ach, card, check, cash
  status: text("status").notNull().default("pending"), // pending, processed, failed, refunded
  referenceNumber: text("reference_number"),
  processedBy: varchar("processed_by"),
  notes: text("notes"),
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
