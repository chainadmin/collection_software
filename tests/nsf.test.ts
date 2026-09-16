import assert from "node:assert/strict";
import test from "node:test";
import type { Payment } from "@shared/schema";
import { isEligibleForNsfDecision, paymentsToDeleteAfterNsf, REVERSAL_ELIGIBLE_AFTER_DAYS } from "@shared/nsf";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1", organizationId: "org-1", debtorId: "debtor-1", amount: 1000,
    paymentDate: "2026-09-10", paymentMethod: "card", status: "declined",
    completedAt: new Date("2026-09-10T14:00:00Z"), notes: "DECLINED: insufficient funds",
    batchId: null, cardId: null, referenceNumber: null, paymentToken: null,
    processedBy: null, frequency: null, nextPaymentDate: null, specificDates: null,
    isRecurring: false, idempotencyKey: null, providerTransactionId: null,
    processingStartedAt: null, arrangementId: "arrangement-1", arrangementIndex: 0,
    ...overrides,
  };
}

test(`a declined payment is eligible for a reversal decision after ${REVERSAL_ELIGIBLE_AFTER_DAYS} days unresolved`, () => {
  const declined = payment();
  assert.equal(isEligibleForNsfDecision(declined, "2026-09-10"), false);
  assert.equal(isEligibleForNsfDecision(declined, "2026-09-12"), false);
  assert.equal(isEligibleForNsfDecision(declined, "2026-09-13"), true);
  assert.equal(isEligibleForNsfDecision(declined, "2026-09-14"), true);
  // Still retriable (not yet declined) is never eligible, no matter how stale.
  assert.equal(isEligibleForNsfDecision(payment({ status: "pending", completedAt: null }), "2026-09-14"), false);
});

test("NSF/reversal cleanup selects other outstanding (pending or declined) arrangement payments", () => {
  const declined = payment();
  const selected = paymentsToDeleteAfterNsf([
    payment({ id: "past", paymentDate: "2026-08-10" }),
    declined,
    payment({ id: "future", status: "pending", paymentDate: "2026-10-10", completedAt: null, notes: null }),
    payment({ id: "also-declined", paymentDate: "2026-09-24" }),
    payment({ id: "other-arrangement", arrangementId: "arrangement-2", paymentDate: "2026-10-10" }),
    payment({ id: "processed", status: "processed", paymentDate: "2026-10-10" }),
    payment({ id: "reversed", status: "reversed", paymentDate: "2026-10-10" }),
  ], declined);
  assert.deepEqual(
    selected.map((item) => item.id).sort(),
    ["also-declined", "future", "payment-1"].sort(),
  );
});
