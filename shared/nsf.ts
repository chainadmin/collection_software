import type { Payment } from "@shared/schema";

export const NSF_ACCOUNT_STATUS = "nsf";

// A decline persists status "declined" (set by processPayment on a real
// gateway decline). It stays retriable - the auto-runner and manual "Run
// Now"/"rerun" both still pick it up - until someone either edits it
// (which resets it to "pending" for a fresh attempt) or reverses it.
// Only "reversed" is a hard stop.
export function isDeclinedPendingPayment(payment: Payment): boolean {
  return payment.status === "declined";
}

// A payment that "fell through" for reporting purposes: either it was
// actually reversed (status: "reversed"), or it's currently declined.
export function isFellThroughPayment(payment: Payment): boolean {
  return payment.status === "reversed" || isDeclinedPendingPayment(payment);
}

// How many days a declined payment can sit unresolved before it's surfaced
// for a reversal decision, instead of just waiting to be retried.
export const REVERSAL_ELIGIBLE_AFTER_DAYS = 3;

function addDaysToYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A declined payment is only surfaced for a reversal decision once it's sat unresolved for REVERSAL_ELIGIBLE_AFTER_DAYS. */
export function isEligibleForNsfDecision(payment: Payment, businessDate: string): boolean {
  return isDeclinedPendingPayment(payment) &&
    businessDate >= addDaysToYmd(payment.paymentDate, REVERSAL_ELIGIBLE_AFTER_DAYS);
}

/** Other outstanding (pending or still-declined) payments for the same debtor/arrangement that a resolution (reverse or NSF) should also clear. */
export function paymentsToDeleteAfterNsf(payments: Payment[], declinedPayment: Payment): Payment[] {
  return payments.filter((payment) =>
    payment.organizationId === declinedPayment.organizationId &&
    payment.debtorId === declinedPayment.debtorId &&
    (payment.status === "pending" || payment.status === "declined") &&
    payment.paymentDate >= declinedPayment.paymentDate &&
    (!declinedPayment.arrangementId || payment.arrangementId === declinedPayment.arrangementId)
  );
}
