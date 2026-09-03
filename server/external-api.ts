import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { rejectRawCardData } from "./payment-input";
import { detectCardNetwork, normalizeCardNumber, passesLuhn } from "@shared/card-validation";
import { CardVaultError, vaultCard, type RawCardInput } from "./card-vault";
import { redactPayment } from "./payment-presenter";
import { claimPaymentForProcessing, postPaymentAtomically } from "./payment-safety";
import { processPayment } from "./payment-processor";
import {
  chainCardIdentity,
  chainCredentialFingerprint,
  chainPaymentConflicts,
  chainPaymentIdentity,
  normalizeChainPaymentRequest,
  validateChainToken,
  verifyChainCredentialFingerprint,
  type ChainOutcome,
} from "./chain-payment";
import { getPaymentBusinessDate } from "./payment-date";

/** Returns an opaque external credential or throws before any payment is stored. */
export function externalOpaquePaymentToken(body: Record<string, unknown>): string | null {
  rejectRawCardData(body);
  const candidate = body.paymentToken ?? body.paymenttoken ?? body.cardToken ?? body.cardtoken;
  if (candidate === undefined || candidate === null || candidate === "") return null;
  if (typeof candidate !== "string") throw new Error("Invalid payment token");
  const token = candidate.trim();
  const digits = token.replace(/[\s-]/g, "");
  if (/^\d{13,19}$/.test(digits)) throw new Error("Raw card data is not accepted by this endpoint");
  // Known processor credentials include Stripe pm_/tok_, Authorize.Net opaque
  // values, and gateway vault references. Require a bounded, non-whitespace
  // opaque string without constraining provider-specific formats.
  if (token.length < 3 || token.length > 500 || /\s/.test(token) || !/^[A-Za-z0-9_:/=.+-]+$/.test(token)) {
    throw new Error("Invalid payment token");
  }
  return token;
}

const externalPanKeys = [
  "cardNumber", "cardnumber", "card_number", "ccNumber", "cc_number",
  "ccnumber", "creditCardNumber", "credit_card_number", "pan",
] as const;
const externalCvvKeys = [
  "cvv", "cvv2", "cvc", "cardCvv", "card_cvv", "cardCode", "cardcode",
  "securityCode", "security_code", "cardSecurityCode",
] as const;
const externalRawCardKeys = new Set<string>([...externalPanKeys, ...externalCvvKeys].flatMap(key => [key, key.toLowerCase()]));

function firstString(body: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    if (typeof body[key] === "string") return (body[key] as string).trim();
  }
  return "";
}

export function hasExternalRawCard(body: Record<string, unknown>): boolean {
  return [...externalPanKeys, ...externalCvvKeys].some(key => body[key] !== undefined);
}

export function rejectExternalCardDataOutsideDesignatedFields(body: Record<string, unknown>): void {
  const stripDesignatedCardFields = (value: unknown, allowCardFields = false): unknown => {
    if (Array.isArray(value)) return value.map(item => stripDesignatedCardFields(item, allowCardFields));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      const normalized = key.toLowerCase();
      if (allowCardFields && (externalRawCardKeys.has(key) || externalRawCardKeys.has(normalized))) return [];
      // paymentdata is often sent as JSON text. Decode it strictly for
      // screening so a PAN cannot be hidden in invoice/reference fields.
      if (normalized === "paymentdata") {
        if (typeof item !== "string") return [[key, stripDesignatedCardFields(item, true)]];
        try { return [[key, stripDesignatedCardFields(JSON.parse(item), true)]]; } catch { return [[key, item]]; }
      }
      return [[key, stripDesignatedCardFields(item, false)]];
    }));
  };
  rejectRawCardData(stripDesignatedCardFields(body, true) as Record<string, unknown>);
}

export function presentExternalPayment(payment: Record<string, unknown>) {
  const safePayment = redactPayment(payment as any);
  return {
    id: safePayment.id,
    organizationId: safePayment.organizationId,
    debtorId: safePayment.debtorId,
    cardId: safePayment.cardId ?? null,
    amount: safePayment.amount,
    paymentDate: safePayment.paymentDate,
    paymentMethod: safePayment.paymentMethod,
    status: safePayment.status,
    referenceNumber: safePayment.referenceNumber ?? null,
    frequency: safePayment.frequency ?? null,
    nextPaymentDate: safePayment.nextPaymentDate ?? null,
    specificDates: safePayment.specificDates ?? null,
    isRecurring: safePayment.isRecurring ?? false,
    idempotencyKey: safePayment.idempotencyKey ?? null,
    providerTransactionId: safePayment.providerTransactionId ?? null,
    completedAt: safePayment.completedAt ?? null,
  };
}

