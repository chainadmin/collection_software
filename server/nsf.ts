import type { Payment } from "@shared/schema";

export const NSF_ACCOUNT_STATUS = "nsf";

export function isDeclinedPendingPayment(payment: Payment): boolean {
  return payment.status === "pending" && Boolean(payment.completedAt) &&
    String(payment.notes || "").startsWith("DECLINED:");
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
