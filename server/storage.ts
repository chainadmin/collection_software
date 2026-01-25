import {
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type Client,
  type InsertClient,
  type Collector,
  type InsertCollector,
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
  type RemittanceItem,
  type InsertRemittanceItem,
  type Remittance,
  type InsertRemittance,
  type ApiToken,
  type InsertApiToken,
  type CommunicationAttempt,
  type InsertCommunicationAttempt,
} from "@shared/schema";
import { randomUUID } from "crypto";

// Default organization ID for existing data
const DEFAULT_ORG_ID = "default-org";

export interface IStorage {
  // Organizations
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;

  // Users (global - not organization scoped)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // All methods below are organization-scoped (orgId is optional for backward compatibility)
  getClients(orgId?: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

  getFeeSchedules(): Promise<FeeSchedule[]>;
  getFeeSchedule(id: string): Promise<FeeSchedule | undefined>;
  createFeeSchedule(feeSchedule: InsertFeeSchedule): Promise<FeeSchedule>;
  updateFeeSchedule(id: string, feeSchedule: Partial<InsertFeeSchedule>): Promise<FeeSchedule | undefined>;
  deleteFeeSchedule(id: string): Promise<boolean>;

  getCollectors(): Promise<Collector[]>;
  getCollector(id: string): Promise<Collector | undefined>;
  createCollector(collector: InsertCollector): Promise<Collector>;
  updateCollector(id: string, collector: Partial<InsertCollector>): Promise<Collector | undefined>;
  deleteCollector(id: string): Promise<boolean>;

  getPortfolios(): Promise<Portfolio[]>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: string, portfolio: Partial<InsertPortfolio>): Promise<Portfolio | undefined>;
  deletePortfolio(id: string): Promise<boolean>;

  getPortfolioAssignments(portfolioId?: string, collectorId?: string): Promise<PortfolioAssignment[]>;
  createPortfolioAssignment(assignment: InsertPortfolioAssignment): Promise<PortfolioAssignment>;
  deletePortfolioAssignment(id: string): Promise<boolean>;

  getDebtors(portfolioId?: string, collectorId?: string): Promise<Debtor[]>;
  getDebtor(id: string): Promise<Debtor | undefined>;
  getRecentDebtors(limit?: number): Promise<Debtor[]>;
  searchDebtors(query: string): Promise<Debtor[]>;
  createDebtor(debtor: InsertDebtor): Promise<Debtor>;
  updateDebtor(id: string, debtor: Partial<InsertDebtor>): Promise<Debtor | undefined>;
  deleteDebtor(id: string): Promise<boolean>;

  getDebtorContacts(debtorId: string): Promise<DebtorContact[]>;
  createDebtorContact(contact: InsertDebtorContact): Promise<DebtorContact>;
  updateDebtorContact(id: string, contact: Partial<InsertDebtorContact>): Promise<DebtorContact | undefined>;
  deleteDebtorContact(id: string): Promise<boolean>;

  getEmploymentRecords(debtorId: string): Promise<EmploymentRecord[]>;
  createEmploymentRecord(record: InsertEmploymentRecord): Promise<EmploymentRecord>;
  updateEmploymentRecord(id: string, record: Partial<InsertEmploymentRecord>): Promise<EmploymentRecord | undefined>;
  deleteEmploymentRecord(id: string): Promise<boolean>;

  getDebtorReferences(debtorId: string): Promise<DebtorReference[]>;
  createDebtorReference(reference: InsertDebtorReference): Promise<DebtorReference>;
  updateDebtorReference(id: string, reference: Partial<InsertDebtorReference>): Promise<DebtorReference | undefined>;
  deleteDebtorReference(id: string): Promise<boolean>;

