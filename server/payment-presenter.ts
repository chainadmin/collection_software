import type { Payment } from "@shared/schema";

/** The only full payment representation allowed in HTTP responses. */
export function redactPayment(payment: Payment) {
  const { paymentToken: _paymentToken, ...safePayment } = payment;
  return safePayment;
}

export function redactPayments(payments: Payment[]) {
  return payments.map(redactPayment);
}