import assert from "node:assert/strict";
import test from "node:test";
import type { Payment } from "@shared/schema";
import { isEligibleForNsfDecision, paymentsToDeleteAfterNsf } from "../server/nsf";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1", organizationId: "org-1", debtorId: "debtor-1", amount: 1000,
    paymentDate: "2026-09-10", paymentMethod: "card", status: "pending",
    completedAt: new Date("2026-09-10T14:00:00Z"), notes: "DECLINED: insufficient funds",
    batchId: null, cardId: null, referenceNumber: null, paymentToken: null,
    processedBy: null, frequency: null, nextPaymentDate: null, specificDates: null,
    isRecurring: false, idempotencyKey: null, providerTransactionId: null,
    processingStartedAt: null, arrangementId: "arrangement-1", arrangementIndex: 0,
    ...overrides,
  };
}

test("NSF decision starts the day after a declined pending payment is due", () => {
  const declined = payment();
  assert.equal(isEligibleForNsfDecision(declined, "2026-09-10"), false);
  assert.equal(isEligibleForNsfDecision(declined, "2026-09-11"), true);
  assert.equal(isEligibleForNsfDecision(payment({ completedAt: null }), "2026-09-11"), false);
});

test("NSF deletion selects only current and future pending arrangement payments", () => {
  const declined = payment();
  const selected = paymentsToDeleteAfterNsf([
    payment({ id: "past", paymentDate: "2026-08-10" }),
    declined,
    payment({ id: "future", paymentDate: "2026-10-10", completedAt: null, notes: null }),
    payment({ id: "other-arrangement", arrangementId: "arrangement-2", paymentDate: "2026-10-10" }),
    payment({ id: "processed", status: "processed", paymentDate: "2026-10-10" }),
  ], declined);
  assert.deepEqual(selected.map((item) => item.id), ["payment-1", "future"]);
});
