import type { InsertPayment } from "@shared/schema";
import { passesLuhn } from "@shared/card-validation";

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
 * Processor credentials are always resolved from the selected vaulted card.
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