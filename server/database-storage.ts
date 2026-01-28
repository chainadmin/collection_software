import { db } from "./db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import {
  organizations,
  users,
  clients,
  collectors,
  globalAdmins,
  portfolios,
  portfolioAssignments,
  debtors,
  debtorContacts,
  employmentRecords,
  debtorReferences,
  bankAccounts,
  paymentCards,
  payments,
  paymentBatches,
  notes,
  liquidationSnapshots,
  merchants,
  feeSchedules,
  timeClockEntries,
  importBatches,
  importMappings,
  dropBatches,
  dropItems,
  recallBatches,
  recallItems,
  consolidationCompanies,
  consolidationCases,
  workQueueItems,
  remittances,
  remittanceItems,
  apiTokens,
  communicationAttempts,
  adminNotifications,
  type Organization,
  type InsertOrganization,
  type User,
  type InsertUser,
  type Client,
  type InsertClient,
  type Collector,
  type InsertCollector,
  type GlobalAdmin,
  type InsertGlobalAdmin,
  type Portfolio,
  type InsertPortfolio,
  type PortfolioAssignment,
  type InsertPortfolioAssignment,
  type Debtor,
  type InsertDebtor,
  type DebtorContact,
  type InsertDebtorContact,
  type EmploymentRecord,
  type InsertEmploymentRecord,
  type DebtorReference,
  type InsertDebtorReference,
  type BankAccount,
  type InsertBankAccount,
  type PaymentCard,
  type InsertPaymentCard,
  type Payment,
  type InsertPayment,
  type PaymentBatch,
  type InsertPaymentBatch,
  type Note,
  type InsertNote,
  type LiquidationSnapshot,
  type InsertLiquidationSnapshot,
  type DashboardStats,
  type Merchant,
  type InsertMerchant,
  type FeeSchedule,
  type InsertFeeSchedule,
  type TimeClockEntry,
  type InsertTimeClockEntry,
  type ImportBatch,
  type InsertImportBatch,
  type ImportMapping,
  type InsertImportMapping,
  type DropBatch,
  type InsertDropBatch,
  type DropItem,
  type InsertDropItem,
  type RecallBatch,
  type InsertRecallBatch,
  type RecallItem,
  type InsertRecallItem,
  type ConsolidationCompany,
  type InsertConsolidationCompany,
  type ConsolidationCase,
  type InsertConsolidationCase,
  type WorkQueueItem,
  type InsertWorkQueueItem,
  type Remittance,
  type InsertRemittance,
  type RemittanceItem,
  type InsertRemittanceItem,
  type ApiToken,
  type InsertApiToken,
  type CommunicationAttempt,
  type InsertCommunicationAttempt,
  type AdminNotification,
  type InsertAdminNotification,
} from "@shared/schema";
import type { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class DatabaseStorage implements IStorage {
  
  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const [created] = await db.insert(organizations).values({ ...org, id }).returning();
    return created;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db.update(organizations).set(org).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await db.delete(organizations).where(eq(organizations.id, id));
    return true;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const [created] = await db.insert(users).values({ ...user, id }).returning();
    return created;
  }

  // Clients
  async getClients(orgId?: string): Promise<Client[]> {
    if (orgId) {
      return await db.select().from(clients).where(eq(clients.organizationId, orgId));
    }
    return await db.select().from(clients);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = randomUUID();
    const [created] = await db.insert(clients).values({ ...client, id }).returning();
    return created;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set(client).where(eq(clients.id, id)).returning();
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    await db.delete(clients).where(eq(clients.id, id));
    return true;
  }

  // Fee Schedules
  async getFeeSchedules(): Promise<FeeSchedule[]> {
    return await db.select().from(feeSchedules);
  }

  async getFeeSchedule(id: string): Promise<FeeSchedule | undefined> {
    const [fs] = await db.select().from(feeSchedules).where(eq(feeSchedules.id, id));
    return fs;
  }

  async createFeeSchedule(feeSchedule: InsertFeeSchedule): Promise<FeeSchedule> {
    const id = randomUUID();
    const [created] = await db.insert(feeSchedules).values({ ...feeSchedule, id }).returning();
    return created;
  }

  async updateFeeSchedule(id: string, feeSchedule: Partial<InsertFeeSchedule>): Promise<FeeSchedule | undefined> {
    const [updated] = await db.update(feeSchedules).set(feeSchedule).where(eq(feeSchedules.id, id)).returning();
    return updated;
  }

  async deleteFeeSchedule(id: string): Promise<boolean> {
    await db.delete(feeSchedules).where(eq(feeSchedules.id, id));
    return true;
  }

  // Collectors
  async getCollectors(): Promise<Collector[]> {
    return await db.select().from(collectors);
  }

  async getCollector(id: string): Promise<Collector | undefined> {
    const [collector] = await db.select().from(collectors).where(eq(collectors.id, id));
    return collector;
  }

  async getCollectorByEmail(email: string): Promise<Collector | undefined> {
    const [collector] = await db.select().from(collectors).where(eq(collectors.email, email));
    return collector;
  }

  async createCollector(collector: InsertCollector): Promise<Collector> {
    const id = randomUUID();
    const [created] = await db.insert(collectors).values({ ...collector, id }).returning();
    return created;
  }

  async updateCollector(id: string, collector: Partial<InsertCollector>): Promise<Collector | undefined> {
    const [updated] = await db.update(collectors).set(collector).where(eq(collectors.id, id)).returning();
    return updated;
  }

  async deleteCollector(id: string): Promise<boolean> {
    await db.delete(collectors).where(eq(collectors.id, id));
    return true;
  }

  // Portfolios
  async getPortfolios(): Promise<Portfolio[]> {
    return await db.select().from(portfolios);
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, id));
    return portfolio;
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const [created] = await db.insert(portfolios).values({ ...portfolio, id }).returning();
    return created;
  }

  async updatePortfolio(id: string, portfolio: Partial<InsertPortfolio>): Promise<Portfolio | undefined> {
    const [updated] = await db.update(portfolios).set(portfolio).where(eq(portfolios.id, id)).returning();
    return updated;
  }

  async deletePortfolio(id: string): Promise<boolean> {
    await db.delete(portfolios).where(eq(portfolios.id, id));
    return true;
  }

  // Portfolio Assignments
  async getPortfolioAssignments(portfolioId?: string, collectorId?: string): Promise<PortfolioAssignment[]> {
    if (portfolioId && collectorId) {
      return await db.select().from(portfolioAssignments).where(
        and(eq(portfolioAssignments.portfolioId, portfolioId), eq(portfolioAssignments.collectorId, collectorId))
      );
    }
    if (portfolioId) {
      return await db.select().from(portfolioAssignments).where(eq(portfolioAssignments.portfolioId, portfolioId));
    }
    if (collectorId) {
      return await db.select().from(portfolioAssignments).where(eq(portfolioAssignments.collectorId, collectorId));
    }
    return await db.select().from(portfolioAssignments);
  }

  async createPortfolioAssignment(assignment: InsertPortfolioAssignment): Promise<PortfolioAssignment> {
    const id = randomUUID();
    const [created] = await db.insert(portfolioAssignments).values({ ...assignment, id }).returning();
    return created;
  }

  async deletePortfolioAssignment(id: string): Promise<boolean> {
    await db.delete(portfolioAssignments).where(eq(portfolioAssignments.id, id));
    return true;
  }

  // Debtors
  async getDebtors(portfolioId?: string, collectorId?: string): Promise<Debtor[]> {
    if (portfolioId && collectorId) {
      return await db.select().from(debtors).where(
        and(eq(debtors.portfolioId, portfolioId), eq(debtors.assignedCollectorId, collectorId))
      );
    }
    if (portfolioId) {
      return await db.select().from(debtors).where(eq(debtors.portfolioId, portfolioId));
    }
    if (collectorId) {
      return await db.select().from(debtors).where(eq(debtors.assignedCollectorId, collectorId));
    }
    return await db.select().from(debtors);
  }

  async getDebtor(id: string): Promise<Debtor | undefined> {
    const [debtor] = await db.select().from(debtors).where(eq(debtors.id, id));
    return debtor;
  }

  async getRecentDebtors(limit: number = 10): Promise<Debtor[]> {
    return await db.select().from(debtors).limit(limit);
  }

  async searchDebtors(query: string): Promise<Debtor[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(debtors).where(
      or(
        ilike(debtors.firstName, searchPattern),
        ilike(debtors.lastName, searchPattern),
        ilike(debtors.email, searchPattern),
        ilike(debtors.accountNumber, searchPattern),
        ilike(debtors.fileNumber, searchPattern),
        ilike(debtors.ssnLast4, searchPattern)
      )
    );
  }

  async createDebtor(debtor: InsertDebtor): Promise<Debtor> {
    const id = randomUUID();
    const [created] = await db.insert(debtors).values({ ...debtor, id }).returning();
    return created;
  }

  async updateDebtor(id: string, debtor: Partial<InsertDebtor>): Promise<Debtor | undefined> {
    const [updated] = await db.update(debtors).set(debtor).where(eq(debtors.id, id)).returning();
    return updated;
  }

  async deleteDebtor(id: string): Promise<boolean> {
    await db.delete(debtors).where(eq(debtors.id, id));
    return true;
  }

  // Debtor Contacts
  async getDebtorContacts(debtorId: string): Promise<DebtorContact[]> {
    return await db.select().from(debtorContacts).where(eq(debtorContacts.debtorId, debtorId));
  }

  async createDebtorContact(contact: InsertDebtorContact): Promise<DebtorContact> {
    const id = randomUUID();
    const [created] = await db.insert(debtorContacts).values({ ...contact, id }).returning();
    return created;
  }

  async updateDebtorContact(id: string, contact: Partial<InsertDebtorContact>): Promise<DebtorContact | undefined> {
    const [updated] = await db.update(debtorContacts).set(contact).where(eq(debtorContacts.id, id)).returning();
    return updated;
  }

  async deleteDebtorContact(id: string): Promise<boolean> {
    await db.delete(debtorContacts).where(eq(debtorContacts.id, id));
    return true;
  }

  // Employment Records
  async getEmploymentRecords(debtorId: string): Promise<EmploymentRecord[]> {
    return await db.select().from(employmentRecords).where(eq(employmentRecords.debtorId, debtorId));
  }

  async createEmploymentRecord(record: InsertEmploymentRecord): Promise<EmploymentRecord> {
    const id = randomUUID();
    const [created] = await db.insert(employmentRecords).values({ ...record, id }).returning();
    return created;
  }

  async updateEmploymentRecord(id: string, record: Partial<InsertEmploymentRecord>): Promise<EmploymentRecord | undefined> {
    const [updated] = await db.update(employmentRecords).set(record).where(eq(employmentRecords.id, id)).returning();
    return updated;
  }

  async deleteEmploymentRecord(id: string): Promise<boolean> {
    await db.delete(employmentRecords).where(eq(employmentRecords.id, id));
    return true;
  }

  // Debtor References
  async getDebtorReferences(debtorId: string): Promise<DebtorReference[]> {
    return await db.select().from(debtorReferences).where(eq(debtorReferences.debtorId, debtorId));
  }

  async createDebtorReference(reference: InsertDebtorReference): Promise<DebtorReference> {
    const id = randomUUID();
    const [created] = await db.insert(debtorReferences).values({ ...reference, id }).returning();
    return created;
  }

  async updateDebtorReference(id: string, reference: Partial<InsertDebtorReference>): Promise<DebtorReference | undefined> {
    const [updated] = await db.update(debtorReferences).set(reference).where(eq(debtorReferences.id, id)).returning();
    return updated;
  }

  async deleteDebtorReference(id: string): Promise<boolean> {
    await db.delete(debtorReferences).where(eq(debtorReferences.id, id));
    return true;
  }

  // Bank Accounts
  async getBankAccounts(debtorId: string): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts).where(eq(bankAccounts.debtorId, debtorId));
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const id = randomUUID();
    const [created] = await db.insert(bankAccounts).values({ ...account, id }).returning();
    return created;
  }

  async updateBankAccount(id: string, account: Partial<InsertBankAccount>): Promise<BankAccount | undefined> {
    const [updated] = await db.update(bankAccounts).set(account).where(eq(bankAccounts.id, id)).returning();
    return updated;
  }

  async deleteBankAccount(id: string): Promise<boolean> {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    return true;
  }

  // Payment Cards
  async getPaymentCards(debtorId: string): Promise<PaymentCard[]> {
    return await db.select().from(paymentCards).where(eq(paymentCards.debtorId, debtorId));
  }

  async getPaymentCard(id: string): Promise<PaymentCard | undefined> {
    const [card] = await db.select().from(paymentCards).where(eq(paymentCards.id, id));
    return card;
  }

  async createPaymentCard(card: InsertPaymentCard): Promise<PaymentCard> {
    const id = randomUUID();
    const [created] = await db.insert(paymentCards).values({ ...card, id }).returning();
    return created;
  }

  async updatePaymentCard(id: string, card: Partial<InsertPaymentCard>): Promise<PaymentCard | undefined> {
    const [updated] = await db.update(paymentCards).set(card).where(eq(paymentCards.id, id)).returning();
    return updated;
  }

  async deletePaymentCard(id: string): Promise<boolean> {
    await db.delete(paymentCards).where(eq(paymentCards.id, id));
    return true;
  }

  // Payments
  async getPayments(debtorId?: string, batchId?: string): Promise<Payment[]> {
    if (debtorId && batchId) {
      return await db.select().from(payments).where(
        and(eq(payments.debtorId, debtorId), eq(payments.batchId, batchId))
      );
    }
    if (debtorId) {
      return await db.select().from(payments).where(eq(payments.debtorId, debtorId));
    }
    if (batchId) {
      return await db.select().from(payments).where(eq(payments.batchId, batchId));
    }
    return await db.select().from(payments);
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db.select().from(payments);
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentsForDebtor(debtorId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.debtorId, debtorId));
  }

  async getRecentPayments(limit: number = 10): Promise<Payment[]> {
    return await db.select().from(payments).orderBy(desc(payments.paymentDate)).limit(limit);
  }

  async getPendingPayments(): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.status, "pending"));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const [created] = await db.insert(payments).values({ ...payment, id }).returning();
    return created;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updated] = await db.update(payments).set(payment).where(eq(payments.id, id)).returning();
    return updated;
  }

  // Payment Batches
  async getPaymentBatches(): Promise<PaymentBatch[]> {
    return await db.select().from(paymentBatches);
  }

  async getPaymentBatch(id: string): Promise<PaymentBatch | undefined> {
    const [batch] = await db.select().from(paymentBatches).where(eq(paymentBatches.id, id));
    return batch;
  }

  async createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch> {
    const id = randomUUID();
    const [created] = await db.insert(paymentBatches).values({ ...batch, id }).returning();
    return created;
  }

  async updatePaymentBatch(id: string, batch: Partial<InsertPaymentBatch>): Promise<PaymentBatch | undefined> {
    const [updated] = await db.update(paymentBatches).set(batch).where(eq(paymentBatches.id, id)).returning();
    return updated;
  }

  async addPaymentsToBatch(batchId: string, paymentIds: string[]): Promise<PaymentBatch | undefined> {
    for (const paymentId of paymentIds) {
      await db.update(payments).set({ batchId }).where(eq(payments.id, paymentId));
    }
    return this.getPaymentBatch(batchId);
  }

  // Notes
  async getNotes(debtorId: string): Promise<Note[]> {
    return await db.select().from(notes).where(eq(notes.debtorId, debtorId)).orderBy(desc(notes.createdDate));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const id = randomUUID();
    const [created] = await db.insert(notes).values({ ...note, id }).returning();
    return created;
  }

  // Liquidation Snapshots
  async getLiquidationSnapshots(portfolioId?: string): Promise<LiquidationSnapshot[]> {
    if (portfolioId) {
      return await db.select().from(liquidationSnapshots).where(eq(liquidationSnapshots.portfolioId, portfolioId));
    }
    return await db.select().from(liquidationSnapshots);
  }

  async createLiquidationSnapshot(snapshot: InsertLiquidationSnapshot): Promise<LiquidationSnapshot> {
    const id = randomUUID();
    const [created] = await db.insert(liquidationSnapshots).values({ ...snapshot, id }).returning();
    return created;
  }

  // Dashboard Stats
  async getDashboardStats(dateRange?: string): Promise<DashboardStats> {
    const allDebtors = await db.select().from(debtors);
    const allPayments = await db.select().from(payments);
    const allPortfolios = await db.select().from(portfolios);

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const completedPayments = allPayments.filter(p => p.status === 'processed' || p.status === 'completed');
    const todayPayments = completedPayments.filter(p => p.paymentDate === today);
    const monthPayments = completedPayments.filter(p => p.paymentDate && p.paymentDate >= monthStart);

    const collectionsToday = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const collectionsThisMonth = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const activeAccounts = allDebtors.filter(d => d.status === 'open' || d.status === 'active').length;
    const accountsInPayment = allDebtors.filter(d => d.status === 'in_payment').length;

    const totalOriginalBalance = allDebtors.reduce((sum, d) => sum + (d.originalBalance || 0), 0);
    const totalCollected = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const recoveryRate = totalOriginalBalance > 0 ? (totalCollected / totalOriginalBalance) * 100 : 0;
    const avgCollectionAmount = completedPayments.length > 0 ? totalCollected / completedPayments.length : 0;
    const totalPortfolioValue = allPortfolios.reduce((sum, p) => sum + (p.totalFaceValue || 0), 0);

    return {
      collectionsToday,
      collectionsThisMonth,
      activeAccounts,
      accountsInPayment,
      recoveryRate,
      avgCollectionAmount,
      totalPortfolioValue,
      totalCollected,
    };
  }

  // Merchants
  async getMerchants(organizationId?: string): Promise<Merchant[]> {
    if (organizationId) {
      return await db.select().from(merchants).where(eq(merchants.organizationId, organizationId));
    }
    return await db.select().from(merchants);
  }

  async getMerchant(id: string): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id));
    return merchant;
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const id = randomUUID();
    const [created] = await db.insert(merchants).values({ ...merchant, id }).returning();
    return created;
  }

  async updateMerchant(id: string, merchant: Partial<InsertMerchant>): Promise<Merchant | undefined> {
    const [updated] = await db.update(merchants).set(merchant).where(eq(merchants.id, id)).returning();
    return updated;
  }

  async deleteMerchant(id: string): Promise<boolean> {
    await db.delete(merchants).where(eq(merchants.id, id));
    return true;
  }

  // Time Clock
  async getTimeClockEntries(collectorId?: string, date?: string): Promise<TimeClockEntry[]> {
    if (collectorId && date) {
      return await db.select().from(timeClockEntries).where(
        and(eq(timeClockEntries.collectorId, collectorId), ilike(timeClockEntries.clockIn, `${date}%`))
      );
    }
    if (collectorId) {
      return await db.select().from(timeClockEntries).where(eq(timeClockEntries.collectorId, collectorId));
    }
    return await db.select().from(timeClockEntries);
  }

  async getActiveTimeClockEntry(collectorId: string): Promise<TimeClockEntry | undefined> {
    // Active entry = has clockIn but no clockOut
    const entries = await db.select().from(timeClockEntries).where(eq(timeClockEntries.collectorId, collectorId));
    return entries.find(e => e.clockIn && !e.clockOut);
  }

  async createTimeClockEntry(entry: InsertTimeClockEntry): Promise<TimeClockEntry> {
    const id = randomUUID();
    const [created] = await db.insert(timeClockEntries).values({ ...entry, id }).returning();
    return created;
  }

  async updateTimeClockEntry(id: string, entry: Partial<InsertTimeClockEntry>): Promise<TimeClockEntry | undefined> {
    const [updated] = await db.update(timeClockEntries).set(entry).where(eq(timeClockEntries.id, id)).returning();
    return updated;
  }

  // Import Batches
  async getImportBatches(): Promise<ImportBatch[]> {
    return await db.select().from(importBatches);
  }

  async getImportBatch(id: string): Promise<ImportBatch | undefined> {
    const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id));
    return batch;
  }

  async createImportBatch(batch: InsertImportBatch): Promise<ImportBatch> {
    const id = randomUUID();
    const [created] = await db.insert(importBatches).values({ ...batch, id }).returning();
    return created;
  }

  async updateImportBatch(id: string, batch: Partial<InsertImportBatch>): Promise<ImportBatch | undefined> {
    const [updated] = await db.update(importBatches).set(batch).where(eq(importBatches.id, id)).returning();
    return updated;
  }

  // Import Mappings
  async getImportMappings(importType?: string): Promise<ImportMapping[]> {
    if (importType) {
      return await db.select().from(importMappings).where(eq(importMappings.importType, importType));
    }
    return await db.select().from(importMappings);
  }

  async getImportMapping(id: string): Promise<ImportMapping | undefined> {
    const [mapping] = await db.select().from(importMappings).where(eq(importMappings.id, id));
    return mapping;
  }

  async createImportMapping(mapping: InsertImportMapping): Promise<ImportMapping> {
    const id = randomUUID();
    const [created] = await db.insert(importMappings).values({ ...mapping, id }).returning();
    return created;
  }

  async updateImportMapping(id: string, mapping: Partial<InsertImportMapping>): Promise<ImportMapping | undefined> {
    const [updated] = await db.update(importMappings).set(mapping).where(eq(importMappings.id, id)).returning();
    return updated;
  }

  async deleteImportMapping(id: string): Promise<boolean> {
    await db.delete(importMappings).where(eq(importMappings.id, id));
    return true;
  }

  // Drop Batches
  async getDropBatches(): Promise<DropBatch[]> {
    return await db.select().from(dropBatches);
  }

  async getDropBatch(id: string): Promise<DropBatch | undefined> {
    const [batch] = await db.select().from(dropBatches).where(eq(dropBatches.id, id));
    return batch;
  }

  async createDropBatch(batch: InsertDropBatch): Promise<DropBatch> {
    const id = randomUUID();
    const [created] = await db.insert(dropBatches).values({ ...batch, id }).returning();
    return created;
  }

  async updateDropBatch(id: string, batch: Partial<InsertDropBatch>): Promise<DropBatch | undefined> {
    const [updated] = await db.update(dropBatches).set(batch).where(eq(dropBatches.id, id)).returning();
    return updated;
  }

  // Drop Items
  async getDropItems(batchId?: string, collectorId?: string): Promise<DropItem[]> {
    if (batchId && collectorId) {
      return await db.select().from(dropItems).where(
        and(eq(dropItems.dropBatchId, batchId), eq(dropItems.collectorId, collectorId))
      );
    }
    if (batchId) {
      return await db.select().from(dropItems).where(eq(dropItems.dropBatchId, batchId));
    }
    return await db.select().from(dropItems);
  }

  async createDropItem(item: InsertDropItem): Promise<DropItem> {
    const id = randomUUID();
    const [created] = await db.insert(dropItems).values({ ...item, id }).returning();
    return created;
  }

  async updateDropItem(id: string, item: Partial<InsertDropItem>): Promise<DropItem | undefined> {
    const [updated] = await db.update(dropItems).set(item).where(eq(dropItems.id, id)).returning();
    return updated;
  }

  // Recall Batches
  async getRecallBatches(): Promise<RecallBatch[]> {
    return await db.select().from(recallBatches);
  }

  async getRecallBatch(id: string): Promise<RecallBatch | undefined> {
    const [batch] = await db.select().from(recallBatches).where(eq(recallBatches.id, id));
    return batch;
  }

  async createRecallBatch(batch: InsertRecallBatch): Promise<RecallBatch> {
    const id = randomUUID();
    const [created] = await db.insert(recallBatches).values({ ...batch, id }).returning();
    return created;
  }

  async updateRecallBatch(id: string, batch: Partial<InsertRecallBatch>): Promise<RecallBatch | undefined> {
    const [updated] = await db.update(recallBatches).set(batch).where(eq(recallBatches.id, id)).returning();
    return updated;
  }

  // Recall Items
  async getRecallItems(batchId: string): Promise<RecallItem[]> {
    return await db.select().from(recallItems).where(eq(recallItems.recallBatchId, batchId));
  }

  async createRecallItem(item: InsertRecallItem): Promise<RecallItem> {
    const id = randomUUID();
    const [created] = await db.insert(recallItems).values({ ...item, id }).returning();
    return created;
  }

  async updateRecallItem(id: string, item: Partial<InsertRecallItem>): Promise<RecallItem | undefined> {
    const [updated] = await db.update(recallItems).set(item).where(eq(recallItems.id, id)).returning();
    return updated;
  }

  // Consolidation Companies
  async getConsolidationCompanies(): Promise<ConsolidationCompany[]> {
    return await db.select().from(consolidationCompanies);
  }

  async getConsolidationCompany(id: string): Promise<ConsolidationCompany | undefined> {
    const [company] = await db.select().from(consolidationCompanies).where(eq(consolidationCompanies.id, id));
    return company;
  }

  async createConsolidationCompany(company: InsertConsolidationCompany): Promise<ConsolidationCompany> {
    const id = randomUUID();
    const [created] = await db.insert(consolidationCompanies).values({ ...company, id }).returning();
    return created;
  }

  async updateConsolidationCompany(id: string, company: Partial<InsertConsolidationCompany>): Promise<ConsolidationCompany | undefined> {
    const [updated] = await db.update(consolidationCompanies).set(company).where(eq(consolidationCompanies.id, id)).returning();
    return updated;
  }

  async deleteConsolidationCompany(id: string): Promise<boolean> {
    await db.delete(consolidationCompanies).where(eq(consolidationCompanies.id, id));
    return true;
  }

  // Consolidation Cases
  async getConsolidationCases(debtorId?: string, companyId?: string): Promise<ConsolidationCase[]> {
    if (debtorId && companyId) {
      return await db.select().from(consolidationCases).where(
        and(eq(consolidationCases.debtorId, debtorId), eq(consolidationCases.consolidationCompanyId, companyId))
      );
    }
    if (debtorId) {
      return await db.select().from(consolidationCases).where(eq(consolidationCases.debtorId, debtorId));
    }
    if (companyId) {
      return await db.select().from(consolidationCases).where(eq(consolidationCases.consolidationCompanyId, companyId));
    }
    return await db.select().from(consolidationCases);
  }

  async getConsolidationCase(id: string): Promise<ConsolidationCase | undefined> {
    const [caseData] = await db.select().from(consolidationCases).where(eq(consolidationCases.id, id));
    return caseData;
  }

  async createConsolidationCase(caseData: InsertConsolidationCase): Promise<ConsolidationCase> {
    const id = randomUUID();
    const [created] = await db.insert(consolidationCases).values({ ...caseData, id }).returning();
    return created;
  }

  async updateConsolidationCase(id: string, caseData: Partial<InsertConsolidationCase>): Promise<ConsolidationCase | undefined> {
    const [updated] = await db.update(consolidationCases).set(caseData).where(eq(consolidationCases.id, id)).returning();
    return updated;
  }

  // Work Queue
  async getWorkQueueItems(collectorId: string, status?: string): Promise<WorkQueueItem[]> {
    if (status) {
      return await db.select().from(workQueueItems).where(
        and(eq(workQueueItems.collectorId, collectorId), eq(workQueueItems.status, status))
      );
    }
    return await db.select().from(workQueueItems).where(eq(workQueueItems.collectorId, collectorId));
  }

  async getWorkQueueItem(id: string): Promise<WorkQueueItem | undefined> {
    const [item] = await db.select().from(workQueueItems).where(eq(workQueueItems.id, id));
    return item;
  }

  async createWorkQueueItem(item: InsertWorkQueueItem): Promise<WorkQueueItem> {
    const id = randomUUID();
    const [created] = await db.insert(workQueueItems).values({ ...item, id }).returning();
    return created;
  }

  async updateWorkQueueItem(id: string, item: Partial<InsertWorkQueueItem>): Promise<WorkQueueItem | undefined> {
    const [updated] = await db.update(workQueueItems).set(item).where(eq(workQueueItems.id, id)).returning();
    return updated;
  }

  async deleteWorkQueueItem(id: string): Promise<boolean> {
    await db.delete(workQueueItems).where(eq(workQueueItems.id, id));
    return true;
  }

  // Remittances
  async getRemittances(status?: string, portfolioId?: string): Promise<Remittance[]> {
    if (status && portfolioId) {
      return await db.select().from(remittances).where(
        and(eq(remittances.status, status), eq(remittances.portfolioId, portfolioId))
      );
    }
    if (status) {
      return await db.select().from(remittances).where(eq(remittances.status, status));
    }
    if (portfolioId) {
      return await db.select().from(remittances).where(eq(remittances.portfolioId, portfolioId));
    }
    return await db.select().from(remittances);
  }

  async getRemittance(id: string): Promise<Remittance | undefined> {
    const [remittance] = await db.select().from(remittances).where(eq(remittances.id, id));
    return remittance;
  }

  async createRemittance(remittance: InsertRemittance): Promise<Remittance> {
    const id = randomUUID();
    const [created] = await db.insert(remittances).values({ ...remittance, id }).returning();
    return created;
  }

  async updateRemittance(id: string, remittance: Partial<InsertRemittance>): Promise<Remittance | undefined> {
    const [updated] = await db.update(remittances).set(remittance).where(eq(remittances.id, id)).returning();
    return updated;
  }

  // Remittance Items
  async getRemittanceItems(remittanceId?: string, status?: string): Promise<RemittanceItem[]> {
    if (remittanceId && status) {
      return await db.select().from(remittanceItems).where(
        and(eq(remittanceItems.remittanceId, remittanceId), eq(remittanceItems.status, status))
      );
    }
    if (remittanceId) {
      return await db.select().from(remittanceItems).where(eq(remittanceItems.remittanceId, remittanceId));
    }
    if (status) {
      return await db.select().from(remittanceItems).where(eq(remittanceItems.status, status));
    }
    return await db.select().from(remittanceItems);
  }

  async createRemittanceItem(item: InsertRemittanceItem): Promise<RemittanceItem> {
    const id = randomUUID();
    const [created] = await db.insert(remittanceItems).values({ ...item, id }).returning();
    return created;
  }

  async updateRemittanceItem(id: string, item: Partial<InsertRemittanceItem>): Promise<RemittanceItem | undefined> {
    const [updated] = await db.update(remittanceItems).set(item).where(eq(remittanceItems.id, id)).returning();
    return updated;
  }

  // Payments by date
  async getPaymentsByDate(date: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.paymentDate, date));
  }

  // API Tokens
  async getApiTokens(): Promise<ApiToken[]> {
    return await db.select().from(apiTokens);
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    const [apiToken] = await db.select().from(apiTokens).where(eq(apiTokens.token, token));
    return apiToken;
  }

  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const id = randomUUID();
    const [created] = await db.insert(apiTokens).values({ ...token, id }).returning();
    return created;
  }

  async updateApiTokenLastUsed(id: string): Promise<void> {
    await db.update(apiTokens).set({ lastUsedDate: new Date().toISOString() }).where(eq(apiTokens.id, id));
  }

  async deleteApiToken(id: string): Promise<boolean> {
    await db.delete(apiTokens).where(eq(apiTokens.id, id));
    return true;
  }

  // Communication Attempts
  async getCommunicationAttempts(debtorId: string): Promise<CommunicationAttempt[]> {
    return await db.select().from(communicationAttempts).where(eq(communicationAttempts.debtorId, debtorId));
  }

  async createCommunicationAttempt(attempt: InsertCommunicationAttempt): Promise<CommunicationAttempt> {
    const id = randomUUID();
    const [created] = await db.insert(communicationAttempts).values({ ...attempt, id }).returning();
    return created;
  }

  // Helper methods for external API
  async getDebtorByFileNumber(fileNumber: string): Promise<Debtor | undefined> {
    const [debtor] = await db.select().from(debtors).where(eq(debtors.fileNumber, fileNumber));
    return debtor;
  }

  async getCollectorByUsername(username: string): Promise<Collector | undefined> {
    const [collector] = await db.select().from(collectors).where(eq(collectors.username, username));
    return collector;
  }

  // Global Admins
  async getGlobalAdmins(): Promise<GlobalAdmin[]> {
    return await db.select().from(globalAdmins);
  }

  async getGlobalAdmin(id: string): Promise<GlobalAdmin | undefined> {
    const [admin] = await db.select().from(globalAdmins).where(eq(globalAdmins.id, id));
    return admin;
  }

  async getGlobalAdminByEmail(email: string): Promise<GlobalAdmin | undefined> {
    const [admin] = await db.select().from(globalAdmins).where(eq(globalAdmins.email, email));
    return admin;
  }

  async getGlobalAdminByUsername(username: string): Promise<GlobalAdmin | undefined> {
    const [admin] = await db.select().from(globalAdmins).where(eq(globalAdmins.username, username));
    return admin;
  }

  async createGlobalAdmin(admin: InsertGlobalAdmin): Promise<GlobalAdmin> {
    const id = randomUUID();
    const [created] = await db.insert(globalAdmins).values({ ...admin, id }).returning();
    return created;
  }

  async updateGlobalAdmin(id: string, admin: Partial<InsertGlobalAdmin>): Promise<GlobalAdmin | undefined> {
    const [updated] = await db.update(globalAdmins).set(admin).where(eq(globalAdmins.id, id)).returning();
    return updated;
  }

  async deleteGlobalAdmin(id: string): Promise<boolean> {
    await db.delete(globalAdmins).where(eq(globalAdmins.id, id));
    return true;
  }

  // Admin Notifications
  async getAdminNotifications(): Promise<AdminNotification[]> {
    return await db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdDate));
  }

  async getUnreadAdminNotifications(): Promise<AdminNotification[]> {
    return await db.select().from(adminNotifications).where(eq(adminNotifications.isRead, false));
  }

  async createAdminNotification(notification: InsertAdminNotification): Promise<AdminNotification> {
    const id = randomUUID();
    const [created] = await db.insert(adminNotifications).values({ ...notification, id }).returning();
    return created;
  }

  async markAdminNotificationRead(id: string): Promise<AdminNotification | undefined> {
    const [updated] = await db.update(adminNotifications).set({ isRead: true }).where(eq(adminNotifications.id, id)).returning();
    return updated;
  }

  async markAllAdminNotificationsRead(): Promise<void> {
    await db.update(adminNotifications).set({ isRead: true });
  }
}
