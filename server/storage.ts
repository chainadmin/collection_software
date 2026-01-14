import {
  type User,
  type InsertUser,
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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  getBankAccounts(debtorId: string): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, account: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: string): Promise<boolean>;

  getPaymentCards(debtorId: string): Promise<PaymentCard[]>;
  createPaymentCard(card: InsertPaymentCard): Promise<PaymentCard>;
  updatePaymentCard(id: string, card: Partial<InsertPaymentCard>): Promise<PaymentCard | undefined>;
  deletePaymentCard(id: string): Promise<boolean>;

  getPayments(debtorId?: string, batchId?: string): Promise<Payment[]>;
  getRecentPayments(limit?: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;

  getPaymentBatches(): Promise<PaymentBatch[]>;
  getPaymentBatch(id: string): Promise<PaymentBatch | undefined>;
  createPaymentBatch(batch: InsertPaymentBatch): Promise<PaymentBatch>;
  updatePaymentBatch(id: string, batch: Partial<InsertPaymentBatch>): Promise<PaymentBatch | undefined>;

  getNotes(debtorId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  getLiquidationSnapshots(portfolioId?: string): Promise<LiquidationSnapshot[]>;
  createLiquidationSnapshot(snapshot: InsertLiquidationSnapshot): Promise<LiquidationSnapshot>;

  getDashboardStats(): Promise<DashboardStats>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private collectors: Map<string, Collector>;
  private portfolios: Map<string, Portfolio>;
  private portfolioAssignments: Map<string, PortfolioAssignment>;
  private debtors: Map<string, Debtor>;
  private debtorContacts: Map<string, DebtorContact>;
  private employmentRecords: Map<string, EmploymentRecord>;
  private bankAccounts: Map<string, BankAccount>;
  private paymentCards: Map<string, PaymentCard>;
  private payments: Map<string, Payment>;
  private paymentBatches: Map<string, PaymentBatch>;
  private notes: Map<string, Note>;
  private liquidationSnapshots: Map<string, LiquidationSnapshot>;

  constructor() {
    this.users = new Map();
    this.collectors = new Map();
    this.portfolios = new Map();
    this.portfolioAssignments = new Map();
    this.debtors = new Map();
    this.debtorContacts = new Map();
    this.employmentRecords = new Map();
    this.bankAccounts = new Map();
    this.paymentCards = new Map();
    this.payments = new Map();
    this.paymentBatches = new Map();
    this.notes = new Map();
    this.liquidationSnapshots = new Map();
    this.seedData();
  }

  private seedData() {
    const collector1Id = randomUUID();
    const collector2Id = randomUUID();
    const collector3Id = randomUUID();
    
    this.collectors.set(collector1Id, {
      id: collector1Id,
      name: "Sarah Johnson",
      email: "sarah.johnson@collectmax.com",
      username: "sjohnson",
      password: "password123",
      role: "manager",
      status: "active",
      avatarInitials: "SJ",
      goal: 5000000,
    });
    this.collectors.set(collector2Id, {
      id: collector2Id,
      name: "Michael Chen",
      email: "michael.chen@collectmax.com",
      username: "mchen",
      password: "password123",
      role: "collector",
      status: "active",
      avatarInitials: "MC",
      goal: 2500000,
    });
    this.collectors.set(collector3Id, {
      id: collector3Id,
      name: "Emily Rodriguez",
      email: "emily.rodriguez@collectmax.com",
      username: "erodriguez",
      password: "password123",
      role: "collector",
      status: "active",
      avatarInitials: "ER",
      goal: 2500000,
    });

    const portfolio1Id = randomUUID();
    const portfolio2Id = randomUUID();
    const portfolio3Id = randomUUID();

    this.portfolios.set(portfolio1Id, {
      id: portfolio1Id,
      name: "Chase Q4 2024",
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
      name: "Capital One Medical",
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
      name: "Auto Loan Portfolio A",
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
      portfolioId: portfolio1Id,
      assignedCollectorId: collector2Id,
      fileNumber: "FILE-2024-001001",
      accountNumber: "ACC-2024-00001",
      firstName: "Robert",
      lastName: "Williams",
      dateOfBirth: "1985-03-15",
      ssnLast4: "4532",
      originalBalance: 1245000,
      currentBalance: 1089500,
      status: "open",
      lastContactDate: "2024-12-10",
      nextFollowUpDate: "2024-12-20",
    });
    this.debtors.set(debtor2Id, {
      id: debtor2Id,
      portfolioId: portfolio1Id,
      assignedCollectorId: collector2Id,
      fileNumber: "FILE-2024-001002",
      accountNumber: "ACC-2024-00002",
      firstName: "Jennifer",
      lastName: "Martinez",
      dateOfBirth: "1978-07-22",
      ssnLast4: "8891",
      originalBalance: 875000,
      currentBalance: 450000,
      status: "in_payment",
      lastContactDate: "2024-12-15",
      nextFollowUpDate: "2025-01-15",
    });
    this.debtors.set(debtor3Id, {
      id: debtor3Id,
      portfolioId: portfolio2Id,
      assignedCollectorId: collector3Id,
      fileNumber: "FILE-2024-001003",
      accountNumber: "ACC-2024-00003",
      firstName: "David",
      lastName: "Thompson",
      dateOfBirth: "1990-11-08",
      ssnLast4: "2267",
      originalBalance: 325000,
      currentBalance: 325000,
      status: "disputed",
      lastContactDate: "2024-11-28",
      nextFollowUpDate: null,
    });
    this.debtors.set(debtor4Id, {
      id: debtor4Id,
      portfolioId: portfolio3Id,
      assignedCollectorId: collector1Id,
      fileNumber: "FILE-2024-001004",
      accountNumber: "ACC-2024-00004",
      firstName: "Amanda",
      lastName: "Brown",
      dateOfBirth: "1982-05-30",
      ssnLast4: "7743",
      originalBalance: 4567800,
      currentBalance: 3890000,
      status: "open",
      lastContactDate: "2024-12-12",
      nextFollowUpDate: "2024-12-18",
    });
    this.debtors.set(debtor5Id, {
      id: debtor5Id,
      portfolioId: portfolio1Id,
      assignedCollectorId: collector2Id,
      fileNumber: "FILE-2024-001005",
      accountNumber: "ACC-2024-00005",
      firstName: "Christopher",
      lastName: "Davis",
      dateOfBirth: "1975-09-14",
      ssnLast4: "1156",
      originalBalance: 2150000,
      currentBalance: 0,
      status: "settled",
      lastContactDate: "2024-12-01",
      nextFollowUpDate: null,
    });

    this.debtorContacts.set(randomUUID(), {
      id: randomUUID(),
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
      debtorId: debtor2Id,
      batchId: null,
      amount: 15000,
      paymentDate: "2024-12-15",
      paymentMethod: "ach",
      status: "processed",
      referenceNumber: "PAY-2024-001234",
      processedBy: collector2Id,
      notes: "Monthly payment plan",
    });
    this.payments.set(payment2Id, {
      id: payment2Id,
      debtorId: debtor5Id,
      batchId: null,
      amount: 2150000,
      paymentDate: "2024-12-01",
      paymentMethod: "ach",
      status: "processed",
      referenceNumber: "PAY-2024-001100",
      processedBy: collector2Id,
      notes: "Settlement in full",
    });
    this.payments.set(payment3Id, {
      id: payment3Id,
      debtorId: debtor1Id,
      batchId: null,
      amount: 155500,
      paymentDate: "2024-12-10",
      paymentMethod: "card",
      status: "processed",
      referenceNumber: "PAY-2024-001189",
      processedBy: collector2Id,
      notes: null,
    });
    this.payments.set(payment4Id, {
      id: payment4Id,
      debtorId: debtor4Id,
      batchId: null,
      amount: 50000,
      paymentDate: "2024-12-12",
      paymentMethod: "check",
      status: "pending",
      referenceNumber: "PAY-2024-001201",
      processedBy: collector1Id,
      notes: "Check #4521",
    });

    const batch1Id = randomUUID();
    const batch2Id = randomUUID();

    this.paymentBatches.set(batch1Id, {
      id: batch1Id,
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
      debtorId: debtor1Id,
      collectorId: collector2Id,
      content: "Debtor agreed to make a payment of $1,555 on 12/10. Will follow up next week.",
      noteType: "call",
      createdDate: "2024-12-09",
    });
    this.notes.set(randomUUID(), {
      id: randomUUID(),
      debtorId: debtor1Id,
      collectorId: collector2Id,
      content: "Payment received as promised. Debtor is cooperative and willing to set up payment plan.",
      noteType: "general",
      createdDate: "2024-12-10",
    });
    this.notes.set(randomUUID(), {
      id: randomUUID(),
      debtorId: debtor3Id,
      collectorId: collector3Id,
      content: "Debtor is disputing the debt. Claims balance was already paid to original creditor. Requesting validation.",
      noteType: "dispute",
      createdDate: "2024-11-28",
    });

    this.liquidationSnapshots.set(randomUUID(), {
      id: randomUUID(),
      portfolioId: portfolio1Id,
      snapshotDate: "2024-12-01",
      totalCollected: 12500000,
      totalAccounts: 1250,
      accountsWorked: 890,
      liquidationRate: 500,
    });
    this.liquidationSnapshots.set(randomUUID(), {
      id: randomUUID(),
      portfolioId: portfolio2Id,
      snapshotDate: "2024-12-01",
      totalCollected: 8750000,
      totalAccounts: 890,
      accountsWorked: 650,
      liquidationRate: 500,
    });
    this.liquidationSnapshots.set(randomUUID(), {
      id: randomUUID(),
      portfolioId: portfolio3Id,
      snapshotDate: "2024-12-01",
      totalCollected: 21000000,
      totalAccounts: 2100,
      accountsWorked: 1500,
      liquidationRate: 600,
    });
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
      name: collector.name,
      email: collector.email,
      username: collector.username,
      password: collector.password,
      role: collector.role ?? "collector",
      status: collector.status ?? "active",
      avatarInitials: collector.avatarInitials ?? null,
      goal: collector.goal ?? 0,
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
      name: portfolio.name,
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

  async createDebtor(debtor: InsertDebtor): Promise<Debtor> {
    const id = randomUUID();
    const newDebtor: Debtor = {
      id,
      portfolioId: debtor.portfolioId,
      assignedCollectorId: debtor.assignedCollectorId ?? null,
      fileNumber: debtor.fileNumber ?? null,
      accountNumber: debtor.accountNumber,
      firstName: debtor.firstName,
      lastName: debtor.lastName,
      dateOfBirth: debtor.dateOfBirth ?? null,
      ssnLast4: debtor.ssnLast4 ?? null,
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

  async getBankAccounts(debtorId: string): Promise<BankAccount[]> {
    return Array.from(this.bankAccounts.values()).filter((a) => a.debtorId === debtorId);
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const id = randomUUID();
    const newAccount: BankAccount = {
      id,
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
      debtorId: card.debtorId,
      cardType: card.cardType,
      cardholderName: card.cardholderName,
      cardNumberLast4: card.cardNumberLast4,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
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

  async getRecentPayments(limit: number = 10): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, limit);
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const newPayment: Payment = {
      id,
      debtorId: payment.debtorId,
      batchId: payment.batchId ?? null,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      status: payment.status ?? "pending",
      referenceNumber: payment.referenceNumber ?? null,
      processedBy: payment.processedBy ?? null,
      notes: payment.notes ?? null,
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

  async getNotes(debtorId: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.debtorId === debtorId)
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }

  async createNote(note: InsertNote): Promise<Note> {
    const id = randomUUID();
    const newNote: Note = {
      id,
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

  async getDashboardStats(): Promise<DashboardStats> {
    const debtors = Array.from(this.debtors.values());
    const payments = Array.from(this.payments.values());
    const portfolios = Array.from(this.portfolios.values());

    const today = new Date().toISOString().split("T")[0];
    const collectionsToday = payments
      .filter((p) => p.paymentDate === today && p.status === "processed")
      .reduce((sum, p) => sum + p.amount, 0);

    const thisMonth = new Date().toISOString().slice(0, 7);
    const collectionsThisMonth = payments
      .filter((p) => p.paymentDate.startsWith(thisMonth) && p.status === "processed")
      .reduce((sum, p) => sum + p.amount, 0);

    const activeAccounts = debtors.filter((d) => d.status === "open" || d.status === "in_payment").length;
    const accountsInPayment = debtors.filter((d) => d.status === "in_payment").length;

    const totalPortfolioValue = portfolios.reduce((sum, p) => sum + p.totalFaceValue, 0);
    const totalCollected = payments
      .filter((p) => p.status === "processed")
      .reduce((sum, p) => sum + p.amount, 0);

    const recoveryRate = totalPortfolioValue > 0
      ? Math.round((totalCollected / totalPortfolioValue) * 10000) / 100
      : 0;

    const processedPayments = payments.filter((p) => p.status === "processed");
    const avgCollectionAmount = processedPayments.length > 0
      ? Math.round(processedPayments.reduce((sum, p) => sum + p.amount, 0) / processedPayments.length)
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
}

export const storage = new MemStorage();
