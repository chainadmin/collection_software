import type { Payment } from "@shared/schema";

export const NSF_ACCOUNT_STATUS = "nsf";

export function isDeclinedPendingPayment(payment: Payment): boolean {
  return payment.status === "pending" && Boolean(payment.completedAt) &&
    String(payment.notes || "").startsWith("DECLINED:");
}

// A payment that "fell through" for reporting purposes: either it was
// actually reversed (status: "reversed"), or it's a pending payment that was
// attempted and declined. A decline never gets its own terminal status - the
// payment stays "pending" (so a retry or NSF/reverse decision can still act
// on it) with a completedAt timestamp and a "DECLINED: ..." note instead, so
// checking payment.status === "declined" never matches anything.
export function isFellThroughPayment(payment: Payment): boolean {
  return payment.status === "reversed" || isDeclinedPendingPayment(payment);
}

/** NSF decisions are intentionally unavailable until the day after the due date. */
export function isEligibleForNsfDecision(payment: Payment, businessDate: string): boolean {
  return isDeclinedPendingPayment(payment) && payment.paymentDate < businessDate;
}

export function paymentsToDeleteAfterNsf(payments: Payment[], declinedPayment: Payment): Payment[] {
  return payments.filter((payment) =>
    payment.organizationId === declinedPayment.organizationId &&
    payment.debtorId === declinedPayment.debtorId &&
    payment.status === "pending" &&
    payment.paymentDate >= declinedPayment.paymentDate &&
    (!declinedPayment.arrangementId || payment.arrangementId === declinedPayment.arrangementId)
  );
}
