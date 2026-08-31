import crypto from "crypto";
import type { Merchant } from "@shared/schema";

export type ChainOutcome = "created" | "posted" | "declined" | "duplicate" | "unsupported" | "needs_review";

export interface NormalizedChainPayment {
  index: number;
  fileNumber: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionId: string | null;
  invoice: string;
  arrangementType: string | null;
  payorName: string;
  cardType: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  billingZip: string;
}

function lowerObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key.toLowerCase(), item]));
}

function text(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = body[key.toLowerCase()];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return "";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeChainPaymentRequest(input: unknown): NormalizedChainPayment[] {
  const root = lowerObject(input);
  let rawItems: unknown[] = [];
  const paymentData = root.paymentdata;
  if (Array.isArray(paymentData)) rawItems = paymentData;
  else if (typeof paymentData === "string" && paymentData.trim()) {
    try {
      const parsed = JSON.parse(paymentData);
      if (!Array.isArray(parsed)) throw new Error();
      rawItems = parsed;
    } catch {
      throw new Error("paymentdata must be an array");
    }
  } else if (paymentData != null && paymentData !== "") {
    throw new Error("paymentdata must be an array");
  }

  const includeRoot = rawItems.length === 0 ||
    (!!text(root, "paymentamount", "amount") && !!text(root, "paymentdate", "paymentDate", "scheduleddate", "scheduledDate"));
  const sources = [...(includeRoot ? [root] : []), ...rawItems.map(lowerObject)];
  if (!sources.length) throw new Error("At least one payment is required");
  const inherited = root;

  return sources.map((source, index) => {
    const isRoot = source === root;
    const value = (...keys: string[]) => text(source, ...keys) || text(inherited, ...keys);
    const fileNumber = value("filenumber", "fileNumber");
    const amountText = text(source, "paymentamount", "amount");
    const amount = Number(amountText);
    const paymentDate = text(source, "paymentdate", "paymentDate", "scheduleddate", "scheduledDate");
    if (!fileNumber) throw new Error(`Item ${index}: filenumber is required`);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) > 2_147_483_647) {
      throw new Error(`Item ${index}: paymentamount is invalid`);
    }
    if (!validDate(paymentDate)) throw new Error(`Item ${index}: paymentdate is invalid`);
    const invoice = value("invoice", "requestid", "idempotencykey", "referencenumber");
    const transactionId = text(source, "transactionid", "transactionId") || null;
    if (!invoice && !transactionId) throw new Error(`Item ${index}: invoice or transactionid is required`);
    return {
      index,
      fileNumber,
      amountCents: Math.round(amount * 100),
      paymentDate,
      paymentMethod: ["creditcard", "credit_card", "cc"].includes((value("paymentmethod") || "card").toLowerCase())
        ? "card"
        : (value("paymentmethod") || "card").toLowerCase(),
      paymentStatus: ((isRoot ? value("paymentstatus", "status") : text(source, "paymentstatus", "status")) || "pending").toLowerCase(),
      transactionId,
      invoice: invoice || transactionId!,
      arrangementType: value("arrangementtype", "typeofpayment") || null,
      payorName: value("payorname", "cardholdername", "nameoncard"),
      cardType: value("cardtype").toLowerCase(),
      cardNumber: value("cardnumber", "paymenttoken", "cardtoken"),
      expiryMonth: value("expirationmonth", "expirymonth", "expmonth"),
      expiryYear: value("expirationyear", "expiryyear", "expyear"),
      cvv: value("cvv", "cvv2", "cvc", "cardcode", "securitycode"),
      billingZip: value("billingzip", "postalcode", "zip"),
    };
  });
}

export function chainPaymentIdentity(item: NormalizedChainPayment): string {
  const stable = item.invoice.toLowerCase().replace(/[^a-z0-9_.:/-]/g, "-").slice(0, 120);
  return `chain:${stable}:${item.paymentDate}`;
}

function stableArrangementIdentity(invoice: string): string {
  return invoice.trim().toLowerCase().replace(/[^a-z0-9_.:/-]/g, "-").slice(0, 120);
}