  getBankAccounts(debtorId: string): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, account: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: string): Promise<boolean>;

  getPaymentCards(debtorId: string): Promise<PaymentCard[]>;
  createPaymentCard(card: InsertPaymentCard): Promise<PaymentCard>;
  updatePaymentCard(id: string, card: Partial<InsertPaymentCard>): Promise<PaymentCard | undefined>;
  deletePaymentCard(id: string): Promise<boolean>;

  getPayments(debtorId?: string, batchId?: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsForDebtor(debtorId: string): Promise<Payment[]>;
  getRecentPayments(limit?: number): Promise<Payment[]>;
  getPendingPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;

  getPaymentBatches(): Promise<PaymentBatch[]>;
  getPaymentBatch(id: string): Promise<PaymentBatch | undefined>;
  createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch>;
  updatePaymentBatch(id: string, batch: Partial<InsertPaymentBatch>): Promise<PaymentBatch | undefined>;
  addPaymentsToBatch(batchId: string, paymentIds: string[]): Promise<PaymentBatch | undefined>;

  getNotes(debtorId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  getLiquidationSnapshots(portfolioId?: string): Promise<LiquidationSnapshot[]>;
  createLiquidationSnapshot(snapshot: InsertLiquidationSnapshot): Promise<LiquidationSnapshot>;

  getDashboardStats(dateRange?: string): Promise<DashboardStats>;

  // Merchants
  getMerchants(): Promise<Merchant[]>;
  getMerchant(id: string): Promise<Merchant | undefined>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;
  updateMerchant(id: string, merchant: Partial<InsertMerchant>): Promise<Merchant | undefined>;
  deleteMerchant(id: string): Promise<boolean>;

  // Time Clock
  getTimeClockEntries(collectorId?: string, date?: string): Promise<TimeClockEntry[]>;
  getActiveTimeClockEntry(collectorId: string): Promise<TimeClockEntry | undefined>;
  createTimeClockEntry(entry: InsertTimeClockEntry): Promise<TimeClockEntry>;
  updateTimeClockEntry(id: string, entry: Partial<InsertTimeClockEntry>): Promise<TimeClockEntry | undefined>;

  // Import Batches
  getImportBatches(): Promise<ImportBatch[]>;
  getImportBatch(id: string): Promise<ImportBatch | undefined>;
  createImportBatch(batch: InsertImportBatch): Promise<ImportBatch>;
  updateImportBatch(id: string, batch: Partial<InsertImportBatch>): Promise<ImportBatch | undefined>;

  // Import Mappings
  getImportMappings(importType?: string): Promise<ImportMapping[]>;
  getImportMapping(id: string): Promise<ImportMapping | undefined>;
  createImportMapping(mapping: InsertImportMapping): Promise<ImportMapping>;
  updateImportMapping(id: string, mapping: Partial<InsertImportMapping>): Promise<ImportMapping | undefined>;
  deleteImportMapping(id: string): Promise<boolean>;

  // Drop Batches
  getDropBatches(): Promise<DropBatch[]>;
  getDropBatch(id: string): Promise<DropBatch | undefined>;
  createDropBatch(batch: InsertDropBatch): Promise<DropBatch>;
  updateDropBatch(id: string, batch: Partial<InsertDropBatch>): Promise<DropBatch | undefined>;

  // Drop Items
  getDropItems(batchId?: string, collectorId?: string): Promise<DropItem[]>;
  createDropItem(item: InsertDropItem): Promise<DropItem>;
  updateDropItem(id: string, item: Partial<InsertDropItem>): Promise<DropItem | undefined>;

  // Recall Batches
  getRecallBatches(): Promise<RecallBatch[]>;
  getRecallBatch(id: string): Promise<RecallBatch | undefined>;
  createRecallBatch(batch: InsertRecallBatch): Promise<RecallBatch>;
  updateRecallBatch(id: string, batch: Partial<InsertRecallBatch>): Promise<RecallBatch | undefined>;

  // Recall Items
  getRecallItems(batchId: string): Promise<RecallItem[]>;
  createRecallItem(item: InsertRecallItem): Promise<RecallItem>;
  updateRecallItem(id: string, item: Partial<InsertRecallItem>): Promise<RecallItem | undefined>;

  // Consolidation Companies
  getConsolidationCompanies(): Promise<ConsolidationCompany[]>;
  getConsolidationCompany(id: string): Promise<ConsolidationCompany | undefined>;
  createConsolidationCompany(company: InsertConsolidationCompany): Promise<ConsolidationCompany>;
  updateConsolidationCompany(id: string, company: Partial<InsertConsolidationCompany>): Promise<ConsolidationCompany | undefined>;
  deleteConsolidationCompany(id: string): Promise<boolean>;

  // Consolidation Cases
  getConsolidationCases(debtorId?: string, companyId?: string): Promise<ConsolidationCase[]>;
  getConsolidationCase(id: string): Promise<ConsolidationCase | undefined>;
  createConsolidationCase(caseData: InsertConsolidationCase): Promise<ConsolidationCase>;
  updateConsolidationCase(id: string, caseData: Partial<InsertConsolidationCase>): Promise<ConsolidationCase | undefined>;

  // Work Queue
  getWorkQueueItems(collectorId: string, status?: string): Promise<WorkQueueItem[]>;
  getWorkQueueItem(id: string): Promise<WorkQueueItem | undefined>;
  createWorkQueueItem(item: InsertWorkQueueItem): Promise<WorkQueueItem>;
  updateWorkQueueItem(id: string, item: Partial<InsertWorkQueueItem>): Promise<WorkQueueItem | undefined>;
  deleteWorkQueueItem(id: string): Promise<boolean>;

  // Remittances
  getRemittances(status?: string, portfolioId?: string): Promise<Remittance[]>;
  getRemittance(id: string): Promise<Remittance | undefined>;
  createRemittance(remittance: InsertRemittance): Promise<Remittance>;
  updateRemittance(id: string, remittance: Partial<InsertRemittance>): Promise<Remittance | undefined>;

  // Remittance Items
  getRemittanceItems(remittanceId?: string, status?: string): Promise<RemittanceItem[]>;
  createRemittanceItem(item: InsertRemittanceItem): Promise<RemittanceItem>;
  updateRemittanceItem(id: string, item: Partial<InsertRemittanceItem>): Promise<RemittanceItem | undefined>;

  // Payments by date
  getPaymentsByDate(date: string): Promise<Payment[]>;

  // API Tokens
  getApiTokens(): Promise<ApiToken[]>;
  getApiTokenByToken(token: string): Promise<ApiToken | undefined>;
  createApiToken(token: InsertApiToken): Promise<ApiToken>;
  updateApiTokenLastUsed(id: string): Promise<void>;
  deleteApiToken(id: string): Promise<boolean>;

  // Communication Attempts
  getCommunicationAttempts(debtorId: string): Promise<CommunicationAttempt[]>;
  createCommunicationAttempt(attempt: InsertCommunicationAttempt): Promise<CommunicationAttempt>;

  // Helper methods for external API
  getDebtorByFileNumber(fileNumber: string): Promise<Debtor | undefined>;
  getCollectorByUsername(username: string): Promise<Collector | undefined>;
}

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization>;
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private feeSchedules: Map<string, FeeSchedule>;
  private collectors: Map<string, Collector>;
  private portfolios: Map<string, Portfolio>;
  private portfolioAssignments: Map<string, PortfolioAssignment>;
  private debtors: Map<string, Debtor>;
  private debtorContacts: Map<string, DebtorContact>;
  private employmentRecords: Map<string, EmploymentRecord>;
  private debtorReferences: Map<string, DebtorReference>;
  private bankAccounts: Map<string, BankAccount>;
  private paymentCards: Map<string, PaymentCard>;
  private payments: Map<string, Payment>;
  private paymentBatches: Map<string, PaymentBatch>;
  private notes: Map<string, Note>;
  private liquidationSnapshots: Map<string, LiquidationSnapshot>;
  private merchants: Map<string, Merchant>;
  private timeClockEntries: Map<string, TimeClockEntry>;
  private importBatches: Map<string, ImportBatch>;
  private importMappings: Map<string, ImportMapping>;
  private dropBatches: Map<string, DropBatch>;
  private dropItems: Map<string, DropItem>;
  private recallBatches: Map<string, RecallBatch>;
  private recallItems: Map<string, RecallItem>;
  private consolidationCompanies: Map<string, ConsolidationCompany>;
  private consolidationCases: Map<string, ConsolidationCase>;
  private workQueueItems: Map<string, WorkQueueItem>;
  private remittances: Map<string, Remittance>;
  private remittanceItems: Map<string, RemittanceItem>;
  private apiTokens: Map<string, ApiToken>;
  private communicationAttempts: Map<string, CommunicationAttempt>;

  constructor() {
    this.organizations = new Map();
    this.users = new Map();
    this.clients = new Map();
    this.feeSchedules = new Map();
    this.collectors = new Map();
    this.portfolios = new Map();
    this.portfolioAssignments = new Map();
    this.debtors = new Map();
    this.debtorContacts = new Map();
    this.employmentRecords = new Map();
    this.debtorReferences = new Map();
    this.bankAccounts = new Map();
    this.paymentCards = new Map();
    this.payments = new Map();
    this.paymentBatches = new Map();
    this.notes = new Map();
    this.liquidationSnapshots = new Map();
    this.merchants = new Map();
    this.timeClockEntries = new Map();
    this.importBatches = new Map();
    this.importMappings = new Map();
    this.dropBatches = new Map();
    this.dropItems = new Map();
    this.recallBatches = new Map();
    this.recallItems = new Map();
    this.consolidationCompanies = new Map();
    this.consolidationCases = new Map();
    this.workQueueItems = new Map();
    this.remittances = new Map();
    this.remittanceItems = new Map();
    this.apiTokens = new Map();
    this.communicationAttempts = new Map();
    this.seedData();
  }

  private seedData() {
    // Create default organization
    this.organizations.set(DEFAULT_ORG_ID, {
      id: DEFAULT_ORG_ID,
      name: "CollectMax Agency",
      slug: "collectmax",
      address: "123 Main Street",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      phone: "(512) 555-0100",
      email: "admin@collectmax.com",
      website: "https://collectmax.com",
      timezone: "America/Chicago",
      isActive: true,
      createdDate: new Date().toISOString(),
      settings: null,
    });

    const collector1Id = randomUUID();
    const collector2Id = randomUUID();
    const collector3Id = randomUUID();
    
    this.collectors.set(collector1Id, {
      id: collector1Id,
      organizationId: DEFAULT_ORG_ID,
      name: "Sarah Johnson",
      email: "sarah.johnson@collectmax.com",
      username: "sjohnson",
      password: "password123",
      role: "manager",
      status: "active",
      avatarInitials: "SJ",
      goal: 5000000,
      hourlyWage: 2500,
      canViewDashboard: true,
      canViewEmail: true,
      canViewPaymentRunner: true,
    });
    this.collectors.set(collector2Id, {
      id: collector2Id,
      organizationId: DEFAULT_ORG_ID,
      name: "Michael Chen",
      email: "michael.chen@collectmax.com",
      username: "mchen",
      password: "password123",
      role: "collector",
      status: "active",
      avatarInitials: "MC",
      goal: 2500000,
      hourlyWage: 1800,
      canViewDashboard: false,
      canViewEmail: true,
      canViewPaymentRunner: false,
    });
    this.collectors.set(collector3Id, {
      id: collector3Id,
      organizationId: DEFAULT_ORG_ID,
      name: "Emily Rodriguez",
      email: "emily.rodriguez@collectmax.com",
      username: "erodriguez",
      password: "password123",
      role: "collector",
      status: "active",
      avatarInitials: "ER",
      goal: 2500000,
      hourlyWage: 1800,
      canViewDashboard: false,
      canViewEmail: true,
      canViewPaymentRunner: false,
    });

    const portfolio1Id = randomUUID();
    const portfolio2Id = randomUUID();
    const portfolio3Id = randomUUID();

    this.portfolios.set(portfolio1Id, {
      id: portfolio1Id,
      organizationId: DEFAULT_ORG_ID,
      name: "Chase Q4 2024",
      clientId: null,
      feeScheduleId: null,
      purchaseDate: "2024-10-15",
      purchasePrice: 50000000,
      totalFaceValue: 250000000,
      totalAccounts: 1250,
      status: "active",
      creditorName: "Chase Bank",
      debtType: "credit_card",
    });
    this.portfolios.set(portfolio2Id, {
      id: portfolio2Id,
      organizationId: DEFAULT_ORG_ID,
      name: "Capital One Medical",
      clientId: null,
      feeScheduleId: null,
      purchaseDate: "2024-09-01",
      purchasePrice: 25000000,
      totalFaceValue: 175000000,
      totalAccounts: 890,
      status: "active",
      creditorName: "Capital One",
      debtType: "medical",
    });
    this.portfolios.set(portfolio3Id, {
      id: portfolio3Id,
      organizationId: DEFAULT_ORG_ID,
      name: "Auto Loan Portfolio A",
      clientId: null,
      feeScheduleId: null,
      purchaseDate: "2024-08-20",
      purchasePrice: 100000000,
      totalFaceValue: 350000000,
      totalAccounts: 2100,
      status: "active",
      creditorName: "Ford Motor Credit",
      debtType: "auto",
    });

    const debtor1Id = randomUUID();
    const debtor2Id = randomUUID();
    const debtor3Id = randomUUID();
    const debtor4Id = randomUUID();
    const debtor5Id = randomUUID();

    this.debtors.set(debtor1Id, {
      id: debtor1Id,
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio1Id,
      assignedCollectorId: collector2Id,
      linkedAccountId: null,
      fileNumber: "FILE-2024-001001",
      accountNumber: "ACC-2024-00001",
      firstName: "Robert",
      lastName: "Williams",
      dateOfBirth: "1985-03-15",
      ssn: "123-45-4532",
      ssnLast4: "4532",
      email: "robert.williams@email.com",
      address: "456 Oak Street",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      originalCreditor: "Chase Bank",
      clientName: "Chase Financial Recovery",
      clientId: null,
      originalBalance: 1245000,
      currentBalance: 1089500,
      status: "open",
      lastContactDate: "2024-12-10",
      nextFollowUpDate: "2024-12-20",
    });
    this.debtors.set(debtor2Id, {
      id: debtor2Id,
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio1Id,
      assignedCollectorId: collector2Id,
      linkedAccountId: null,
      fileNumber: "FILE-2024-001002",
      accountNumber: "ACC-2024-00002",
      firstName: "Jennifer",
      lastName: "Martinez",
      dateOfBirth: "1978-07-22",
      ssn: "234-56-8891",
      ssnLast4: "8891",
      email: "jennifer.martinez@email.com",
      address: "789 Elm Avenue",
      city: "Houston",
      state: "TX",
      zipCode: "77001",
      originalCreditor: "Chase Bank",
      clientName: "Chase Financial Recovery",
      clientId: null,
      originalBalance: 875000,
      currentBalance: 450000,
      status: "in_payment",
      lastContactDate: "2024-12-15",
      nextFollowUpDate: "2025-01-15",
    });
    this.debtors.set(debtor3Id, {
      id: debtor3Id,
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio2Id,
      assignedCollectorId: collector3Id,
      linkedAccountId: null,
      fileNumber: "FILE-2024-001003",
      accountNumber: "ACC-2024-00003",
      firstName: "David",
      lastName: "Thompson",
      dateOfBirth: "1990-11-08",
      ssn: "345-67-2267",
      ssnLast4: "2267",
      email: "david.thompson@email.com",
      address: "123 Medical Center Blvd",
      city: "Dallas",
      state: "TX",
      zipCode: "75201",
      originalCreditor: "Capital One Medical",
      clientName: "CapOne Recovery Services",
      clientId: null,
      originalBalance: 325000,
      currentBalance: 325000,
      status: "disputed",
      lastContactDate: "2024-11-28",
      nextFollowUpDate: null,
    });
    this.debtors.set(debtor4Id, {
      id: debtor4Id,
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio3Id,
      assignedCollectorId: collector1Id,
      linkedAccountId: null,
      fileNumber: "FILE-2024-001004",
      accountNumber: "ACC-2024-00004",
      firstName: "Amanda",
      lastName: "Brown",
      dateOfBirth: "1982-05-30",
      ssn: "456-78-7743",
      ssnLast4: "7743",
      email: "amanda.brown@email.com",
      address: "321 Ford Lane",
      city: "San Antonio",
      state: "TX",
      zipCode: "78201",
      originalCreditor: "Ford Motor Credit",
      clientName: "Ford Credit Recovery",
      clientId: null,
      originalBalance: 4567800,
      currentBalance: 3890000,
      status: "open",
      lastContactDate: "2024-12-12",
      nextFollowUpDate: "2024-12-18",
    });
    this.debtors.set(debtor5Id, {
      id: debtor5Id,
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio1Id,
      assignedCollectorId: collector2Id,
      linkedAccountId: null,
      fileNumber: "FILE-2024-001005",
      accountNumber: "ACC-2024-00005",
      firstName: "Christopher",
      lastName: "Davis",
      dateOfBirth: "1975-09-14",
      ssn: "567-89-1156",
      ssnLast4: "1156",
      email: "chris.davis@email.com",
      address: "555 Main Street",
      city: "Fort Worth",
      state: "TX",
      zipCode: "76101",
      originalCreditor: "Chase Bank",
      clientName: "Chase Financial Recovery",
      clientId: null,
      originalBalance: 2150000,
      currentBalance: 0,
      status: "settled",
      lastContactDate: "2024-12-01",
      nextFollowUpDate: null,
    });

    this.debtorContacts.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      type: "phone",
      value: "5551234567",
      label: "mobile",
      isPrimary: true,
      isValid: true,
      lastVerified: "2024-12-10",
    });
    this.debtorContacts.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      type: "phone",
      value: "5559876543",
      label: "home",
      isPrimary: false,
      isValid: true,
      lastVerified: "2024-11-15",
    });
    this.debtorContacts.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      type: "email",
      value: "robert.williams@email.com",
      label: "personal",
      isPrimary: true,
      isValid: true,
      lastVerified: "2024-12-10",
    });
    this.debtorContacts.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor2Id,
      type: "phone",
      value: "5552223333",
      label: "mobile",
      isPrimary: true,
      isValid: true,
      lastVerified: "2024-12-15",
    });

    this.employmentRecords.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      employerName: "TechCorp Industries",
      employerPhone: "5555550100",
      employerAddress: "123 Business Blvd, Suite 500, Austin, TX 78701",
      position: "Software Engineer",
      startDate: "2019-06-01",
      salary: 9500000,
      isCurrent: true,
      verifiedDate: "2024-11-20",
    });
    this.employmentRecords.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor2Id,
      employerName: "Healthcare Plus",
      employerPhone: "5555550200",
      employerAddress: "456 Medical Center Dr, Houston, TX 77001",
      position: "Registered Nurse",
      startDate: "2015-03-15",
      salary: 7200000,
      isCurrent: true,
      verifiedDate: "2024-12-01",
    });

    this.bankAccounts.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      bankName: "Bank of America",
      accountType: "checking",
      routingNumber: "026009593",
      accountNumberLast4: "4521",
      isVerified: true,
      verifiedDate: "2024-12-05",
    });
    this.bankAccounts.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      bankName: "Chase Bank",
      accountType: "savings",
      routingNumber: "021000021",
      accountNumberLast4: "8834",
      isVerified: false,
      verifiedDate: null,
    });

    const payment1Id = randomUUID();
    const payment2Id = randomUUID();
    const payment3Id = randomUUID();
    const payment4Id = randomUUID();

    this.payments.set(payment1Id, {
      id: payment1Id,
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor2Id,
      batchId: null,
      amount: 15000,
      paymentDate: "2024-12-15",
      paymentMethod: "ach",
      status: "processed",
      referenceNumber: "PAY-2024-001234",
      processedBy: collector2Id,
      notes: "Monthly payment plan",
      cardId: null,
      frequency: "monthly",
      nextPaymentDate: "2025-01-15",
      specificDates: null,
      isRecurring: true,
    });
    this.payments.set(payment2Id, {
      id: payment2Id,
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor5Id,
      batchId: null,
      amount: 2150000,
      paymentDate: "2024-12-01",
      paymentMethod: "ach",
      status: "processed",
      referenceNumber: "PAY-2024-001100",
      processedBy: collector2Id,
      notes: "Settlement in full",
      cardId: null,
      frequency: "one_time",
      nextPaymentDate: null,
      specificDates: null,
      isRecurring: false,
    });
    this.payments.set(payment3Id, {
      id: payment3Id,
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      batchId: null,
      amount: 155500,
      paymentDate: "2024-12-10",
      paymentMethod: "card",
      status: "processed",
      referenceNumber: "PAY-2024-001189",
      processedBy: collector2Id,
      notes: null,
      cardId: null,
      frequency: "one_time",
      nextPaymentDate: null,
      specificDates: null,
      isRecurring: false,
    });
    this.payments.set(payment4Id, {
      id: payment4Id,
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor4Id,
      batchId: null,
      amount: 50000,
      paymentDate: "2024-12-12",
      paymentMethod: "check",
      status: "pending",
      referenceNumber: "PAY-2024-001201",
      processedBy: collector1Id,
      notes: "Check #4521",
      cardId: null,
      frequency: "one_time",
      nextPaymentDate: null,
      specificDates: null,
      isRecurring: false,
    });

    const batch1Id = randomUUID();
    const batch2Id = randomUUID();

    this.paymentBatches.set(batch1Id, {
      id: batch1Id,
      organizationId: DEFAULT_ORG_ID,
      name: "December ACH Batch 1",
      createdBy: collector1Id,
      createdDate: "2024-12-01",
      scheduledDate: "2024-12-05",
      status: "completed",
      totalPayments: 45,
      totalAmount: 8750000,
      successCount: 42,
      failedCount: 3,
      processedDate: "2024-12-05",
    });
    this.paymentBatches.set(batch2Id, {
      id: batch2Id,
      organizationId: DEFAULT_ORG_ID,
      name: "December Card Batch",
      createdBy: collector1Id,
      createdDate: "2024-12-10",
      scheduledDate: "2024-12-15",
      status: "queued",
      totalPayments: 28,
      totalAmount: 4250000,
      successCount: 0,
      failedCount: 0,
      processedDate: null,
    });

    this.notes.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      collectorId: collector2Id,
      content: "Debtor agreed to make a payment of $1,555 on 12/10. Will follow up next week.",
      noteType: "call",
      createdDate: "2024-12-09",
    });
    this.notes.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor1Id,
      collectorId: collector2Id,
      content: "Payment received as promised. Debtor is cooperative and willing to set up payment plan.",
      noteType: "general",
      createdDate: "2024-12-10",
    });
    this.notes.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      debtorId: debtor3Id,
      collectorId: collector3Id,
      content: "Debtor is disputing the debt. Claims balance was already paid to original creditor. Requesting validation.",
      noteType: "dispute",
      createdDate: "2024-11-28",
    });

    this.liquidationSnapshots.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio1Id,
      snapshotDate: "2024-12-01",
      totalCollected: 12500000,
      totalAccounts: 1250,
      accountsWorked: 890,
      liquidationRate: 500,
    });
    this.liquidationSnapshots.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio2Id,
      snapshotDate: "2024-12-01",
      totalCollected: 8750000,
      totalAccounts: 890,
      accountsWorked: 650,
      liquidationRate: 500,
    });
    this.liquidationSnapshots.set(randomUUID(), {
      id: randomUUID(),
      organizationId: DEFAULT_ORG_ID,
      portfolioId: portfolio3Id,
      snapshotDate: "2024-12-01",
      totalCollected: 21000000,
      totalAccounts: 2100,
      accountsWorked: 1500,
      liquidationRate: 600,
    });
  }

  // Organization CRUD methods
  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(o => o.slug === slug);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const newOrg: Organization = {
      id,
      name: org.name,
      slug: org.slug,
      address: org.address ?? null,
      city: org.city ?? null,
      state: org.state ?? null,
      zipCode: org.zipCode ?? null,
      phone: org.phone ?? null,
      email: org.email ?? null,
      website: org.website ?? null,
      timezone: org.timezone ?? "America/New_York",
      isActive: org.isActive ?? true,
      createdDate: org.createdDate,
      settings: org.settings ?? null,
    };
    this.organizations.set(id, newOrg);
    return newOrg;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const existing = this.organizations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...org };
    this.organizations.set(id, updated);
    return updated;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    return this.organizations.delete(id);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getClients(orgId?: string): Promise<Client[]> {
    const clients = Array.from(this.clients.values());
    if (orgId) {
      return clients.filter(c => c.organizationId === orgId);
    }
    return clients;
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = randomUUID();
    const newClient: Client = {
      id,
      organizationId: client.organizationId,
      name: client.name,
      contactName: client.contactName ?? null,
      email: client.email ?? null,
      phone: client.phone ?? null,
      address: client.address ?? null,
      city: client.city ?? null,
      state: client.state ?? null,
      zipCode: client.zipCode ?? null,
      remittanceEmail: client.remittanceEmail ?? null,
      remittanceFrequency: client.remittanceFrequency ?? "monthly",
      remittanceMethod: client.remittanceMethod ?? "check",
      isActive: client.isActive ?? true,
      notes: client.notes ?? null,
      createdDate: client.createdDate,
    };
    this.clients.set(id, newClient);
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...client };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  async getFeeSchedules(): Promise<FeeSchedule[]> {
    return Array.from(this.feeSchedules.values());
  }

  async getFeeSchedule(id: string): Promise<FeeSchedule | undefined> {
    return this.feeSchedules.get(id);
  }

  async createFeeSchedule(feeSchedule: InsertFeeSchedule): Promise<FeeSchedule> {
    const id = randomUUID();
    const newFeeSchedule: FeeSchedule = {
      id,
      organizationId: feeSchedule.organizationId,
      name: feeSchedule.name,
      description: feeSchedule.description ?? null,
      feeType: feeSchedule.feeType,
      feePercentage: feeSchedule.feePercentage ?? null,
      flatFeeAmount: feeSchedule.flatFeeAmount ?? null,
      minimumFee: feeSchedule.minimumFee ?? null,
      isActive: feeSchedule.isActive ?? true,
      effectiveDate: feeSchedule.effectiveDate,
      createdDate: feeSchedule.createdDate,
    };
    this.feeSchedules.set(id, newFeeSchedule);
    return newFeeSchedule;
  }

  async updateFeeSchedule(id: string, feeSchedule: Partial<InsertFeeSchedule>): Promise<FeeSchedule | undefined> {
    const existing = this.feeSchedules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...feeSchedule };
    this.feeSchedules.set(id, updated);
    return updated;
  }

  async deleteFeeSchedule(id: string): Promise<boolean> {
    return this.feeSchedules.delete(id);
  }

  async getCollectors(): Promise<Collector[]> {
    return Array.from(this.collectors.values());
  }

  async getCollector(id: string): Promise<Collector | undefined> {
    return this.collectors.get(id);
  }

  async createCollector(collector: InsertCollector): Promise<Collector> {
    const id = randomUUID();
    const newCollector: Collector = {
      id,
      organizationId: collector.organizationId,
      name: collector.name,
      email: collector.email,
      username: collector.username,
      password: collector.password,
      role: collector.role ?? "collector",
      status: collector.status ?? "active",
      avatarInitials: collector.avatarInitials ?? null,
      goal: collector.goal ?? 0,
      hourlyWage: collector.hourlyWage ?? null,
      canViewDashboard: collector.canViewDashboard ?? false,
      canViewEmail: collector.canViewEmail ?? false,
      canViewPaymentRunner: collector.canViewPaymentRunner ?? false,
    };
    this.collectors.set(id, newCollector);
    return newCollector;
  }

  async updateCollector(id: string, collector: Partial<InsertCollector>): Promise<Collector | undefined> {
    const existing = this.collectors.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...collector };
    this.collectors.set(id, updated);
    return updated;
  }

  async deleteCollector(id: string): Promise<boolean> {
    return this.collectors.delete(id);
  }

  async getPortfolios(): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values());
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    return this.portfolios.get(id);
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const newPortfolio: Portfolio = {
      id,
      organizationId: portfolio.organizationId,
      name: portfolio.name,
      clientId: portfolio.clientId ?? null,
      feeScheduleId: portfolio.feeScheduleId ?? null,
      purchaseDate: portfolio.purchaseDate,
      purchasePrice: portfolio.purchasePrice,
      totalFaceValue: portfolio.totalFaceValue,
      totalAccounts: portfolio.totalAccounts,
      status: portfolio.status ?? "active",
      creditorName: portfolio.creditorName ?? null,
      debtType: portfolio.debtType ?? null,
    };
    this.portfolios.set(id, newPortfolio);
    return newPortfolio;
  }

  async updatePortfolio(id: string, portfolio: Partial<InsertPortfolio>): Promise<Portfolio | undefined> {
    const existing = this.portfolios.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...portfolio };
    this.portfolios.set(id, updated);
    return updated;
  }

  async deletePortfolio(id: string): Promise<boolean> {
    return this.portfolios.delete(id);
  }

  async getPortfolioAssignments(portfolioId?: string, collectorId?: string): Promise<PortfolioAssignment[]> {
    let assignments = Array.from(this.portfolioAssignments.values());
    if (portfolioId) assignments = assignments.filter((a) => a.portfolioId === portfolioId);
    if (collectorId) assignments = assignments.filter((a) => a.collectorId === collectorId);
    return assignments;
  }

  async createPortfolioAssignment(assignment: InsertPortfolioAssignment): Promise<PortfolioAssignment> {
    const id = randomUUID();
    const newAssignment: PortfolioAssignment = { ...assignment, id };
    this.portfolioAssignments.set(id, newAssignment);
    return newAssignment;
  }

  async deletePortfolioAssignment(id: string): Promise<boolean> {
    return this.portfolioAssignments.delete(id);
  }

  async getDebtors(portfolioId?: string, collectorId?: string): Promise<Debtor[]> {
    let debtors = Array.from(this.debtors.values());
    if (portfolioId) debtors = debtors.filter((d) => d.portfolioId === portfolioId);
    if (collectorId) debtors = debtors.filter((d) => d.assignedCollectorId === collectorId);
    return debtors;
  }

  async getDebtor(id: string): Promise<Debtor | undefined> {
    return this.debtors.get(id);
  }

  async getRecentDebtors(limit: number = 10): Promise<Debtor[]> {
    return Array.from(this.debtors.values())
      .filter((d) => d.status === "open" || d.status === "in_payment")
      .slice(0, limit);
  }

  async searchDebtors(query: string): Promise<Debtor[]> {
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedDebtorIds = new Set<string>();

    // Search debtors by name, account number, file number, SSN
    Array.from(this.debtors.values()).forEach((debtor) => {
      const searchableFields = [
        debtor.firstName,
        debtor.lastName,
        `${debtor.firstName} ${debtor.lastName}`,
        debtor.accountNumber,
        debtor.fileNumber,
        debtor.ssn,
        debtor.ssnLast4,
        debtor.email,
        debtor.address,
        debtor.city,
        debtor.zipCode,
      ].filter(Boolean).map(f => f!.toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (searchableFields.some(f => f.includes(normalizedQuery))) {
        matchedDebtorIds.add(debtor.id);
      }
    });

    // Search contacts (phones and emails)
    Array.from(this.debtorContacts.values()).forEach((contact) => {
      const normalizedValue = contact.value.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedLabel = (contact.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedValue.includes(normalizedQuery) || normalizedLabel.includes(normalizedQuery)) {
        matchedDebtorIds.add(contact.debtorId);
      }
    });

    // Search employment records (employer name and phone)
    Array.from(this.employmentRecords.values()).forEach((emp) => {
      const searchableFields = [
        emp.employerName,
        emp.employerPhone,
        emp.position,
      ].filter(Boolean).map(f => f!.toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (searchableFields.some(f => f.includes(normalizedQuery))) {
        matchedDebtorIds.add(emp.debtorId);
      }
    });

    // Search references (name and phone)
    Array.from(this.debtorReferences.values()).forEach((ref) => {
      const searchableFields = [
        ref.name,
        ref.phone,
        ref.relationship,
      ].filter(Boolean).map(f => f!.toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (searchableFields.some(f => f.includes(normalizedQuery))) {
        matchedDebtorIds.add(ref.debtorId);
      }
    });

    return Array.from(matchedDebtorIds)
      .map(id => this.debtors.get(id))
      .filter((d): d is Debtor => d !== undefined);
  }

  async createDebtor(debtor: InsertDebtor): Promise<Debtor> {
    const id = randomUUID();
    const newDebtor: Debtor = {
      id,
      organizationId: debtor.organizationId,
      portfolioId: debtor.portfolioId,
      assignedCollectorId: debtor.assignedCollectorId ?? null,
      linkedAccountId: debtor.linkedAccountId ?? null,
      fileNumber: debtor.fileNumber ?? null,
      accountNumber: debtor.accountNumber,
      firstName: debtor.firstName,
      lastName: debtor.lastName,
      dateOfBirth: debtor.dateOfBirth ?? null,
      ssn: debtor.ssn ?? null,
      ssnLast4: debtor.ssnLast4 ?? null,
      email: debtor.email ?? null,
      address: debtor.address ?? null,
      city: debtor.city ?? null,
      state: debtor.state ?? null,
      zipCode: debtor.zipCode ?? null,
      originalCreditor: debtor.originalCreditor ?? null,
      clientName: debtor.clientName ?? null,
      clientId: debtor.clientId ?? null,
      originalBalance: debtor.originalBalance,
      currentBalance: debtor.currentBalance,
      status: debtor.status ?? "open",
      lastContactDate: debtor.lastContactDate ?? null,
      nextFollowUpDate: debtor.nextFollowUpDate ?? null,
    };
    this.debtors.set(id, newDebtor);
    return newDebtor;
  }

  async updateDebtor(id: string, debtor: Partial<InsertDebtor>): Promise<Debtor | undefined> {
    const existing = this.debtors.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...debtor };
    this.debtors.set(id, updated);
    return updated;
  }

  async deleteDebtor(id: string): Promise<boolean> {
    return this.debtors.delete(id);
  }

  async getDebtorContacts(debtorId: string): Promise<DebtorContact[]> {
    return Array.from(this.debtorContacts.values()).filter((c) => c.debtorId === debtorId);
  }

  async createDebtorContact(contact: InsertDebtorContact): Promise<DebtorContact> {
    const id = randomUUID();
    const newContact: DebtorContact = {
      id,
      organizationId: contact.organizationId,
      debtorId: contact.debtorId,
      type: contact.type,
      value: contact.value,
      label: contact.label ?? null,
      isPrimary: contact.isPrimary ?? false,
      isValid: contact.isValid ?? true,
      lastVerified: contact.lastVerified ?? null,
    };
    this.debtorContacts.set(id, newContact);
    return newContact;
  }

  async updateDebtorContact(id: string, contact: Partial<InsertDebtorContact>): Promise<DebtorContact | undefined> {
    const existing = this.debtorContacts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...contact };
    this.debtorContacts.set(id, updated);
    return updated;
  }

  async deleteDebtorContact(id: string): Promise<boolean> {
    return this.debtorContacts.delete(id);
  }

  async getEmploymentRecords(debtorId: string): Promise<EmploymentRecord[]> {
    return Array.from(this.employmentRecords.values()).filter((r) => r.debtorId === debtorId);
  }

  async createEmploymentRecord(record: InsertEmploymentRecord): Promise<EmploymentRecord> {
    const id = randomUUID();
    const newRecord: EmploymentRecord = {
      id,
      organizationId: record.organizationId,
      debtorId: record.debtorId,
      employerName: record.employerName,
      employerPhone: record.employerPhone ?? null,
      employerAddress: record.employerAddress ?? null,
      position: record.position ?? null,
      startDate: record.startDate ?? null,
      salary: record.salary ?? null,
      isCurrent: record.isCurrent ?? true,
      verifiedDate: record.verifiedDate ?? null,
    };
    this.employmentRecords.set(id, newRecord);
    return newRecord;
  }

  async updateEmploymentRecord(id: string, record: Partial<InsertEmploymentRecord>): Promise<EmploymentRecord | undefined> {
    const existing = this.employmentRecords.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...record };
    this.employmentRecords.set(id, updated);
    return updated;
  }

  async deleteEmploymentRecord(id: string): Promise<boolean> {
    return this.employmentRecords.delete(id);
  }

  async getDebtorReferences(debtorId: string): Promise<DebtorReference[]> {
    return Array.from(this.debtorReferences.values()).filter((r) => r.debtorId === debtorId);
  }

  async createDebtorReference(reference: InsertDebtorReference): Promise<DebtorReference> {
    const id = randomUUID();
    const newReference: DebtorReference = {
      id,
      organizationId: reference.organizationId,
      debtorId: reference.debtorId,
      name: reference.name,
      relationship: reference.relationship ?? null,
      phone: reference.phone ?? null,
      address: reference.address ?? null,
      city: reference.city ?? null,
      state: reference.state ?? null,
      zipCode: reference.zipCode ?? null,
      notes: reference.notes ?? null,
      addedDate: reference.addedDate ?? new Date().toISOString().split("T")[0],
    };
    this.debtorReferences.set(id, newReference);
    return newReference;
  }

  async updateDebtorReference(id: string, reference: Partial<InsertDebtorReference>): Promise<DebtorReference | undefined> {
    const existing = this.debtorReferences.get(id);
    if (!existing) return undefined;
    const updated: DebtorReference = { ...existing, ...reference };
    this.debtorReferences.set(id, updated);
    return updated;
  }

  async deleteDebtorReference(id: string): Promise<boolean> {
    return this.debtorReferences.delete(id);
  }

  async getBankAccounts(debtorId: string): Promise<BankAccount[]> {
    return Array.from(this.bankAccounts.values()).filter((a) => a.debtorId === debtorId);
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const id = randomUUID();
    const newAccount: BankAccount = {
      id,
      organizationId: account.organizationId,
      debtorId: account.debtorId,
      bankName: account.bankName,
      accountType: account.accountType,
      routingNumber: account.routingNumber ?? null,
      accountNumberLast4: account.accountNumberLast4 ?? null,
      isVerified: account.isVerified ?? false,
      verifiedDate: account.verifiedDate ?? null,
    };
    this.bankAccounts.set(id, newAccount);
    return newAccount;
  }

  async updateBankAccount(id: string, account: Partial<InsertBankAccount>): Promise<BankAccount | undefined> {
    const existing = this.bankAccounts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...account };
    this.bankAccounts.set(id, updated);
    return updated;
  }

  async deleteBankAccount(id: string): Promise<boolean> {
    return this.bankAccounts.delete(id);
  }

  async getPaymentCards(debtorId: string): Promise<PaymentCard[]> {
    return Array.from(this.paymentCards.values()).filter((c) => c.debtorId === debtorId);
  }

  async createPaymentCard(card: InsertPaymentCard): Promise<PaymentCard> {
    const id = randomUUID();
    const newCard: PaymentCard = {
      id,
      organizationId: card.organizationId,
      debtorId: card.debtorId,
      cardType: card.cardType,
      cardholderName: card.cardholderName,
      cardNumber: card.cardNumber,
      cardNumberLast4: card.cardNumberLast4,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cvv: card.cvv ?? null,
      billingZip: card.billingZip ?? null,
      isDefault: card.isDefault ?? false,
      addedDate: card.addedDate,
      addedBy: card.addedBy ?? null,
    };
    this.paymentCards.set(id, newCard);
    return newCard;
  }

  async updatePaymentCard(id: string, card: Partial<InsertPaymentCard>): Promise<PaymentCard | undefined> {
    const existing = this.paymentCards.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...card };
    this.paymentCards.set(id, updated);
    return updated;
  }

  async deletePaymentCard(id: string): Promise<boolean> {
    return this.paymentCards.delete(id);
  }

  async getPayments(debtorId?: string, batchId?: string): Promise<Payment[]> {
    let payments = Array.from(this.payments.values());
    if (debtorId) payments = payments.filter((p) => p.debtorId === debtorId);
    if (batchId) payments = payments.filter((p) => p.batchId === batchId);
    return payments;
  }

  async getAllPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentsForDebtor(debtorId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.debtorId === debtorId);
  }

  async getRecentPayments(limit: number = 10): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, limit);
  }

  async getPendingPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter((p) => p.status === "pending")
      .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const newPayment: Payment = {
      id,
      organizationId: payment.organizationId,
      debtorId: payment.debtorId,
      batchId: payment.batchId ?? null,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      status: payment.status ?? "pending",
      referenceNumber: payment.referenceNumber ?? null,
      processedBy: payment.processedBy ?? null,
      notes: payment.notes ?? null,
      cardId: payment.cardId ?? null,
      frequency: payment.frequency ?? "one_time",
      nextPaymentDate: payment.nextPaymentDate ?? null,
      specificDates: payment.specificDates ?? null,
      isRecurring: payment.isRecurring ?? false,
    };
    this.payments.set(id, newPayment);
    return newPayment;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const existing = this.payments.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...payment };
    this.payments.set(id, updated);
    return updated;
  }

  async getPaymentBatches(): Promise<PaymentBatch[]> {
    return Array.from(this.paymentBatches.values());
  }

  async getPaymentBatch(id: string): Promise<PaymentBatch | undefined> {
    return this.paymentBatches.get(id);
  }

  async createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch> {
    const id = randomUUID();
    const newBatch: PaymentBatch = {
      id,
      organizationId: batch.organizationId,
      name: batch.name,
      createdBy: batch.createdBy,
      createdDate: batch.createdDate,
      scheduledDate: batch.scheduledDate ?? null,
      status: batch.status ?? "draft",
      totalPayments: batch.totalPayments ?? 0,
      totalAmount: batch.totalAmount ?? 0,
      successCount: batch.successCount ?? 0,
      failedCount: batch.failedCount ?? 0,
      processedDate: batch.processedDate ?? null,
    };
    this.paymentBatches.set(id, newBatch);
    return newBatch;
  }

  async updatePaymentBatch(id: string, batch: Partial<InsertPaymentBatch>): Promise<PaymentBatch | undefined> {
    const existing = this.paymentBatches.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...batch };
    this.paymentBatches.set(id, updated);
    return updated;
  }

  async addPaymentsToBatch(batchId: string, paymentIds: string[]): Promise<PaymentBatch | undefined> {
    const batch = this.paymentBatches.get(batchId);
    if (!batch) return undefined;

    let addedAmount = 0;
    let addedCount = 0;

    for (const paymentId of paymentIds) {
      const payment = this.payments.get(paymentId);
      if (payment && !payment.batchId) {
        payment.batchId = batchId;
        this.payments.set(paymentId, payment);
        addedAmount += payment.amount;
        addedCount++;
      }
    }

    const updated: PaymentBatch = {
      ...batch,
      totalPayments: (batch.totalPayments || 0) + addedCount,
      totalAmount: (batch.totalAmount || 0) + addedAmount,
    };
    this.paymentBatches.set(batchId, updated);
    return updated;
  }

  async getNotes(debtorId: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.debtorId === debtorId)
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }

  async createNote(note: InsertNote): Promise<Note> {
    const id = randomUUID();
    const newNote: Note = {
      id,
      organizationId: note.organizationId,
      debtorId: note.debtorId,
      collectorId: note.collectorId,
      content: note.content,
      noteType: note.noteType ?? "general",
      createdDate: note.createdDate,
    };
    this.notes.set(id, newNote);
    return newNote;
  }

  async getLiquidationSnapshots(portfolioId?: string): Promise<LiquidationSnapshot[]> {
    let snapshots = Array.from(this.liquidationSnapshots.values());
    if (portfolioId) snapshots = snapshots.filter((s) => s.portfolioId === portfolioId);
    return snapshots;
  }

  async createLiquidationSnapshot(snapshot: InsertLiquidationSnapshot): Promise<LiquidationSnapshot> {
    const id = randomUUID();
    const newSnapshot: LiquidationSnapshot = { ...snapshot, id };
    this.liquidationSnapshots.set(id, newSnapshot);
    return newSnapshot;
  }

  async getDashboardStats(dateRange?: string): Promise<DashboardStats> {
    const debtors = Array.from(this.debtors.values());
    const payments = Array.from(this.payments.values());
    const portfolios = Array.from(this.portfolios.values());

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    // Calculate date range based on selection
    let startDate: string;
    let endDate: string = today;
    
    switch (dateRange) {
      case "today":
        startDate = today;
        break;
      case "this_week": {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        startDate = monday.toISOString().split("T")[0];
        break;
      }
      case "this_quarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
        startDate = quarterStart.toISOString().split("T")[0];
        break;
      }
      case "this_year": {
        startDate = `${now.getFullYear()}-01-01`;
        break;
      }
      case "this_month":
      default: {
        startDate = now.toISOString().slice(0, 7) + "-01";
        break;
      }
    }

    const completedPayments = payments.filter((p) => p.status === "completed" || p.status === "processed" || p.status === "posted");
    
    // Filter by date range
    const rangePayments = completedPayments.filter((p) => p.paymentDate >= startDate && p.paymentDate <= endDate);
    
    const collectionsToday = completedPayments
      .filter((p) => p.paymentDate === today)
      .reduce((sum, p) => sum + p.amount, 0);

    const collectionsThisMonth = rangePayments.reduce((sum, p) => sum + p.amount, 0);

    const activeAccounts = debtors.filter((d) => d.status === "open" || d.status === "in_payment").length;
    const accountsInPayment = debtors.filter((d) => d.status === "in_payment").length;

    const totalPortfolioValue = portfolios.reduce((sum, p) => sum + p.totalFaceValue, 0);
    const totalCollected = rangePayments.reduce((sum, p) => sum + p.amount, 0);

    const recoveryRate = totalPortfolioValue > 0
      ? Math.round((totalCollected / totalPortfolioValue) * 10000) / 100
      : 0;

    const avgCollectionAmount = rangePayments.length > 0
      ? Math.round(rangePayments.reduce((sum, p) => sum + p.amount, 0) / rangePayments.length)
      : 0;

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
  async getMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchants.values());
  }

  async getMerchant(id: string): Promise<Merchant | undefined> {
    return this.merchants.get(id);
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const id = randomUUID();
    const newMerchant: Merchant = {
      id,
      organizationId: merchant.organizationId,
      name: merchant.name,
      merchantId: merchant.merchantId,
      processorType: merchant.processorType,
      isActive: merchant.isActive ?? true,
      apiKeyRef: merchant.apiKeyRef ?? null,
      nmiSecurityKey: merchant.nmiSecurityKey ?? null,
      nmiUsername: merchant.nmiUsername ?? null,
      nmiPassword: merchant.nmiPassword ?? null,
      usaepaySourceKey: merchant.usaepaySourceKey ?? null,
      usaepayPin: merchant.usaepayPin ?? null,
      testMode: merchant.testMode ?? true,
      createdDate: merchant.createdDate,
    };
    this.merchants.set(id, newMerchant);
    return newMerchant;
  }

  async updateMerchant(id: string, merchant: Partial<InsertMerchant>): Promise<Merchant | undefined> {
    const existing = this.merchants.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...merchant };
    this.merchants.set(id, updated);
    return updated;
  }

  async deleteMerchant(id: string): Promise<boolean> {
    return this.merchants.delete(id);
  }

  // Time Clock
  async getTimeClockEntries(collectorId?: string, date?: string): Promise<TimeClockEntry[]> {
    let entries = Array.from(this.timeClockEntries.values());
    if (collectorId) entries = entries.filter((e) => e.collectorId === collectorId);
    if (date) entries = entries.filter((e) => e.clockIn.startsWith(date));
    return entries;
  }

  async getActiveTimeClockEntry(collectorId: string): Promise<TimeClockEntry | undefined> {
    return Array.from(this.timeClockEntries.values()).find(
      (e) => e.collectorId === collectorId && !e.clockOut
    );
  }

  async createTimeClockEntry(entry: InsertTimeClockEntry): Promise<TimeClockEntry> {
    const id = randomUUID();
    const newEntry: TimeClockEntry = {
      id,
      organizationId: entry.organizationId,
      collectorId: entry.collectorId,
      clockIn: entry.clockIn,
      clockOut: entry.clockOut ?? null,
      totalMinutes: entry.totalMinutes ?? null,
      notes: entry.notes ?? null,
    };
    this.timeClockEntries.set(id, newEntry);
    return newEntry;
  }

  async updateTimeClockEntry(id: string, entry: Partial<InsertTimeClockEntry>): Promise<TimeClockEntry | undefined> {
    const existing = this.timeClockEntries.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...entry };
    this.timeClockEntries.set(id, updated);
    return updated;
  }

  // Import Batches
  async getImportBatches(): Promise<ImportBatch[]> {
    return Array.from(this.importBatches.values());
  }

  async getImportBatch(id: string): Promise<ImportBatch | undefined> {
    return this.importBatches.get(id);
  }

  async createImportBatch(batch: InsertImportBatch): Promise<ImportBatch> {
    const id = randomUUID();
    const newBatch: ImportBatch = {
      id,
      organizationId: batch.organizationId,
      name: batch.name,
      fileName: batch.fileName,
      importType: batch.importType,
      status: batch.status ?? "pending",
      totalRecords: batch.totalRecords ?? 0,
      successRecords: batch.successRecords ?? 0,
      failedRecords: batch.failedRecords ?? 0,
      mappingId: batch.mappingId ?? null,
      createdDate: batch.createdDate,
      createdBy: batch.createdBy ?? null,
      processedDate: batch.processedDate ?? null,
      errorLog: batch.errorLog ?? null,
    };
    this.importBatches.set(id, newBatch);
    return newBatch;
  }

  async updateImportBatch(id: string, batch: Partial<InsertImportBatch>): Promise<ImportBatch | undefined> {
    const existing = this.importBatches.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...batch };
    this.importBatches.set(id, updated);
    return updated;
  }

  // Import Mappings
  async getImportMappings(importType?: string): Promise<ImportMapping[]> {
    let mappings = Array.from(this.importMappings.values());
    if (importType) mappings = mappings.filter((m) => m.importType === importType);
    return mappings;
  }

  async getImportMapping(id: string): Promise<ImportMapping | undefined> {
    return this.importMappings.get(id);
  }

  async createImportMapping(mapping: InsertImportMapping): Promise<ImportMapping> {
    const id = randomUUID();
    const newMapping: ImportMapping = {
      id,
      organizationId: mapping.organizationId,
      name: mapping.name,
      importType: mapping.importType,
      fieldMappings: mapping.fieldMappings,
      isDefault: mapping.isDefault ?? false,
      createdDate: mapping.createdDate,
      createdBy: mapping.createdBy ?? null,
    };
    this.importMappings.set(id, newMapping);
    return newMapping;
  }

  async updateImportMapping(id: string, mapping: Partial<InsertImportMapping>): Promise<ImportMapping | undefined> {
    const existing = this.importMappings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...mapping };
    this.importMappings.set(id, updated);
    return updated;
  }

  async deleteImportMapping(id: string): Promise<boolean> {
    return this.importMappings.delete(id);
  }

  // Drop Batches
  async getDropBatches(): Promise<DropBatch[]> {
    return Array.from(this.dropBatches.values());
  }

  async getDropBatch(id: string): Promise<DropBatch | undefined> {
    return this.dropBatches.get(id);
  }

  async createDropBatch(batch: InsertDropBatch): Promise<DropBatch> {
    const id = randomUUID();
    const newBatch: DropBatch = {
      id,
      organizationId: batch.organizationId,
      name: batch.name,
      portfolioId: batch.portfolioId ?? null,
      totalAccounts: batch.totalAccounts ?? 0,
      status: batch.status ?? "pending",
      createdDate: batch.createdDate,
      createdBy: batch.createdBy ?? null,
      processedDate: batch.processedDate ?? null,
    };
    this.dropBatches.set(id, newBatch);
    return newBatch;
  }

  async updateDropBatch(id: string, batch: Partial<InsertDropBatch>): Promise<DropBatch | undefined> {
    const existing = this.dropBatches.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...batch };
    this.dropBatches.set(id, updated);
    return updated;
  }

  // Drop Items
  async getDropItems(batchId?: string, collectorId?: string): Promise<DropItem[]> {
    let items = Array.from(this.dropItems.values());
    if (batchId) items = items.filter((i) => i.dropBatchId === batchId);
    if (collectorId) items = items.filter((i) => i.collectorId === collectorId);
    return items;
  }

  async createDropItem(item: InsertDropItem): Promise<DropItem> {
    const id = randomUUID();
    const newItem: DropItem = {
      id,
      organizationId: item.organizationId,
      dropBatchId: item.dropBatchId,
      debtorId: item.debtorId,
      collectorId: item.collectorId,
      status: item.status ?? "pending",
      assignedDate: item.assignedDate,
    };
    this.dropItems.set(id, newItem);
    return newItem;
  }

  async updateDropItem(id: string, item: Partial<InsertDropItem>): Promise<DropItem | undefined> {
    const existing = this.dropItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...item };
    this.dropItems.set(id, updated);
    return updated;
  }

  // Recall Batches
  async getRecallBatches(): Promise<RecallBatch[]> {
    return Array.from(this.recallBatches.values());
  }

  async getRecallBatch(id: string): Promise<RecallBatch | undefined> {
    return this.recallBatches.get(id);
  }

  async createRecallBatch(batch: InsertRecallBatch): Promise<RecallBatch> {
    const id = randomUUID();
    const newBatch: RecallBatch = {
      id,
      organizationId: batch.organizationId,
      name: batch.name,
      portfolioId: batch.portfolioId ?? null,
      clientName: batch.clientName ?? null,
      totalAccounts: batch.totalAccounts ?? 0,
      keeperCount: batch.keeperCount ?? 0,
      recallCount: batch.recallCount ?? 0,
      status: batch.status ?? "pending",
      createdDate: batch.createdDate,
      processedDate: batch.processedDate ?? null,
    };
    this.recallBatches.set(id, newBatch);
    return newBatch;
  }

  async updateRecallBatch(id: string, batch: Partial<InsertRecallBatch>): Promise<RecallBatch | undefined> {
    const existing = this.recallBatches.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...batch };
    this.recallBatches.set(id, updated);
    return updated;
  }

  // Recall Items
  async getRecallItems(batchId: string): Promise<RecallItem[]> {
    return Array.from(this.recallItems.values()).filter((i) => i.recallBatchId === batchId);
  }

  async createRecallItem(item: InsertRecallItem): Promise<RecallItem> {
    const id = randomUUID();
    const newItem: RecallItem = {
      id,
      organizationId: item.organizationId,
      recallBatchId: item.recallBatchId,
      debtorId: item.debtorId,
      isKeeper: item.isKeeper ?? false,
      recallReason: item.recallReason ?? null,
      keeperReason: item.keeperReason ?? null,
      processedDate: item.processedDate ?? null,
    };
    this.recallItems.set(id, newItem);
    return newItem;
  }

  async updateRecallItem(id: string, item: Partial<InsertRecallItem>): Promise<RecallItem | undefined> {
    const existing = this.recallItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...item };
    this.recallItems.set(id, updated);
    return updated;
  }

  // Consolidation Companies
  async getConsolidationCompanies(): Promise<ConsolidationCompany[]> {
    return Array.from(this.consolidationCompanies.values());
  }

  async getConsolidationCompany(id: string): Promise<ConsolidationCompany | undefined> {
    return this.consolidationCompanies.get(id);
  }

  async createConsolidationCompany(company: InsertConsolidationCompany): Promise<ConsolidationCompany> {
    const id = randomUUID();
    const newCompany: ConsolidationCompany = {
      id,
      name: company.name,
      contactName: company.contactName ?? null,
      phone: company.phone ?? null,
      email: company.email ?? null,
      address: company.address ?? null,
      isActive: company.isActive ?? true,
      createdDate: company.createdDate,
    };
    this.consolidationCompanies.set(id, newCompany);
    return newCompany;
  }

  async updateConsolidationCompany(id: string, company: Partial<InsertConsolidationCompany>): Promise<ConsolidationCompany | undefined> {
    const existing = this.consolidationCompanies.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...company };
    this.consolidationCompanies.set(id, updated);
    return updated;
  }

  async deleteConsolidationCompany(id: string): Promise<boolean> {
    return this.consolidationCompanies.delete(id);
  }

  // Consolidation Cases
  async getConsolidationCases(debtorId?: string, companyId?: string): Promise<ConsolidationCase[]> {
    let cases = Array.from(this.consolidationCases.values());
    if (debtorId) cases = cases.filter((c) => c.debtorId === debtorId);
    if (companyId) cases = cases.filter((c) => c.consolidationCompanyId === companyId);
    return cases;
  }

  async getConsolidationCase(id: string): Promise<ConsolidationCase | undefined> {
    return this.consolidationCases.get(id);
  }

  async createConsolidationCase(caseData: InsertConsolidationCase): Promise<ConsolidationCase> {
    const id = randomUUID();
    const newCase: ConsolidationCase = {
      id,
      debtorId: caseData.debtorId,
      consolidationCompanyId: caseData.consolidationCompanyId,
      caseNumber: caseData.caseNumber ?? null,
      status: caseData.status ?? "active",
      monthlyPayment: caseData.monthlyPayment ?? null,
      totalSettlementAmount: caseData.totalSettlementAmount ?? null,
      startDate: caseData.startDate,
      endDate: caseData.endDate ?? null,
      notes: caseData.notes ?? null,
    };
    this.consolidationCases.set(id, newCase);
    return newCase;
  }

  async updateConsolidationCase(id: string, caseData: Partial<InsertConsolidationCase>): Promise<ConsolidationCase | undefined> {
    const existing = this.consolidationCases.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...caseData };
    this.consolidationCases.set(id, updated);
    return updated;
  }

  // Work Queue
  async getWorkQueueItems(collectorId: string, status?: string): Promise<WorkQueueItem[]> {
    let items = Array.from(this.workQueueItems.values()).filter((i) => i.collectorId === collectorId);
    if (status) items = items.filter((i) => i.status === status);
    return items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  async getWorkQueueItem(id: string): Promise<WorkQueueItem | undefined> {
    return this.workQueueItems.get(id);
  }

  async createWorkQueueItem(item: InsertWorkQueueItem): Promise<WorkQueueItem> {
    const id = randomUUID();
    const newItem: WorkQueueItem = {
      id,
      collectorId: item.collectorId,
      debtorId: item.debtorId,
      priority: item.priority ?? 0,
      status: item.status ?? "pending",
      assignedDate: item.assignedDate,
      workedDate: item.workedDate ?? null,
      outcome: item.outcome ?? null,
      notes: item.notes ?? null,
    };
    this.workQueueItems.set(id, newItem);
    return newItem;
  }

  async updateWorkQueueItem(id: string, item: Partial<InsertWorkQueueItem>): Promise<WorkQueueItem | undefined> {
    const existing = this.workQueueItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...item };
    this.workQueueItems.set(id, updated);
    return updated;
  }

  async deleteWorkQueueItem(id: string): Promise<boolean> {
    return this.workQueueItems.delete(id);
  }

  // Remittances
  async getRemittances(status?: string, portfolioId?: string): Promise<Remittance[]> {
    let remittances = Array.from(this.remittances.values());
    if (status) remittances = remittances.filter((r) => r.status === status);
    if (portfolioId) remittances = remittances.filter((r) => r.portfolioId === portfolioId);
    return remittances;
  }

  async getRemittance(id: string): Promise<Remittance | undefined> {
    return this.remittances.get(id);
  }

  async createRemittance(remittance: InsertRemittance): Promise<Remittance> {
    const id = randomUUID();
    const newRemittance: Remittance = {
      id,
      organizationId: remittance.organizationId,
      portfolioId: remittance.portfolioId,
      clientName: remittance.clientName,
      amount: remittance.amount,
      remittanceDate: remittance.remittanceDate,
      status: remittance.status ?? "pending",
      checkNumber: remittance.checkNumber ?? null,
      notes: remittance.notes ?? null,
      createdBy: remittance.createdBy ?? null,
    };
    this.remittances.set(id, newRemittance);
    return newRemittance;
  }

  async updateRemittance(id: string, remittance: Partial<InsertRemittance>): Promise<Remittance | undefined> {
    const existing = this.remittances.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...remittance };
    this.remittances.set(id, updated);
    return updated;
  }

  // Remittance Items
  async getRemittanceItems(remittanceId?: string, status?: string): Promise<RemittanceItem[]> {
    let items = Array.from(this.remittanceItems.values());
    if (remittanceId) items = items.filter((i) => i.remittanceId === remittanceId);
    if (status) items = items.filter((i) => i.status === status);
    return items;
  }

  async createRemittanceItem(item: InsertRemittanceItem): Promise<RemittanceItem> {
    const id = randomUUID();
    const newItem: RemittanceItem = {
      id,
      remittanceId: item.remittanceId,
      debtorId: item.debtorId,
      paymentId: item.paymentId,
      amount: item.amount,
      status: item.status ?? "posted",
      declineReason: item.declineReason ?? null,
      reverseReason: item.reverseReason ?? null,
      processedDate: item.processedDate ?? null,
    };
    this.remittanceItems.set(id, newItem);
    return newItem;
  }

  async updateRemittanceItem(id: string, item: Partial<InsertRemittanceItem>): Promise<RemittanceItem | undefined> {
    const existing = this.remittanceItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...item };
    this.remittanceItems.set(id, updated);
    return updated;
  }

  // Payments by date
  async getPaymentsByDate(date: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.paymentDate === date);
  }

  // API Tokens
  async getApiTokens(): Promise<ApiToken[]> {
    return Array.from(this.apiTokens.values());
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    return Array.from(this.apiTokens.values()).find((t) => t.token === token);
  }

  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const id = randomUUID();
    const newToken: ApiToken = {
      id,
      name: token.name,
      token: token.token,
      isActive: token.isActive ?? true,
      permissions: token.permissions ?? null,
      createdDate: token.createdDate,
      lastUsedDate: token.lastUsedDate ?? null,
      expiresAt: token.expiresAt ?? null,
    };
    this.apiTokens.set(id, newToken);
    return newToken;
  }

  async updateApiTokenLastUsed(id: string): Promise<void> {
    const existing = this.apiTokens.get(id);
    if (existing) {
      existing.lastUsedDate = new Date().toISOString();
      this.apiTokens.set(id, existing);
    }
  }

  async deleteApiToken(id: string): Promise<boolean> {
    return this.apiTokens.delete(id);
  }

  // Communication Attempts
  async getCommunicationAttempts(debtorId: string): Promise<CommunicationAttempt[]> {
    return Array.from(this.communicationAttempts.values())
      .filter((a) => a.debtorId === debtorId)
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }

  async createCommunicationAttempt(attempt: InsertCommunicationAttempt): Promise<CommunicationAttempt> {
    const id = randomUUID();
    const newAttempt: CommunicationAttempt = {
      id,
      debtorId: attempt.debtorId,
      collectorId: attempt.collectorId ?? null,
      attemptType: attempt.attemptType,
      direction: attempt.direction ?? "outbound",
      phoneNumber: attempt.phoneNumber ?? null,
      emailAddress: attempt.emailAddress ?? null,
      outcome: attempt.outcome ?? null,
      duration: attempt.duration ?? null,
      notes: attempt.notes ?? null,
      externalId: attempt.externalId ?? null,
      createdDate: attempt.createdDate,
    };
    this.communicationAttempts.set(id, newAttempt);
    return newAttempt;
  }

  // Helper methods for external API
  async getDebtorByFileNumber(fileNumber: string): Promise<Debtor | undefined> {
    return Array.from(this.debtors.values()).find((d) => d.fileNumber === fileNumber);
  }

  async getCollectorByUsername(username: string): Promise<Collector | undefined> {
    return Array.from(this.collectors.values()).find((c) => c.username === username);
  }
}

export const storage = new MemStorage();
