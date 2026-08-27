import assert from "node:assert/strict";
import test from "node:test";
import { externalOpaquePaymentToken } from "../server/external-api";
import { nextRecurringOccurrence } from "../server/recurring-payments";
import { redactPaymentCard } from "../server/payment-card-presenter";
import { ambiguousGatewayResult, gatewayReferences } from "../server/payment-processor";

test("external payment ingestion rejects PAN and CVV aliases", () => {
  for (const body of [
    { cardNumber: "4242424242424242" },
    { cc_number: "4242424242424242" },
    { pan: "4242424242424242" },
    { unexpectedPartnerField: "4242-4242-4242-4242" },
    { securityCode: "123" },
    { paymentToken: "4242 4242 4242 4242" },
  ]) {
    assert.throws(() => externalOpaquePaymentToken(body), /Raw card data/);
  }
  assert.equal(externalOpaquePaymentToken({ paymentToken: "pm_1ExampleOpaqueToken" }), "pm_1ExampleOpaqueToken");
});

test("card responses omit vault credentials and sensitive metadata", () => {
  const response = redactPaymentCard({
    id: "card-1", organizationId: "org-1", debtorId: "debtor-1",
    cardType: "visa", cardholderName: "Jane Doe", cardNumberLast4: "4242",
    expiryMonth: "12", expiryYear: "2030", billingZip: "12345",
    processorType: "stripe", processorToken: "pm_secret", processorCustomerId: "cus_secret",
    vaultStatus: "vaulted", isDefault: true, addedDate: "2025-01-01", addedBy: null,
  });
  assert.deepEqual(response, {
    id: "card-1", debtorId: "debtor-1", cardType: "visa", cardNumberLast4: "4242",
    expiryMonth: "12", expiryYear: "2030", isDefault: true, processorType: "stripe", vaultStatus: "vaulted",
  });
});

test("recurring occurrence helper advances without replaying completed date", () => {
  const base = {
    paymentDate: "2025-01-31",
    isRecurring: true,
    specificDates: null,
  };
  assert.equal(nextRecurringOccurrence({ ...base, frequency: "weekly" }), "2025-02-07");
  assert.equal(nextRecurringOccurrence({ ...base, frequency: "bi_weekly" }), "2025-02-14");
  assert.equal(nextRecurringOccurrence({ ...base, frequency: "monthly" }), "2025-02-28");
  assert.equal(nextRecurringOccurrence({
    ...base,
    frequency: "specific_dates",
    specificDates: "2025-01-15, 2025-02-10, 2025-03-10",
  }), "2025-02-10");
});

test("gateway references are stable and ambiguity is not an explicit decline", () => {
  const first = gatewayReferences({ id: "payment-123", idempotencyKey: "occurrence-456" });
  const second = gatewayReferences({ id: "payment-123", idempotencyKey: "occurrence-456" });
  assert.deepEqual(first, second);
  assert.match(first.orderReference, /^PMT-[A-Za-z0-9]+$/);
  assert.equal(first.idempotencyKey, "debt-payment:occurrence-456");
  const outcome = ambiguousGatewayResult("timeout", "txn-unknown");
  assert.equal(outcome.success, false);
  assert.equal(outcome.ambiguous, true);
  assert.equal(outcome.transactionId, "txn-unknown");
});