export function parseExternalFutureCard(body: Record<string, unknown>, today = new Date(), allowToday = false): {
  card: RawCardInput;
  safeCard: {
    cardType: string;
    cardholderName: string;
    cardNumberLast4: string;
    expiryMonth: string;
    expiryYear: string;
    billingZip: string;
  };
  amountCents: number;
  paymentDate: string;
  idempotencyKey: string;
} {
  const { digits: pan, malformed } = normalizeCardNumber(firstString(body, externalPanKeys));
  const network = detectCardNetwork(pan);
  const cardTypes: Record<string, string> = {
    Visa: "visa", Mastercard: "mastercard", "American Express": "amex", Discover: "discover",
  };
  const lengths: Record<string, number[]> = {
    Visa: [13, 16, 19], Mastercard: [16], "American Express": [15], Discover: [16, 19],
  };
  if (malformed || network === "Unknown" || !lengths[network]?.includes(pan.length) || !passesLuhn(pan)) {
    throw new Error("Invalid card number");
  }
  const cvv = firstString(body, externalCvvKeys);
  if (!new RegExp(network === "American Express" ? "^\\d{4}$" : "^\\d{3}$").test(cvv)) {
    throw new Error("Invalid security code");
  }
  let expiryMonth = firstString(body, ["expiryMonth", "expiry_month", "expirationMonth", "expiration_month", "expMonth", "exp_month"]);
  let expiryYear = firstString(body, ["expiryYear", "expiry_year", "expirationYear", "expiration_year", "expYear", "exp_year"]);
  const combinedExpiry = firstString(body, ["expirationDate", "expiration_date", "expiry", "cardExpiry", "card_expiry", "expDate"]).replace(/\s/g, "");
  if ((!expiryMonth || !expiryYear) && /^(\d{2})[/-]?(\d{2}|\d{4})$/.test(combinedExpiry)) {
    const match = combinedExpiry.match(/^(\d{2})[/-]?(\d{2}|\d{4})$/)!;
    expiryMonth = match[1];
    expiryYear = match[2];
  }
  expiryMonth = expiryMonth.padStart(2, "0");
  if (/^\d{2}$/.test(expiryYear)) expiryYear = `20${expiryYear}`;
  if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth) || !/^\d{4}$/.test(expiryYear)) {
    throw new Error("Invalid expiration date");
  }
  if (new Date(Number(expiryYear), Number(expiryMonth), 0, 23, 59, 59) < today) {
    throw new Error("Card is expired");
  }
  const cardholderName = firstString(body, ["cardholderName", "cardholder_name", "nameOnCard", "name_on_card", "cardholder"]);
  if (cardholderName.length < 2 || cardholderName.length > 100 || !/^[A-Za-z][A-Za-z .,'-]+$/.test(cardholderName)) {
    throw new Error("Invalid cardholder name");
  }
  const billingZip = firstString(body, ["billingZip", "billing_zip", "postalCode", "postal_code", "zip"]);
  if (!/^\d{5}(?:-\d{4})?$/.test(billingZip)) throw new Error("Invalid billing ZIP");
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) > 2_147_483_647) {
    throw new Error("Invalid payment amount");
  }
  const paymentDate = firstString(body, ["paymentDate", "scheduledDate"]);
  const parsedPaymentDate = new Date(`${paymentDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
    Number.isNaN(parsedPaymentDate.getTime()) ||
    parsedPaymentDate.toISOString().slice(0, 10) !== paymentDate
  ) {
    throw new Error("Invalid payment date");
  }
  const todayDate = getPaymentBusinessDate(today);
  if (paymentDate < todayDate || (!allowToday && paymentDate === todayDate)) {
    throw new Error(allowToday ? "Card payment date cannot be in the past" : "Card payment date must be in the future");
  }
  const sourceKey = firstString(body, ["idempotencyKey", "idempotency_key", "requestId", "transactionid", "transactionId", "referenceNumber"]);
  if (!sourceKey || sourceKey.length > 200 || !/^[A-Za-z0-9_.:/-]+$/.test(sourceKey)) {
    throw new Error("A valid idempotency key is required");
  }
  return {
    card: { pan, cvv, expiryMonth, expiryYear, cardholderName, billingZip },
    safeCard: {
      cardType: cardTypes[network],
      cardholderName,
      cardNumberLast4: pan.slice(-4),
      expiryMonth,
      expiryYear,
      billingZip,
    },
    amountCents: Math.round(amount * 100),
    paymentDate,
    idempotencyKey: `external-card:${sourceKey}`,
  };
}

export function buildExternalFutureCardPayment(
  request: ReturnType<typeof parseExternalFutureCard>,
  trusted: { organizationId: string; debtorId: string; cardId: string; referenceNumber?: string | null; notes?: string | null },
) {
  return {
    organizationId: trusted.organizationId,
    debtorId: trusted.debtorId,
    cardId: trusted.cardId,
    amount: request.amountCents,
    paymentDate: request.paymentDate,
    paymentMethod: "card",
    status: "pending",
    referenceNumber: trusted.referenceNumber ?? null,
    paymentToken: null,
    notes: trusted.notes ?? null,
    idempotencyKey: request.idempotencyKey,
  };
}

import crypto from "crypto";
import bcrypt from "bcrypt";
import { canonicalizeIp } from "./ip-address";

async function organizationAllowsIp(organizationId: string, requestIp: string | undefined): Promise<boolean> {
  const organization = await storage.getOrganization(organizationId);
  if (!organization?.isActive) return false;
  if (!organization.ipRestrictionEnabled) return true;
  const ip = canonicalizeIp(requestIp);
  return !!ip && await storage.isIpWhitelisted(organizationId, ip);
}

// Verify a password against a stored hash. Supports bcrypt hashes (start
// with "$2") and legacy SHA-256 hashes (64 hex chars), matching the
// verification logic used by the main app's auth routes.
async function verifyApiPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("$2")) {
    return bcrypt.compare(password, hash);
  }
  const sha256Hash = crypto.createHash("sha256").update(password).digest("hex");
  return sha256Hash === hash;
}

interface AuthenticatedRequest extends Request {
  apiToken?: {
    id: string;
    name: string;
    permissions: string[] | null;
    organizationId: string | null;
  };
}

async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Bearer token required" });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const apiToken = await storage.getApiTokenByToken(token);
    
    if (!apiToken) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }
    
    if (!apiToken.isActive) {
      return res.status(401).json({ error: "Unauthorized", message: "Token is inactive" });
    }
    
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Unauthorized", message: "Token has expired" });
    }
    
    await storage.updateApiTokenLastUsed(apiToken.id);
    
    req.apiToken = {
      id: apiToken.id,
      name: apiToken.name,
      permissions: apiToken.permissions,
      organizationId: apiToken.organizationId,
    };
    
    // Require organizationId for secure multi-tenant access
    // Legacy tokens without orgId are rejected for security
    if (!apiToken.organizationId) {
      return res.status(403).json({ 
        error: "Token requires organization context", 
        message: "Please re-authenticate to obtain a token with organization access" 
      });
    }

    if (!await organizationAllowsIp(apiToken.organizationId, req.ip)) {
      return res.status(403).json({
        error: "IP access denied",
        message: "This IP address is not authorized for the token's organization",
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}

export function registerExternalApiRoutes(app: Express) {
  
  // POST /api/v2/login - Generate or validate token
  app.post("/api/v2/login", async (req, res) => {
    try {
      const { username, password, agencyCode } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      // Company-level authentication (Chain and other org-wide integrations):
      // Username = company code (org slug), Password = a generated API key.
      // No collector account is involved. This path is used when no agencyCode
      // is supplied — Chain's connection form only has username + password.
      if (!agencyCode) {
        const org = await storage.getOrganizationBySlug(String(username).trim().toLowerCase());
        if (!org) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        if (!org.isActive) {
          return res.status(403).json({ error: "Your organization is not active" });
        }

        // The password must be a long-lived API key created in Settings. Requiring
        // its "dmv2_" prefix prevents legacy session tokens from being exchanged.
        const suppliedKey = String(password).trim();
        if (!suppliedKey.startsWith("dmv2_")) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        // The key must be valid, active, and belong to this org.
        // Defense-in-depth: never allow a key from another org to authenticate here.
        const apiKey = await storage.getApiTokenByToken(suppliedKey);
        if (
          !apiKey ||
          apiKey.organizationId !== org.id ||
          !apiKey.isActive ||
          (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date())
        ) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        if (!await organizationAllowsIp(org.id, req.ip)) {
          return res.status(403).json({ error: "This IP address is not authorized for your organization" });
        }

        await storage.updateApiTokenLastUsed(apiKey.id);

        // Chain keeps the token returned by login as its bearer credential. Returning
        // a new 24-hour session token here forced an otherwise permanent integration
        // to reconnect every day and also filled the API-key list with expiring keys.
        // The generated dmv2_ key is already organization-scoped, revocable, and
        // accepted by authenticateToken, so return that same long-lived credential.
        return res.json({
          success: true,
          token: suppliedKey,
          expiresAt: apiKey.expiresAt,
          organization: {
            id: org.id,
            name: org.name,
            code: org.slug,
          },
        });
      }

      const organization = await storage.getOrganizationBySlug(String(agencyCode).trim().toLowerCase());
      if (!organization) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const collector = await storage.getCollectorByOrgAndUsername(organization.id, username);
      
      if (!collector || !(await verifyApiPassword(password, collector.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (collector.status !== "active") {
        return res.status(403).json({ error: "Your account is not active" });
      }
      
      if (!organization.isActive) {
        return res.status(403).json({ error: "Your organization is not active" });
      }
      if (!await organizationAllowsIp(organization.id, req.ip)) {
        return res.status(403).json({ error: "This IP address is not authorized for your organization" });
      }
      
      const token = crypto.randomBytes(32).toString("hex");
      
      const apiToken = await storage.createApiToken({
        organizationId: collector.organizationId,
        name: `Session token for ${username}`,
        token,
        isActive: true,
        permissions: ["all"],
        createdDate: new Date().toISOString().split("T")[0],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      res.json({
        success: true,
        token,
        expiresAt: apiToken.expiresAt,
        user: {
          id: collector.id,
          name: collector.name,
          role: collector.role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // GET /api/v2/getportfoliolist - Get all portfolios
  app.get("/api/v2/getportfoliolist", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.apiToken?.organizationId;
      let portfolios = await storage.getPortfolios();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        portfolios = portfolios.filter((p) => p.organizationId === orgId);
      }
      
      res.json({
        success: true,
        data: portfolios.map((p) => ({
          portfolioId: p.id,
          name: p.name,
          clientId: p.clientId,
          purchaseDate: p.purchaseDate,
          totalAccounts: p.totalAccounts,
          totalFaceValue: p.totalFaceValue,
          status: p.status,
          creditorName: p.creditorName,
          debtType: p.debtType,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  // GET /api/v2/getaccountbysocial/:ssn - Get account by SSN
  app.get("/api/v2/getaccountbysocial/:ssn", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { ssn } = req.params;
      const orgId = req.apiToken?.organizationId;
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      const matches = debtors.filter((d) => d.ssn === ssn || d.ssnLast4 === ssn);
      
      if (matches.length === 0) {
        return res.status(404).json({ error: "No account found for SSN" });
      }
      
      res.json({
        success: true,
        data: matches.map((d) => formatDebtorForApi(d)),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // POST /api/v2/get_accounts_in_portfolio - Get accounts in a portfolio
  app.post("/api/v2/get_accounts_in_portfolio", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { portfolioId, limit, offset } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!portfolioId) {
        return res.status(400).json({ error: "portfolioId is required" });
      }
      
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      let filtered = debtors.filter((d) => d.portfolioId === portfolioId);
      
      const total = filtered.length;
      
      if (offset) {
        filtered = filtered.slice(offset);
      }
      if (limit) {
        filtered = filtered.slice(0, limit);
      }
      
      res.json({
        success: true,
        total,
        data: filtered.map((d) => formatDebtorForApi(d)),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  // GET /api/v2/getaccount/:filenumber - Get single account by file number
  app.get("/api/v2/getaccount/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      res.json({
        success: true,
        data: formatDebtorForApi(debtor),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // GET /api/v2/getphones/:filenumber - Get phone numbers for account
  app.get("/api/v2/getphones/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const phones = contacts.filter((c) => c.type === "phone");
      
      res.json({
        success: true,
        data: phones.map((p) => ({
          id: p.id,
          phoneNumber: p.value,
          label: p.label,
          isPrimary: p.isPrimary,
          isValid: p.isValid,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch phones" });
    }
  });

  // GET /api/v2/getemails/:filenumber - Get emails for account
  app.get("/api/v2/getemails/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const emails = contacts.filter((c) => c.type === "email");
      
      res.json({
        success: true,
        data: emails.map((e) => ({
          id: e.id,
          emailAddress: e.value,
          label: e.label,
          isPrimary: e.isPrimary,
          isValid: e.isValid,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // GET /api/v2/getnotes/:filenumber - Get notes for account
  app.get("/api/v2/getnotes/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const notes = await storage.getNotes(debtor.id);
      
      res.json({
        success: true,
        data: notes.map((n: any) => ({
          id: n.id,
          content: n.content,
          noteType: n.noteType,
          collectorId: n.collectorId,
          createdDate: n.createdDate,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // GET /api/v2/getpayments/:filenumber - Get payments for account
  app.get("/api/v2/getpayments/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const payments = await storage.getPayments(debtor.id);
      
      res.json({
        success: true,
        data: payments.map((p: any) => ({
          id: p.id,
          // Keep the provider transaction ID that Chain supplied on the way in.
          // Older/native DMP payments do not have one, so the immutable DMP
          // payment ID is the stable fallback used for deduplication.
          transactionid: p.referenceNumber || p.id,
          fileNumber: debtor.fileNumber,
          filenumber: debtor.fileNumber,
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          status: p.status,
          referenceNumber: p.referenceNumber,
          processedTimestamp: null,
          reversalTransactionId: null,
          reversalStatus: p.status === "reversed" ? "reversed" : null,
          notes: p.notes,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // GET /api/v2/getattempts/:filenumber - Get communication attempts for account
  app.get("/api/v2/getattempts/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      
      res.json({
        success: true,
        data: attempts.map((a) => ({
          id: a.id,
          attemptType: a.attemptType,
          direction: a.direction,
          phoneNumber: a.phoneNumber,
          emailAddress: a.emailAddress,
          outcome: a.outcome,
          duration: a.duration,
          notes: a.notes,
          createdDate: a.createdDate,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attempts" });
    }
  });

  // POST /api/v2/insertphone - Add phone to account
  app.post("/api/v2/insertphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, label, isPrimary, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !phoneNumber) {
        return res.status(400).json({ error: "fileNumber and phoneNumber are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contact = await storage.createDebtorContact({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        type: "phone",
        value: phoneNumber,
        label: label || null,
        isPrimary: isPrimary || false,
      });
      
      res.json({
        success: true,
        data: {
          id: contact.id,
          phoneNumber: contact.value,
          label: contact.label,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert phone" });
    }
  });

  // PUT /api/v2/updatephone - Update phone
  app.put("/api/v2/updatephone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneId, phoneNumber, label, isPrimary, isBad, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneId) {
        return res.status(400).json({ error: "phoneId is required" });
      }
      
      // Verify organization ownership by checking if contact belongs to org
      const existingContact = await storage.getDebtorContact(phoneId);
      if (!existingContact) {
        return res.status(404).json({ error: "Phone not found" });
      }
      
      if (orgId && existingContact.organizationId !== orgId) {
        return res.status(404).json({ error: "Phone not found" });
      }
      
      const contact = await storage.updateDebtorContact(phoneId, {
        value: phoneNumber,
        label,
        isPrimary,
        isValid: isBad === undefined ? undefined : !isBad,
      });
      
      res.json({
        success: true,
        data: contact,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update phone" });
    }
  });

  // POST /api/v2/insertattempt - Insert communication attempt
  app.post("/api/v2/insertattempt", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, attemptType, direction, phoneNumber, emailAddress, outcome, duration, notes, externalId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !attemptType) {
        return res.status(400).json({ error: "fileNumber and attemptType are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType,
        direction: direction || "outbound",
        phoneNumber: phoneNumber || null,
        emailAddress: emailAddress || null,
        outcome: outcome || null,
        duration: duration || null,
        notes: notes || null,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      res.json({
        success: true,
        data: attempt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert attempt" });
    }
  });

  // POST /api/v2/InsertNoteline - Insert note
  app.post("/api/v2/InsertNoteline", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, content, noteType } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !content) {
        return res.status(400).json({ error: "fileNumber and content are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const note = await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert note" });
    }
  });

  // PUT /api/v2/updatedbase - Update debtor fields
  app.put("/api/v2/updatedbase", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, ...updates } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber) {
        return res.status(400).json({ error: "fileNumber is required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const allowedFields = ["email", "address", "city", "state", "zipCode", "status", "lastContactDate", "nextFollowUpDate"];
      const filteredUpdates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }
      
      const updated = await storage.updateDebtor(debtor.id, filteredUpdates);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // PUT /api/v2/updatepermissions - Update contact permissions (consent)
  app.put("/api/v2/updatepermissions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, canCall, canText, canEmail } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber) {
        return res.status(400).json({ error: "fileNumber is required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      
      for (const contact of contacts) {
        if (contact.type === "phone" && canCall !== undefined) {
          await storage.updateDebtorContact(contact.id, { isValid: canCall });
        }
        if (contact.type === "email" && canEmail !== undefined) {
          await storage.updateDebtorContact(contact.id, { isValid: canEmail });
        }
      }
      
      res.json({
        success: true,
        message: "Permissions updated",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // POST /api/v2/searchbyphone - Search accounts by phone number
  app.post("/api/v2/searchbyphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneNumber } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      const results: any[] = [];
      
      for (const debtor of debtors) {
        const contacts = await storage.getDebtorContacts(debtor.id);
        const phoneMatch = contacts.find((c) => c.type === "phone" && c.value.replace(/\D/g, "").includes(cleanPhone));
        
        if (phoneMatch) {
          results.push({
            ...formatDebtorForApi(debtor),
            matchedPhone: phoneMatch.value,
          });
        }
      }
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to search by phone" });
    }
  });

  // POST /api/v2/send_text - Record outbound text (webhook endpoint for SMS software)
  app.post("/api/v2/send_text", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, message, externalId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !phoneNumber || !message) {
        return res.status(400).json({ error: "fileNumber, phoneNumber, and message are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "text",
        direction: "outbound",
        phoneNumber,
        outcome: "sent",
        notes: message,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content: `SMS sent to ${phoneNumber}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          status: "sent",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record text" });
    }
  });

  // POST /api/v2/send_email_c2c - Record outbound email
  app.post("/api/v2/send_email_c2c", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, emailAddress, subject, body, externalId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !emailAddress) {
        return res.status(400).json({ error: "fileNumber and emailAddress are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "email",
        direction: "outbound",
        emailAddress,
        outcome: "sent",
        notes: subject || null,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content: `Email sent to ${emailAddress}: ${subject || "(no subject)"}`,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          status: "sent",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record email" });
    }
  });

  // Chain payment ingestion. Chain reports already-completed payments and DMP
  // owns every unprocessed installment from creation through its due-date run.
  app.post("/api/v2/insert_payments_external", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.apiToken!.organizationId!;
      try {
        rejectExternalCardDataOutsideDesignatedFields(req.body || {});
      } catch {
        return res.status(400).json({ success: false, error: "Raw card data is accepted only in designated card fields" });
      }
      let items;
      try {
        items = normalizeChainPaymentRequest(req.body);
      } catch (error: any) {
        return res.status(400).json({ success: false, error: error.message });
      }
      const merchants = (await storage.getMerchants(orgId)).filter(item => item.isActive && (
        (item.processorType === "authorize_net" && item.authorizeNetApiLoginId && item.authorizeNetTransactionKey) ||
        (item.processorType === "nmi" && item.nmiSecurityKey) ||
        (item.processorType === "usaepay" && item.usaepaySourceKey && item.usaepayPin) ||
        (item.processorType === "stripe" && item.stripeSecretKey)
      ));
      const merchant = merchants.length === 1 ? merchants[0] : undefined;
      const today = getPaymentBusinessDate();
      const outcomes: Array<{ index: number; outcome: ChainOutcome; message?: string; payment?: unknown }> = [];
      const finishReadyPayment = async (item: (typeof items)[number], reservedPayment: any, cardId: string) => {
        const promoted = await storage.promoteChainPaymentReservation(reservedPayment.id, orgId, cardId);
        if (!promoted) {
          const current = await storage.getPayment(reservedPayment.id);
          if (!current || current.organizationId !== orgId) {
            outcomes.push({ index: item.index, outcome: "needs_review" as const, message: "Payment reservation requires review" });
          } else if (current.status === "processed") {
            try {
              await postPaymentAtomically(current.id, orgId);
              const posted = await storage.getPayment(current.id) || current;
              outcomes.push({ index: item.index, outcome: "posted" as const, payment: presentExternalPayment(posted) });
            } catch {
              outcomes.push({ index: item.index, outcome: "needs_review" as const, message: "Payment posting requires review" });
            }
          } else if (current.status === "declined") {
            outcomes.push({ index: item.index, outcome: "declined" as const, message: "Payment was declined", payment: presentExternalPayment(current) });
          } else if (current.status === "needs_review" || current.status === "vault_failed") {
            outcomes.push({ index: item.index, outcome: "needs_review" as const, message: "Payment reservation requires review", payment: presentExternalPayment(current) });
          } else {
            // pending/processing/posted are all owned or completed by the
            // compare-and-swap winner and must never be reset.
            outcomes.push({ index: item.index, outcome: "duplicate" as const, payment: presentExternalPayment(current) });
          }
          return;
        }
        let payment = promoted;
        if (item.paymentDate !== today) {
          outcomes.push({ index: item.index, outcome: "created" as const, payment: presentExternalPayment(payment) });
          return;
        }
        const claimed = await claimPaymentForProcessing(payment.id, orgId, today);
        if (!claimed) {
          const current = await storage.getPayment(payment.id);
          if (current?.status === "processed") {
            try {
              await postPaymentAtomically(current.id, orgId);
              const posted = await storage.getPayment(current.id) || current;
              outcomes.push({ index: item.index, outcome: "posted" as const, payment: presentExternalPayment(posted) });
            } catch {
              outcomes.push({ index: item.index, outcome: "needs_review" as const, message: "Payment posting requires review" });
            }
          } else {
            outcomes.push({ index: item.index, outcome: "duplicate" as const, payment: presentExternalPayment(current || payment) });
          }
          return;
        }
        const processed = await processPayment({ ...payment, status: "processing" }, storage, orgId);
        if (processed.success && processed.updatedPayment) {
          try {
            await postPaymentAtomically(processed.updatedPayment.id, orgId);
            const posted = await storage.getPayment(processed.updatedPayment.id) || processed.updatedPayment;
            outcomes.push({ index: item.index, outcome: "posted" as const, payment: presentExternalPayment(posted) });
          } catch {
            outcomes.push({ index: item.index, outcome: "needs_review" as const, message: "Payment was charged but posting requires review" });
          }
          return;
        }
        outcomes.push({
          index: item.index,
          outcome: processed.ambiguous ? "needs_review" as const : "declined" as const,
          message: processed.ambiguous ? "Payment outcome requires review" : "Payment was declined",
          payment: processed.updatedPayment ? presentExternalPayment(processed.updatedPayment) : undefined,
        });
      };

      for (const item of items) {
        try {
          const debtor = await storage.getDebtorByFileNumber(item.fileNumber, orgId);
          if (!debtor || debtor.organizationId !== orgId) {
            outcomes.push({ index: item.index, outcome: "unsupported", message: "Account not found" });
            continue;
          }
          const identity = chainPaymentIdentity(item);
          const existing = await storage.getPaymentByIdempotencyKey(orgId, identity);
          if (existing) {
            const conflict = chainPaymentConflicts(existing, item, debtor.id);
            const postedReplay = item.paymentStatus === "posted" && item.paymentDate === today && item.transactionId;
            const card = postedReplay ? undefined : await storage.getPaymentCardByExternalIdempotencyKey(
              orgId, chainCardIdentity(orgId, item.invoice),
            );
            const credentialConflict = !postedReplay && (
              !item.cardNumber || (!!card &&
              !verifyChainCredentialFingerprint(
                card.externalCredentialFingerprint, orgId, item.invoice, item.cardNumber,
              ))
            );
            if (conflict || credentialConflict) {
              outcomes.push({ index: item.index, outcome: "unsupported", message: "Payment identity conflicts with an existing request" });
            } else if (postedReplay &&
              existing.providerTransactionId === item.transactionId && existing.status === "processed") {
              await postPaymentAtomically(existing.id, orgId);
              const posted = await storage.getPayment(existing.id) || existing;
              outcomes.push({ index: item.index, outcome: "posted", payment: presentExternalPayment(posted) });
            } else if (!postedReplay && existing.status === "processed") {
              try {
                await postPaymentAtomically(existing.id, orgId);
                const posted = await storage.getPayment(existing.id) || existing;
                outcomes.push({ index: item.index, outcome: "posted", payment: presentExternalPayment(posted) });
              } catch {
                outcomes.push({ index: item.index, outcome: "needs_review", message: "Payment posting requires review" });
              }
            } else if (!postedReplay && card?.vaultStatus === "vaulting") {
              outcomes.push({ index: item.index, outcome: "needs_review", message: "Card vaulting is already in progress" });
            } else if (!postedReplay && !card) {
              outcomes.push({ index: item.index, outcome: "needs_review", message: "Payment reservation is already in progress" });
            } else if (!postedReplay && card?.vaultStatus === "vaulted" && card.processorToken &&
              existing.status === "needs_review") {
              await finishReadyPayment(item, existing, card.id);
            } else if (!postedReplay && card?.vaultStatus === "vault_failed" && existing.status === "needs_review") {
              outcomes.push({ index: item.index, outcome: "needs_review", message: "Card vaulting outcome requires review" });
            } else {
              outcomes.push({ index: item.index, outcome: "duplicate", payment: presentExternalPayment(existing) });
            }
            continue;
          }

          const alreadyPosted = item.paymentStatus === "posted" && item.paymentDate === today && !!item.transactionId;
          if (item.paymentStatus === "posted" && !alreadyPosted) {
            outcomes.push({ index: item.index, outcome: "unsupported", message: "POSTED requires today's date and a transactionid" });
            continue;
          }
          if (alreadyPosted) {
            const byTransaction = await storage.getPaymentByProviderTransactionId(orgId, item.transactionId!);
            if (byTransaction) {
              const conflict = byTransaction.debtorId !== debtor.id || byTransaction.amount !== item.amountCents ||
                byTransaction.paymentDate !== item.paymentDate;
              outcomes.push(conflict
                ? { index: item.index, outcome: "unsupported", message: "transactionid conflicts with an existing payment" }
                : { index: item.index, outcome: "duplicate", payment: presentExternalPayment(byTransaction) });
              continue;
            }
            let payment;
            try {
              payment = await storage.createPayment({
                organizationId: orgId, debtorId: debtor.id, amount: item.amountCents,
                paymentDate: item.paymentDate, paymentMethod: item.paymentMethod,
                status: "processed", referenceNumber: item.transactionId,
                providerTransactionId: item.transactionId, paymentToken: null,
                idempotencyKey: identity, notes: null,
              });
            } catch {
              const raced = await storage.getPaymentByIdempotencyKey(orgId, identity) ||
                await storage.getPaymentByProviderTransactionId(orgId, item.transactionId!);
              if (!raced) throw new Error("Payment could not be recorded");
              outcomes.push({ index: item.index, outcome: "duplicate", payment: presentExternalPayment(raced) });
              continue;
            }
            await postPaymentAtomically(payment.id, orgId);
            payment = await storage.getPayment(payment.id) || payment;
            outcomes.push({ index: item.index, outcome: "posted", payment: presentExternalPayment(payment) });
            continue;
          }

          if (item.paymentMethod !== "card" || item.paymentDate < today) {
            outcomes.push({ index: item.index, outcome: "unsupported", message: "Only current or future card installments are supported" });
            continue;
          }
          if (!merchant) {
            outcomes.push({ index: item.index, outcome: "unsupported", message: merchants.length ? "Multiple active processors are configured" : "No active processor is configured" });
            continue;
          }

          const digits = item.cardNumber.replace(/[\s-]/g, "");
          const rawCard = /^\d{13,19}$/.test(digits);
          if (!item.cardNumber) {
            outcomes.push({ index: item.index, outcome: "unsupported", message: "A reusable credential or card is required" });
            continue;
          }
          if (rawCard && merchant.processorType === "stripe") {
            outcomes.push({ index: item.index, outcome: "unsupported", message: "Stripe raw-card collection requires a hosted flow" });
            continue;
          }
          const cardIdentity = chainCardIdentity(orgId, item.invoice);
          const credentialFingerprint = chainCredentialFingerprint(orgId, item.invoice, item.cardNumber);
          // Reserve the logical installment before a gateway operation. The
          // temporary needs_review state is intentionally not runner-eligible.
          let payment;
          try {
            payment = await storage.createPayment({
              organizationId: orgId, debtorId: debtor.id, amount: item.amountCents,
              paymentDate: item.paymentDate, paymentMethod: "card", status: "needs_review",
              referenceNumber: item.invoice, paymentToken: null, idempotencyKey: identity,
              notes: null, frequency: item.arrangementType || "one_time", isRecurring: false,
            });
          } catch {
            const raced = await storage.getPaymentByIdempotencyKey(orgId, identity);
            if (!raced) throw new Error("Installment could not be reserved");
            if (chainPaymentConflicts(raced, item, debtor.id)) {
              outcomes.push({ index: item.index, outcome: "unsupported", message: "Payment identity conflicts with an existing request" });
              continue;
            }
            const racedCard = await storage.getPaymentCardByExternalIdempotencyKey(orgId, cardIdentity);
            if (racedCard && !verifyChainCredentialFingerprint(
              racedCard.externalCredentialFingerprint, orgId, item.invoice, item.cardNumber,
            )) {
              outcomes.push({ index: item.index, outcome: "unsupported", message: "Payment credential conflicts with an existing request" });
            } else if (!racedCard || racedCard.vaultStatus === "vaulting") {
              outcomes.push({ index: item.index, outcome: "needs_review", message: "Payment reservation is already in progress" });
            } else {
              outcomes.push({ index: item.index, outcome: "duplicate", payment: presentExternalPayment(raced) });
            }
            continue;
          }
          let card = await storage.getPaymentCardByExternalIdempotencyKey(orgId, cardIdentity);
          let createdCard = false;
          let parsedRaw: ReturnType<typeof parseExternalFutureCard> | undefined;
          let token: { processorToken: string; customerId: string | null } | undefined;
          if (rawCard) {
            parsedRaw = parseExternalFutureCard({
              cardNumber: item.cardNumber, cvv: item.cvv, expiryMonth: item.expiryMonth,
              expiryYear: item.expiryYear, cardholderName: item.payorName,
              billingZip: item.billingZip, amount: item.amountCents / 100,
              paymentDate: item.paymentDate, idempotencyKey: item.invoice,
            }, new Date(), true);
          } else {
            token = validateChainToken(merchant, item.cardNumber);
          }
          if (card && (card.debtorId !== debtor.id || card.processorType !== merchant.processorType || card.merchantId !== merchant.id ||
            !verifyChainCredentialFingerprint(
              card.externalCredentialFingerprint, orgId, item.invoice, item.cardNumber,
            ))) {
            outcomes.push({ index: item.index, outcome: "unsupported", message: "Card identity conflicts with an existing request" });
            continue;
          }
          if (!card) {
            const safeCard = parsedRaw?.safeCard || {
              cardType: item.cardType || "card", cardholderName: item.payorName || "Cardholder",
              cardNumberLast4: "****", expiryMonth: item.expiryMonth || "**",
              expiryYear: item.expiryYear || "****", billingZip: "",
            };
            try {
              card = await storage.createPaymentCard({
                ...safeCard, organizationId: orgId, debtorId: debtor.id,
                processorType: merchant.processorType,
                merchantId: merchant.id,
                processorToken: token?.processorToken || null,
                processorCustomerId: token?.customerId || null,
                vaultStatus: token ? "vaulted" : "vaulting",
                externalIdempotencyKey: cardIdentity, externalCredentialFingerprint: credentialFingerprint, isDefault: false,
                addedDate: today, addedBy: null,
              });
              createdCard = true;
            } catch {
              card = await storage.getPaymentCardByExternalIdempotencyKey(orgId, cardIdentity);
            }
          }
          if (!card) throw new Error("Card request could not be reserved");
          const cardId = card.id;
          if (!createdCard && card.vaultStatus === "vaulting") {
            outcomes.push({ index: item.index, outcome: "needs_review", message: "Card vaulting is already in progress" });
            continue;
          }
          if (parsedRaw && card.vaultStatus !== "vaulted") {
            try {
              const existingCards = await storage.getPaymentCards(debtor.id);
              const customer = existingCards.find(candidate =>
                candidate.merchantId === merchant.id && candidate.processorType === merchant.processorType && candidate.vaultStatus === "vaulted"
              )?.processorCustomerId || undefined;
              const vaulted = await vaultCard(merchant, debtor, parsedRaw.card, customer);
              card = await storage.updatePaymentCard(cardId, { ...vaulted, merchantId: merchant.id, vaultStatus: "vaulted" });
            } catch (error) {
              await storage.updatePaymentCard(cardId, { vaultStatus: "vault_failed" });
              const ambiguous = error instanceof CardVaultError && /uncertain|review/i.test(error.message);
              await storage.updatePayment(payment.id, { status: ambiguous ? "needs_review" : "declined" });
              outcomes.push({
                index: item.index,
                outcome: ambiguous ? "needs_review" : "declined",
                message: ambiguous ? "Card vaulting outcome requires review" : "Card vaulting failed",
              });
              continue;
            }
          }
          if (!card?.processorToken || card.vaultStatus !== "vaulted") {
            outcomes.push({ index: item.index, outcome: "needs_review", message: "Reusable credential is not ready" });
            continue;
          }

          await finishReadyPayment(item, payment, card.id);
        } catch (error: any) {
          // Do not surface gateway exception text: providers can include a
          // credential or profile reference in malformed error payloads.
          outcomes.push({
            index: item.index,
            outcome: error instanceof CardVaultError ? "needs_review" : "unsupported",
            message: error instanceof CardVaultError ? "Card vaulting outcome requires review" : "Payment item could not be processed",
          });
        }
      }
      const successful = outcomes.every(item => item.outcome === "created" || item.outcome === "posted" || item.outcome === "duplicate");
      return res.status(successful ? 200 : 207).json({ success: successful, outcomes });
    } catch {
      res.status(500).json({ success: false, error: "Failed to insert payments" });
    }
  });

  // POST /api/v2/createCallback - Create a callback/follow-up
  app.post("/api/v2/createCallback", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, callbackDate, callbackTime, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !callbackDate) {
        return res.status(400).json({ error: "fileNumber and callbackDate are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await storage.updateDebtor(debtor.id, {
        nextFollowUpDate: callbackDate,
      });
      
      if (notes) {
        await storage.createNote({
          organizationId: debtor.organizationId,
          debtorId: debtor.id,
          collectorId: "system",
          content: `Callback scheduled for ${callbackDate}${callbackTime ? " at " + callbackTime : ""}: ${notes}`,
          createdDate: new Date().toISOString().split("T")[0],
        });
      }
      
      res.json({
        success: true,
        message: "Callback created",
        callbackDate,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create callback" });
    }
  });

  // GET /api/v2/getemailstats/:filenumber - Get email stats for account
  app.get("/api/v2/getemailstats/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization ownership for multi-tenant isolation
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      const emailAttempts = attempts.filter((a) => a.attemptType === "email");
      
      res.json({
        success: true,
        data: {
          totalSent: emailAttempts.filter((a) => a.outcome === "sent").length,
          totalDelivered: emailAttempts.filter((a) => a.outcome === "delivered").length,
          totalOpened: emailAttempts.filter((a) => a.outcome === "opened").length,
          totalClicked: emailAttempts.filter((a) => a.outcome === "clicked").length,
          totalBounced: emailAttempts.filter((a) => a.outcome === "bounced").length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email stats" });
    }
  });

  // ============================================
  // SOFT PHONE / DIALER INTEGRATION ENDPOINTS
  // ============================================

  // GET /api/v2/softphone/queue - Get call queue/worklist for dialer
  app.get("/api/v2/softphone/queue", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { collectorId, status, limit, portfolioId } = req.query;
      const orgId = req.apiToken?.organizationId;
      
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      if (portfolioId) {
        debtors = debtors.filter((d) => d.portfolioId === portfolioId);
      }
      
      if (collectorId) {
        debtors = debtors.filter((d) => d.assignedCollectorId === collectorId);
      }
      
      if (status) {
        debtors = debtors.filter((d) => d.status === status);
      }
      
      debtors = debtors.filter((d) => d.status !== "paid" && d.status !== "closed" && d.status !== "bankrupt");
      
      if (limit) {
        debtors = debtors.slice(0, parseInt(limit as string, 10));
      }
      
      const queueItems = await Promise.all(
        debtors.map(async (debtor) => {
          const contacts = await storage.getDebtorContacts(debtor.id);
          const phones = contacts.filter((c) => c.type === "phone" && c.isValid !== false);
          
          return {
            fileNumber: debtor.fileNumber,
            accountNumber: debtor.accountNumber,
            firstName: debtor.firstName,
            lastName: debtor.lastName,
            fullName: `${debtor.firstName} ${debtor.lastName}`,
            currentBalance: debtor.currentBalance,
            status: debtor.status,
            priority: (debtor as any).priority || "normal",
            lastContactDate: debtor.lastContactDate,
            nextFollowUpDate: debtor.nextFollowUpDate,
            assignedCollectorId: debtor.assignedCollectorId,
            phones: phones.map((p) => ({
              id: p.id,
              number: p.value,
              label: p.label,
              isPrimary: p.isPrimary,
            })),
          };
        })
      );
      
      res.json({
        success: true,
        total: queueItems.length,
        data: queueItems,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch call queue" });
    }
  });

  // POST /api/v2/softphone/initiate - Initiate/log an outbound call
  app.post("/api/v2/softphone/initiate", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, collectorId, callerId, externalCallId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !phoneNumber) {
        return res.status(400).json({ error: "fileNumber and phoneNumber are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization access
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "call",
        direction: "outbound",
        phoneNumber,
        outcome: "initiated",
        notes: externalCallId ? `Call ID: ${externalCallId}` : null,
        externalId: externalCallId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.updateDebtor(debtor.id, {
        lastContactDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          fileNumber: debtor.fileNumber,
          debtorName: `${debtor.firstName} ${debtor.lastName}`,
          currentBalance: debtor.currentBalance,
          status: "call_initiated",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate call" });
    }
  });

  // POST /api/v2/softphone/result - Log call result/outcome
  app.post("/api/v2/softphone/result", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { 
        fileNumber, 
        attemptId, 
        externalCallId,
        outcome, 
        duration, 
        disposition, 
        notes,
        phoneNumber,
        recordingUrl 
      } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber && !attemptId && !externalCallId) {
        return res.status(400).json({ error: "fileNumber, attemptId, or externalCallId is required" });
      }
      
      if (!outcome) {
        return res.status(400).json({ error: "outcome is required" });
      }
      
      let debtor;
      if (fileNumber) {
        debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
        if (!debtor) {
          return res.status(404).json({ error: "Account not found" });
        }
        // Verify organization access
        if (orgId && debtor.organizationId !== orgId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      if (debtor) {
        await storage.createCommunicationAttempt({
          debtorId: debtor.id,
          attemptType: "call",
          direction: "outbound",
          phoneNumber: phoneNumber || null,
          outcome,
          duration: duration || null,
          notes: notes || null,
          externalId: externalCallId || null,
          createdDate: new Date().toISOString(),
        });
        
        if (disposition) {
          const dispositionNotes = [
            `Call Result: ${outcome}`,
            disposition ? `Disposition: ${disposition}` : null,
            duration ? `Duration: ${duration}s` : null,
            recordingUrl ? `Recording: ${recordingUrl}` : null,
            notes ? `Notes: ${notes}` : null,
          ].filter(Boolean).join(" | ");
          
          await storage.createNote({
            organizationId: debtor.organizationId,
            debtorId: debtor.id,
            collectorId: "system",
            content: dispositionNotes,
            createdDate: new Date().toISOString().split("T")[0],
          });
          
          const statusMap: Record<string, string> = {
            "connected": "1st_message",
            "promise_to_pay": "promise",
            "payment_made": "promise",
            "wrong_number": "newbiz",
            "disconnected": "bad_number",
            "no_answer": "newbiz",
            "voicemail": "1st_message",
            "busy": "newbiz",
            "callback": "callback",
          };
          
          if (statusMap[disposition]) {
            await storage.updateDebtor(debtor.id, {
              status: statusMap[disposition],
            });
          }
        }
      }
      
      res.json({
        success: true,
        message: "Call result recorded",
        data: {
          outcome,
          disposition,
          duration,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record call result" });
    }
  });

  // POST /api/v2/softphone/disposition - Set call disposition
  app.post("/api/v2/softphone/disposition", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { 
        fileNumber, 
        disposition, 
        promiseAmount, 
        promiseDate, 
        callbackDate, 
        callbackTime,
        notes 
      } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!fileNumber || !disposition) {
        return res.status(400).json({ error: "fileNumber and disposition are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization access
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const dispositionMap: Record<string, string> = {
        "connected": "1st_message",
        "left_message": "1st_message",
        "promise": "promise",
        "promise_to_pay": "promise",
        "payment": "promise",
        "no_answer": "newbiz",
        "voicemail": "1st_message",
        "busy": "newbiz",
        "wrong_number": "bad_number",
        "disconnected": "bad_number",
        "callback": "callback",
        "refused": "final",
        "dispute": "dispute",
        "cease_desist": "cease_desist",
        "attorney": "attorney",
        "deceased": "deceased",
        "bankrupt": "bankrupt",
      };
      
      const updates: Record<string, any> = {
        lastContactDate: new Date().toISOString().split("T")[0],
      };
      
      if (dispositionMap[disposition]) {
        updates.status = dispositionMap[disposition];
      }
      
      if (callbackDate) {
        updates.nextFollowUpDate = callbackDate;
      }
      
      await storage.updateDebtor(debtor.id, updates);
      
      let noteContent = `Disposition: ${disposition}`;
      if (promiseAmount) noteContent += ` | Promise Amount: $${promiseAmount}`;
      if (promiseDate) noteContent += ` | Promise Date: ${promiseDate}`;
      if (callbackDate) noteContent += ` | Callback: ${callbackDate}${callbackTime ? " at " + callbackTime : ""}`;
      if (notes) noteContent += ` | ${notes}`;
      
      await storage.createNote({
        organizationId: debtor.organizationId,
        debtorId: debtor.id,
        collectorId: "system",
        content: noteContent,
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      if (promiseAmount && promiseDate) {
        await storage.createPayment({
          organizationId: debtor.organizationId,
          debtorId: debtor.id,
          amount: Math.round(parseFloat(promiseAmount) * 100),
          paymentDate: promiseDate,
          paymentMethod: "pending",
          status: "scheduled",
          notes: `Promise from call disposition`,
        });
      }
      
      res.json({
        success: true,
        message: "Disposition recorded",
        data: {
          fileNumber: debtor.fileNumber,
          disposition,
          newStatus: updates.status || debtor.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record disposition" });
    }
  });

  // GET /api/v2/softphone/dispositions - Get available disposition codes
  app.get("/api/v2/softphone/dispositions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const dispositions = [
        { code: "connected", label: "Connected - Spoke with Debtor", category: "contact" },
        { code: "left_message", label: "Left Voicemail", category: "contact" },
        { code: "promise", label: "Promise to Pay", category: "positive" },
        { code: "payment", label: "Payment Made", category: "positive" },
        { code: "callback", label: "Callback Requested", category: "contact" },
        { code: "no_answer", label: "No Answer", category: "no_contact" },
        { code: "voicemail", label: "Voicemail (No Message)", category: "no_contact" },
        { code: "busy", label: "Busy Signal", category: "no_contact" },
        { code: "wrong_number", label: "Wrong Number", category: "bad_contact" },
        { code: "disconnected", label: "Disconnected/Not in Service", category: "bad_contact" },
        { code: "refused", label: "Refused to Pay", category: "negative" },
        { code: "dispute", label: "Disputes Debt", category: "compliance" },
        { code: "cease_desist", label: "Cease & Desist Request", category: "compliance" },
        { code: "attorney", label: "Has Attorney", category: "compliance" },
        { code: "deceased", label: "Deceased", category: "compliance" },
        { code: "bankrupt", label: "Bankruptcy", category: "compliance" },
      ];
      
      res.json({
        success: true,
        data: dispositions,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dispositions" });
    }
  });

  // GET /api/v2/softphone/account/:filenumber - Get account details for softphone screen pop
  app.get("/api/v2/softphone/account/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(filenumber, req.apiToken!.organizationId!);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify organization access
      if (orgId && debtor.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const notes = await storage.getNotes(debtor.id);
      const payments = await storage.getPayments(debtor.id);
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      
      const recentCalls = attempts
        .filter((a) => a.attemptType === "call")
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
        .slice(0, 10);
      
      const phones = contacts.filter((c) => c.type === "phone");
      const emails = contacts.filter((c) => c.type === "email");
      
      const totalPaid = payments
        .filter((p: any) => p.status === "completed" || p.status === "processed")
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      
      res.json({
        success: true,
        data: {
          account: {
            fileNumber: debtor.fileNumber,
            accountNumber: debtor.accountNumber,
            firstName: debtor.firstName,
            lastName: debtor.lastName,
            fullName: `${debtor.firstName} ${debtor.lastName}`,
            dateOfBirth: debtor.dateOfBirth,
            ssnLast4: debtor.ssnLast4,
            address: debtor.address,
            city: debtor.city,
            state: debtor.state,
            zipCode: debtor.zipCode,
            originalCreditor: debtor.originalCreditor,
            originalBalance: debtor.originalBalance,
            currentBalance: debtor.currentBalance,
            totalPaid,
            status: debtor.status,
            priority: (debtor as any).priority || "normal",
            lastContactDate: debtor.lastContactDate,
            nextFollowUpDate: debtor.nextFollowUpDate,
            assignedCollectorId: debtor.assignedCollectorId,
          },
          phones: phones.map((p) => ({
            id: p.id,
            number: p.value,
            label: p.label,
            isPrimary: p.isPrimary,
            isValid: p.isValid,
          })),
          emails: emails.map((e) => ({
            id: e.id,
            address: e.value,
            label: e.label,
            isPrimary: e.isPrimary,
          })),
          recentNotes: notes.slice(0, 5).map((n: any) => ({
            id: n.id,
            content: n.content,
            noteType: n.noteType,
            createdDate: n.createdDate,
          })),
          recentCalls: recentCalls.map((c) => ({
            id: c.id,
            phoneNumber: c.phoneNumber,
            outcome: c.outcome,
            duration: c.duration,
            createdDate: c.createdDate,
          })),
          paymentHistory: payments.slice(0, 5).map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paymentDate: p.paymentDate,
            status: p.status,
            paymentMethod: p.paymentMethod,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account for screen pop" });
    }
  });

  // POST /api/v2/softphone/inbound - Handle inbound call lookup (ANI/caller ID)
  app.post("/api/v2/softphone/inbound", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneNumber, externalCallId } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      let debtors = await storage.getDebtors();
      
      // Filter by organization for multi-tenant isolation
      if (orgId) {
        debtors = debtors.filter((d) => d.organizationId === orgId);
      }
      
      const matches: any[] = [];
      
      for (const debtor of debtors) {
        const contacts = await storage.getDebtorContacts(debtor.id);
        const phoneMatch = contacts.find(
          (c) => c.type === "phone" && c.value.replace(/\D/g, "").includes(cleanPhone)
        );
        
        if (phoneMatch) {
          matches.push({
            fileNumber: debtor.fileNumber,
            accountNumber: debtor.accountNumber,
            firstName: debtor.firstName,
            lastName: debtor.lastName,
            fullName: `${debtor.firstName} ${debtor.lastName}`,
            currentBalance: debtor.currentBalance,
            status: debtor.status,
            matchedPhone: phoneMatch.value,
            phoneLabel: phoneMatch.label,
          });
        }
      }
      
      if (matches.length > 0) {
        const primaryMatch = matches[0];
        const debtor = await storage.getDebtorByFileNumber(primaryMatch.fileNumber, req.apiToken!.organizationId!);
        
        if (debtor) {
          await storage.createCommunicationAttempt({
            debtorId: debtor.id,
            attemptType: "call",
            direction: "inbound",
            phoneNumber,
            outcome: "received",
            externalId: externalCallId || null,
            createdDate: new Date().toISOString(),
          });
        }
      }
      
      res.json({
        success: true,
        matchCount: matches.length,
        data: matches,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup inbound caller" });
    }
  });

  // GET /api/v2/campaign/accounts - Pull accounts with campaign contacts
  app.get("/api/v2/campaign/accounts", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.apiToken?.organizationId;
      const { portfolioId, status, contactType = "both", limit = "100", offset = "0" } = req.query;

      let debtors = await storage.getDebtors();
      debtors = debtors.filter((d) => d.organizationId === orgId);

      if (portfolioId) {
        debtors = debtors.filter((d) => d.portfolioId === portfolioId);
      }
      if (status) {
        debtors = debtors.filter((d) => d.status === status);
      }

      const start = Number(offset) || 0;
      const max = Number(limit) || 100;
      const paged = debtors.slice(start, start + max);

      const data = await Promise.all(paged.map(async (debtor) => {
        const contacts = await storage.getDebtorContacts(debtor.id);
        const filteredContacts = contacts.filter((contact) => {
          if (contactType === "both") return contact.type === "phone" || contact.type === "email";
          return contact.type === contactType;
        });

        return {
          fileNumber: debtor.fileNumber,
          firstName: debtor.firstName,
          lastName: debtor.lastName,
          currentBalance: debtor.currentBalance,
          status: debtor.status,
          contacts: filteredContacts.map((contact) => ({
            type: contact.type,
            value: contact.value,
            label: contact.label,
            isPrimary: contact.isPrimary,
          })),
        };
      }));

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign accounts" });
    }
  });

  // GET /api/v2/campaign/account/:filenumber/contacts - Pull all contacts for account
  app.get("/api/v2/campaign/account/:filenumber/contacts", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.apiToken?.organizationId;
      const debtor = await storage.getDebtorByFileNumber(req.params.filenumber, req.apiToken!.organizationId!);

      if (!debtor || debtor.organizationId !== orgId) {
        return res.status(404).json({ error: "Account not found" });
      }

      const contacts = await storage.getDebtorContacts(debtor.id);
      res.json(contacts.map((contact) => ({
        type: contact.type,
        value: contact.value,
        label: contact.label,
        isPrimary: contact.isPrimary,
        isValid: contact.isValid,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account contacts" });
    }
  });

  // POST /api/v2/campaign/status - campaign delivery webhook
  app.post("/api/v2/campaign/status", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.apiToken?.organizationId;
      const { campaignLogId, items } = req.body as { campaignLogId: string; items: Array<{ fileNumber: string; status: string; externalId?: string; responseText?: string }> };

      if (!campaignLogId || !Array.isArray(items)) {
        return res.status(400).json({ error: "campaignLogId and items are required" });
      }

      const campaignLog = await storage.getCampaignLog(campaignLogId);
      if (!campaignLog || campaignLog.organizationId !== orgId) {
        return res.status(404).json({ error: "Campaign log not found" });
      }

      const existingItems = await storage.getCampaignLogItems(campaignLogId);

      for (const item of items) {
        const match = existingItems.find((i) => i.fileNumber === item.fileNumber);
        if (!match) continue;

        await storage.updateCampaignLogItem(match.id, {
          status: item.status,
          externalId: item.externalId ?? null,
          responseText: item.responseText ?? null,
        });

        const debtor = await storage.getDebtor(match.debtorId);
        if (!debtor || debtor.organizationId !== orgId) continue;

        if (item.responseText) {
          await storage.createNote({
            organizationId: orgId!,
            debtorId: debtor.id,
            collectorId: "system",
            content: `[Campaign ${campaignLog.campaignName}] ${item.responseText}`,
            noteType: "campaign_response",
            createdDate: new Date().toISOString(),
          });
        }

        if (item.status === "opted-out") {
          const contacts = await storage.getDebtorContacts(debtor.id);
          const optedOutContact = contacts.find((c) => c.value === match.contactValue && c.type === match.contactType);
          if (optedOutContact) {
            await storage.updateDebtorContact(optedOutContact.id, { isValid: false });
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process campaign status update" });
    }
  });

  // PUT /api/v2/softphone/markphone - Mark phone as good/bad/primary
  app.put("/api/v2/softphone/markphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneId, fileNumber, phoneNumber, isBad, isPrimary, label, notes } = req.body;
      const orgId = req.apiToken?.organizationId;
      
      if (!phoneId && (!fileNumber || !phoneNumber)) {
        return res.status(400).json({ error: "phoneId or (fileNumber + phoneNumber) is required" });
      }
      
      let contactId = phoneId;
      
      if (!contactId && fileNumber && phoneNumber) {
        const debtor = await storage.getDebtorByFileNumber(fileNumber, req.apiToken!.organizationId!);
        if (!debtor) {
          return res.status(404).json({ error: "Account not found" });
        }
        
        // Verify organization access
        if (orgId && debtor.organizationId !== orgId) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        const contacts = await storage.getDebtorContacts(debtor.id);
        const cleanPhone = phoneNumber.replace(/\D/g, "");
        const phone = contacts.find(
          (c) => c.type === "phone" && c.value.replace(/\D/g, "") === cleanPhone
        );
        
        if (!phone) {
          return res.status(404).json({ error: "Phone not found for account" });
        }
        
        contactId = phone.id;
      }
      
      const updates: Record<string, any> = {};
      if (isBad !== undefined) updates.isValid = !isBad;
      if (isPrimary !== undefined) updates.isPrimary = isPrimary;
      if (label !== undefined) updates.label = label;
      
      const contact = await storage.updateDebtorContact(contactId, updates);
      
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      res.json({
        success: true,
        data: {
          id: contact.id,
          phoneNumber: contact.value,
          isValid: contact.isValid,
          isPrimary: contact.isPrimary,
          label: contact.label,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update phone status" });
    }
  });
}

function formatDebtorForApi(debtor: any) {
  return {
    fileNumber: debtor.fileNumber,
    accountNumber: debtor.accountNumber,
    firstName: debtor.firstName,
    lastName: debtor.lastName,
    fullName: `${debtor.firstName} ${debtor.lastName}`,
    dateOfBirth: debtor.dateOfBirth,
    ssnLast4: debtor.ssnLast4,
    email: debtor.email,
    address: debtor.address,
    city: debtor.city,
    state: debtor.state,
    zipCode: debtor.zipCode,
    originalCreditor: debtor.originalCreditor,
    clientName: debtor.clientName,
    originalBalance: debtor.originalBalance,
    currentBalance: debtor.currentBalance,
    status: debtor.status,
    lastContactDate: debtor.lastContactDate,
    nextFollowUpDate: debtor.nextFollowUpDate,
    portfolioId: debtor.portfolioId,
    assignedCollectorId: debtor.assignedCollectorId,
  };
}
