import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExternalFutureCardPayment,
  externalOpaquePaymentToken,
  parseExternalFutureCard,
  presentExternalPayment,
  rejectExternalCardDataOutsideDesignatedFields,
} from "../server/external-api";
import { nextRecurringOccurrence } from "../server/recurring-payments";
import { redactPaymentCard } from "../server/payment-card-presenter";
import { ambiguousGatewayResult, gatewayReferences } from "../server/payment-processor";
import { buildInternalPaymentInsert } from "../server/payment-input";
import { redactPayment, redactPayments } from "../server/payment-presenter";

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

test("internal payment persistence rejects PAN and never accepts a caller payment token", () => {
  const trusted = {
    amount: 1250,
    debtorId: "debtor-1",
    organizationId: "org-1",
    idempotencyKey: "payment-1",
  };
  for (const body of [
    { paymentMethod: "card", cardId: "card-1", paymentDate: "2026-09-07", paymentToken: "4242424242424242" },
    { paymentMethod: "card", cardId: "card-1", paymentDate: "2026-09-07", cvv: "123" },
    { paymentMethod: "card", cardId: "card-1", paymentDate: "2026-09-07", nested: { card_number: "4242 4242 4242 4242" } },
  ]) {
    assert.throws(() => buildInternalPaymentInsert(body, trusted), /Raw card data/);
  }
  const insert = buildInternalPaymentInsert({
    paymentMethod: "card",
    cardId: "card-1",
    paymentDate: "2026-09-07",
    paymentToken: "pm_caller_controlled",
    providerTransactionId: "caller-controlled",
    status: "posted",
  }, trusted);
  assert.equal(insert.paymentToken, null);
  assert.equal(insert.status, "pending");
  assert.equal(insert.providerTransactionId, undefined);
});

test("card responses omit vault credentials and sensitive metadata", () => {
  const response = redactPaymentCard({
    id: "card-1", organizationId: "org-1", debtorId: "debtor-1",
    cardType: "visa", cardholderName: "Jane Doe", cardNumberLast4: "4242",
    expiryMonth: "12", expiryYear: "2030", billingZip: "12345",
    processorType: "stripe", processorToken: "pm_secret", processorCustomerId: "cus_secret",
    vaultStatus: "vaulted", externalIdempotencyKey: null,
    isDefault: true, addedDate: "2025-01-01", addedBy: null,
  });
  assert.deepEqual(response, {
    id: "card-1", debtorId: "debtor-1", cardType: "visa", cardNumberLast4: "4242",
    expiryMonth: "12", expiryYear: "2030", isDefault: true, processorType: "stripe", vaultStatus: "vaulted",
  });
});

test("external future card payload produces only redacted card and token-free payment persistence", () => {
  const parsed = parseExternalFutureCard({
    cardNumber: "4242 4242 4242 4242",
    expiryMonth: "12",
    expiryYear: "2030",
    cvv: "123",
    cardholderName: "Jane Doe",
    billingZip: "12345",
    amount: 25.5,
    paymentDate: "2030-05-01",
    idempotencyKey: "chain-request-123",
  }, new Date("2026-01-01T12:00:00Z"));
  assert.deepEqual(parsed.safeCard, {
    cardType: "visa",
    cardholderName: "Jane Doe",
    cardNumberLast4: "4242",
    expiryMonth: "12",
    expiryYear: "2030",
    billingZip: "12345",
  });
  const insert = buildExternalFutureCardPayment(parsed, {
    organizationId: "org-1", debtorId: "debtor-1", cardId: "card-1",
  });
  assert.equal(insert.cardId, "card-1");
  assert.equal(insert.paymentToken, null);
  assert.equal(insert.status, "pending");
  assert.equal(insert.idempotencyKey, "external-card:chain-request-123");
  assert.doesNotMatch(JSON.stringify({ safeCard: parsed.safeCard, insert }), /4242424242424242|\"cvv\"|\"pan\"/);
});

test("external future card flow rejects PAN in every persisted auxiliary field", () => {
  const designated = {
    cardNumber: "4242424242424242",
    cvv: "123",
    paymentDate: "2030-05-01",
  };
  assert.doesNotThrow(() => rejectExternalCardDataOutsideDesignatedFields(designated));
  for (const auxiliary of [
    { notes: "4242 4242 4242 4242" },
    { referenceNumber: "4242-4242-4242-4242" },
    { transactionid: "4242424242424242" },
    { requestId: "4242424242424242" },
    { idempotencyKey: "4242424242424242" },
    { paymentToken: "4242424242424242" },
    { transactionid: 4242424242424242 },
    { notes: "4242.4242.4242.4242" },
    { referenceNumber: "4242/4242/4242/4242" },
    { nested: { cc_number: "4242424242424242" } },
  ]) {
    assert.throws(
      () => rejectExternalCardDataOutsideDesignatedFields({ ...designated, ...auxiliary }),
      /Raw card data/,
    );
  }
});

test("external payment presenter exposes only explicitly approved fields", () => {
  const presented = presentExternalPayment({
    id: "payment-1",
    organizationId: "org-1",
    debtorId: "debtor-1",
    cardId: "card-1",
    amount: 1000,
    paymentDate: "2030-05-01",
    paymentMethod: "card",
    status: "pending",
    paymentToken: "processor-secret",
    notes: "private notes",
    unexpected: "sensitive",
  });
  assert.equal("paymentToken" in presented, false);
  assert.equal("notes" in presented, false);
  assert.equal("unexpected" in presented, false);
});

test("all internal payment presenters remove reusable payment credentials", () => {
  const payment = {
    id: "payment-1",
    organizationId: "org-1",
    debtorId: "debtor-1",
    batchId: null,
    cardId: null,
    amount: 1000,
    paymentDate: "2030-05-01",
    paymentMethod: "card",
    status: "pending",
    referenceNumber: null,
    paymentToken: "reusable-processor-token",
    processedBy: null,
    notes: null,
    frequency: "one_time",
    nextPaymentDate: null,
    specificDates: null,
    isRecurring: false,
    idempotencyKey: "payment-1",
    providerTransactionId: null,
    processingStartedAt: null,
    completedAt: null,
  };
  assert.equal("paymentToken" in redactPayment(payment), false);
  assert.equal("paymentToken" in redactPayments([payment])[0], false);
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