export function chainCardIdentity(organizationId: string, invoice: string): string {
  const digest = crypto.createHash("sha256")
    .update(`${organizationId}\0${stableArrangementIdentity(invoice)}`)
    .digest("hex")
    .slice(0, 32);
  return `chain-card:${digest}`;
}

export function chainCredentialFingerprint(organizationId: string, invoice: string, credential: string): string {
  const key = process.env.PAYMENT_FINGERPRINT_KEY || process.env.SESSION_SECRET;
  if (!key) throw new Error("Payment fingerprint key is not configured");
  return chainCredentialFingerprintWithKey(organizationId, invoice, credential, key);
}

function chainCredentialFingerprintWithKey(
  organizationId: string,
  invoice: string,
  credential: string,
  key: string,
): string {
  const digest = crypto.createHmac("sha256", key)
    .update(`${organizationId}\0${stableArrangementIdentity(invoice)}\0${credential}`)
    .digest("hex");
  return `hmac-v1:${digest}`;
}

function previousFingerprintKeys(): string[] {
  const keys: string[] = [];
  const json = process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEYS;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed) || parsed.some(value => typeof value !== "string" || !value)) throw new Error();
      keys.push(...parsed);
    } catch {
      throw new Error("Previous payment fingerprint keys are misconfigured");
    }
  }
  if (process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEY) {
    keys.push(process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEY);
  }
  return keys;
}

function safeFingerprintEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyChainCredentialFingerprint(
  storedFingerprint: string | null | undefined,
  organizationId: string,
  invoice: string,
  credential: string,
): boolean {
  if (!storedFingerprint?.startsWith("hmac-v1:")) return false;
  const currentKey = process.env.PAYMENT_FINGERPRINT_KEY || process.env.SESSION_SECRET;
  if (!currentKey) throw new Error("Payment fingerprint key is not configured");
  const keys = [currentKey, ...previousFingerprintKeys()];
  return keys.some(key => safeFingerprintEqual(
    storedFingerprint,
    chainCredentialFingerprintWithKey(organizationId, invoice, credential, key),
  ));
}

export function chainPaymentConflicts(
  existing: { debtorId: string; amount: number; paymentDate: string; paymentMethod: string },
  expected: Pick<NormalizedChainPayment, "amountCents" | "paymentDate" | "paymentMethod">,
  debtorId: string,
): boolean {
  return existing.debtorId !== debtorId ||
    existing.amount !== expected.amountCents ||
    existing.paymentDate !== expected.paymentDate ||
    existing.paymentMethod !== expected.paymentMethod;
}

export function validateChainToken(merchant: Merchant, candidate: string): {
  processorToken: string;
  customerId: string | null;
} {
  const token = candidate.trim();
  if (!token || token.length > 500 || /\s/.test(token) || /^\d{13,19}$/.test(token.replace(/[- ]/g, ""))) {
    throw new Error("The reusable payment credential is invalid for the active processor");
  }
  if (merchant.processorType === "nmi") {
    if (!merchant.nmiSecurityKey || !/^nmi_vault_[A-Za-z0-9_-]{4,200}$/.test(token)) throw new Error("The reusable payment credential is invalid for the active processor");
    return { processorToken: token, customerId: token };
  }
  if (merchant.processorType === "usaepay") {
    if (!merchant.usaepaySourceKey || !merchant.usaepayPin || !/^[A-Za-z0-9_-]{6,200}$/.test(token)) throw new Error("The reusable payment credential is invalid for the active processor");
    return { processorToken: token, customerId: null };
  }
  if (merchant.processorType === "authorize_net") {
    if (!merchant.authorizeNetApiLoginId || !merchant.authorizeNetTransactionKey || !/^\d{4,20}\|\d{4,20}$/.test(token)) throw new Error("The reusable payment credential is invalid for the active processor");
    const [customerId, processorToken] = token.split("|");
    return { processorToken, customerId };
  }
  if (merchant.processorType === "stripe") {
    if (!merchant.stripeSecretKey || !/^cus_[A-Za-z0-9]{6,}\|pm_[A-Za-z0-9]{6,}$/.test(token)) throw new Error("The reusable payment credential is invalid for the active processor");
    const [customerId, processorToken] = token.split("|");
    return { processorToken, customerId };
  }
  throw new Error("The active processor is unsupported");
}