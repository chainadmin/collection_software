import type { InsertPayment } from "@shared/schema";
import { passesLuhn } from "@shared/card-validation";

export interface OneTimeCardInput {
  cardNumber: string;
  expirationDate: string;
  cardCode: string;
}

/** Validate the ephemeral card fields accepted only by the synchronous Pay Now flow. */
export function parseOneTimeCardInput(value: unknown): OneTimeCardInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const cardNumber = String(input.cardNumber ?? "").replace(/\D/g, "");
  const expiryMonth = String(input.expiryMonth ?? "").padStart(2, "0");
  const expiryYear = String(input.expiryYear ?? "");
  const cardCode = String(input.cvv ?? "");
  const fullYear = expiryYear.length === 2 ? `20${expiryYear}` : expiryYear;
  const month = Number(expiryMonth);

  if (!/^\d{13,19}$/.test(cardNumber) || !passesLuhn(cardNumber)) {
    throw new Error("A valid card number is required");
  }
  if (!/^\d{4}$/.test(fullYear) || month < 1 || month > 12) {
    throw new Error("A valid card expiration date is required");
  }
  if (!/^\d{3,4}$/.test(cardCode)) {
    throw new Error("A valid card security code is required");
  }
  return { cardNumber, expirationDate: `${expiryMonth}${fullYear.slice(-2)}`, cardCode };
}

const RAW_CARD_FIELD = /(?:pan|cvv|cvc|security.?code|verification.?(?:code|value)|(?:card|cc).{0,20}(?:number|num))/i;
const PAN_SHAPED_VALUE = /^\d{13,19}$/;

function stringContainsPan(value: string): boolean {
  const separatorCompacted = value.replace(/[\s./-]/g, "");
  if (PAN_SHAPED_VALUE.test(separatorCompacted)) return true;

  const allDigits = value.replace(/\D/g, "");
  if (/^\d{13,19}$/.test(allDigits) && passesLuhn(allDigits)) return true;

  const candidates = value.match(/(?:\d[\s./-]*){13,19}/g) ?? [];
  return candidates.some(candidate => {
    const digits = candidate.replace(/\D/g, "");
    return /^\d{13,19}$/.test(digits) && passesLuhn(digits);
  });
}

export function rejectRawCardData(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    const compactKey = key.replace(/[-\s]/g, "_");
    if (RAW_CARD_FIELD.test(compactKey) && fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
      throw new Error("Raw card data is not accepted by this endpoint");
    }
    if (typeof fieldValue === "string" && stringContainsPan(fieldValue)) {
      throw new Error("Raw card data is not accepted by this endpoint");
    }
    if (
      typeof fieldValue === "number" &&
      Number.isFinite(fieldValue) &&
      Number.isInteger(fieldValue) &&
      Math.abs(fieldValue) >= 1_000_000_000_000 &&
      Math.abs(fieldValue) < 10_000_000_000_000_000_000
    ) {
      throw new Error("Raw card data is not accepted by this endpoint");
    }
    if (fieldValue && typeof fieldValue === "object") rejectRawCardData(fieldValue);
  }
}

interface TrustedPaymentFields {
  amount: number;
  debtorId: string;
  organizationId: string;
  idempotencyKey: string;
  processedBy?: string | null;
}

/**
 * Converts an internal payment request to an explicit persistence allowlist.
 * Processor credentials are always resolved from the selected saved card.
 */
export function buildInternalPaymentInsert(
  body: Record<string, unknown>,
  trusted: TrustedPaymentFields,
): InsertPayment {
  rejectRawCardData(body);
  return {
    organizationId: trusted.organizationId,
    debtorId: trusted.debtorId,
    amount: trusted.amount,
    paymentDate: String(body.paymentDate ?? ""),
    paymentMethod: String(body.paymentMethod ?? ""),
    status: "pending",
    batchId: typeof body.batchId === "string" ? body.batchId : null,
    cardId: typeof body.cardId === "string" ? body.cardId : null,
    referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber : null,
    paymentToken: null,
    processedBy: trusted.processedBy ?? null,
    notes: typeof body.notes === "string" ? body.notes : null,
    frequency: typeof body.frequency === "string" ? body.frequency : "one_time",
    nextPaymentDate: typeof body.nextPaymentDate === "string" ? body.nextPaymentDate : null,
    specificDates: typeof body.specificDates === "string" ? body.specificDates : null,
    isRecurring: body.isRecurring === true,
    idempotencyKey: trusted.idempotencyKey,
  };
}
