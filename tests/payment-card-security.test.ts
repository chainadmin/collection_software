import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  buildExternalFutureCardPayment,
  externalOpaquePaymentToken,
  parseExternalFutureCard,
  presentExternalPayment,
  rejectExternalCardDataOutsideDesignatedFields,
} from "../server/external-api";
import { nextRecurringOccurrence, paymentPlanDates } from "../server/recurring-payments";
import { redactPaymentCard } from "../server/payment-card-presenter";
import { ambiguousGatewayResult, gatewayReferences } from "../server/payment-processor";
import { buildInternalPaymentInsert } from "../server/payment-input";
import { redactPayment, redactPayments } from "../server/payment-presenter";
import {
  chainCardIdentity,
  chainCredentialFingerprint,
  chainPaymentIdentity,
  chainPaymentConflicts,
  normalizeChainPaymentRequest,
  validateChainToken,
  verifyChainCredentialFingerprint,
} from "../server/chain-payment";
import { MemStorage } from "../server/storage";
import { CardVaultError, vaultCard } from "../server/card-vault";

function withTestFingerprintKey<T>(run: () => T): T {
  const prior = process.env.PAYMENT_FINGERPRINT_KEY;
  process.env.PAYMENT_FINGERPRINT_KEY = "unit-test-fingerprint-key";
  try {
    return run();
  } finally {
    if (prior === undefined) delete process.env.PAYMENT_FINGERPRINT_KEY;
    else process.env.PAYMENT_FINGERPRINT_KEY = prior;
  }
}

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

test("finite payment plans include the selected start date and requested payment count", () => {
  assert.deepEqual(paymentPlanDates("2026-09-04", "bi_weekly", 4), [
    "2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16",
  ]);
  assert.deepEqual(paymentPlanDates("2026-01-31", "monthly", 3), [
    "2026-01-31", "2026-02-28", "2026-03-31",
  ]);
  assert.throws(() => paymentPlanDates("2026-02-30", "weekly", 2), /Invalid/);
  assert.throws(() => paymentPlanDates("2026-09-04", "weekly", 121), /Invalid/);
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

test("Chain aliases and every paymentdata installment normalize deterministically", () => {
  const items = normalizeChainPaymentRequest({
    filenumber: "F-1",
    payorname: "Jane Doe",
    paymentmethod: "creditcard",
    cardnumber: "nmi_vault_abc123",
    invoice: "ARR-9",
    paymentdata: JSON.stringify([
      { paymentdate: "2030-01-01", paymentamount: "10.25", typeofpayment: "monthly" },
      { paymentDate: "2030-02-01", amount: 20.5, arrangementType: "monthly" },
    ]),
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(item => [item.fileNumber, item.amountCents, item.paymentMethod]), [
    ["F-1", 1025, "card"],
    ["F-1", 2050, "card"],
  ]);
  assert.equal(items[0].cardNumber, "nmi_vault_abc123");
  assert.equal(chainPaymentIdentity(items[0]), "chain:arr-9:2030-01-01");
  assert.equal(chainPaymentIdentity(items[1]), "chain:arr-9:2030-02-01");
});

test("Chain preserves a dated top-level installment alongside paymentdata", () => {
  const items = normalizeChainPaymentRequest({
    filenumber: "F-1",
    invoice: "ARR-10",
    paymentdate: "2030-01-01",
    paymentamount: "10",
    paymentdata: [{ paymentdate: "2030-02-01", paymentamount: "20" }],
  });
  assert.deepEqual(items.map(item => item.paymentDate), ["2030-01-01", "2030-02-01"]);
  assert.deepEqual(items.map(item => item.amountCents), [1000, 2000]);
});

test("all arrangement installments share one protected card reservation identity", () => {
  const items = normalizeChainPaymentRequest({
    filenumber: "F-1", invoice: "ARR-SHARED", cardnumber: "4242424242424242",
    paymentdata: [
      { paymentdate: "2030-01-01", paymentamount: "10" },
      { paymentdate: "2030-02-01", paymentamount: "20" },
      { paymentdate: "2030-03-01", paymentamount: "30" },
    ],
  });
  const identities = items.map(item => chainCardIdentity("org-1", item.invoice));
  const fingerprints = withTestFingerprintKey(() => items.map(item =>
    chainCredentialFingerprint("org-1", item.invoice, item.cardNumber)));
  assert.equal(new Set(identities).size, 1);
  assert.equal(new Set(fingerprints).size, 1);
  assert.notEqual(
    fingerprints[0],
    withTestFingerprintKey(() =>
      chainCredentialFingerprint("org-1", items[0].invoice, "5555555555554444")),
  );
});

test("Chain credential fingerprints are keyed, versioned, rotatable, and fail closed", () => {
  const saved = {
    current: process.env.PAYMENT_FINGERPRINT_KEY,
    session: process.env.SESSION_SECRET,
    previous: process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEYS,
    previousSingle: process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEY,
  };
  try {
    process.env.PAYMENT_FINGERPRINT_KEY = "current-test-key";
    delete process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEYS;
    delete process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEY;
    const current = chainCredentialFingerprint("org-1", "INV-1", "credential");
    assert.match(current, /^hmac-v1:[a-f0-9]{64}$/);
    assert.equal(current, chainCredentialFingerprint("org-1", "INV-1", "credential"));
    assert.equal(verifyChainCredentialFingerprint(current, "org-1", "INV-1", "credential"), true);

    process.env.PAYMENT_FINGERPRINT_KEY = "next-test-key";
    const next = chainCredentialFingerprint("org-1", "INV-1", "credential");
    assert.notEqual(next, current);
    process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEYS = JSON.stringify(["current-test-key"]);
    assert.equal(verifyChainCredentialFingerprint(current, "org-1", "INV-1", "credential"), true);
    const plainSha = createHash("sha256").update("org-1\u0000inv-1\u0000credential").digest("hex");
    assert.equal(verifyChainCredentialFingerprint(plainSha, "org-1", "INV-1", "credential"), false);

    delete process.env.PAYMENT_FINGERPRINT_KEY;
    delete process.env.SESSION_SECRET;
    delete process.env.PAYMENT_FINGERPRINT_PREVIOUS_KEYS;
    assert.throws(
      () => chainCredentialFingerprint("org-1", "INV-1", "credential"),
      /not configured/,
    );
  } finally {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("PAYMENT_FINGERPRINT_KEY", saved.current);
    restore("SESSION_SECRET", saved.session);
    restore("PAYMENT_FINGERPRINT_PREVIOUS_KEYS", saved.previous);
    restore("PAYMENT_FINGERPRINT_PREVIOUS_KEY", saved.previousSingle);
  }
});

test("raced payment immutable mismatches are conflicts, not duplicates", () => {
  const [item] = normalizeChainPaymentRequest({
    filenumber: "F-1", invoice: "ARR-RACE", cardnumber: "nmi_vault_same",
    paymentdate: "2030-01-01", paymentamount: "10",
  });
  assert.equal(chainPaymentConflicts({
    debtorId: "debtor-1", amount: 1000, paymentDate: "2030-01-01", paymentMethod: "card",
  }, item, "debtor-1"), false);
  assert.equal(chainPaymentConflicts({
    debtorId: "debtor-1", amount: 1100, paymentDate: "2030-01-01", paymentMethod: "card",
  }, item, "debtor-1"), true);
  assert.equal(chainPaymentConflicts({
    debtorId: "debtor-other", amount: 1000, paymentDate: "2030-01-01", paymentMethod: "card",
  }, item, "debtor-1"), true);
});

test("top-level Chain transaction metadata does not add an undated arrangement item", () => {
  const items = normalizeChainPaymentRequest({
    filenumber: "F-1", transactionid: "already-reported",
    invoice: "ARR-11",
    paymentdata: [{ paymentdate: "2030-02-01", paymentamount: "20" }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].paymentDate, "2030-02-01");
});

test("future card parsing uses the payment business date and allows explicitly due-today card charges", () => {
  const input = {
    cardNumber: "4242424242424242", expiryMonth: "12", expiryYear: "2030",
    cvv: "123", cardholderName: "Jane Doe", billingZip: "12345", amount: 5,
    paymentDate: "2030-05-01", idempotencyKey: "business-date-test",
  };
  assert.doesNotThrow(() => parseExternalFutureCard(input, new Date("2030-05-01T12:00:00Z"), true));
  assert.throws(
    () => parseExternalFutureCard({ ...input, paymentDate: "2030-04-30" }, new Date("2030-05-01T12:00:00Z"), true),
    /cannot be in the past/,
  );
});

test("Chain token formats are bound to the active merchant", () => {
  const base = { isActive: true } as any;
  assert.deepEqual(validateChainToken(
    { ...base, processorType: "nmi", nmiSecurityKey: "configured" },
    "nmi_vault_abc123",
  ), { processorToken: "nmi_vault_abc123", customerId: "nmi_vault_abc123" });
  assert.deepEqual(validateChainToken(
    { ...base, processorType: "authorize_net", authorizeNetApiLoginId: "login", authorizeNetTransactionKey: "key" },
    "12345|67890",
  ), { processorToken: "67890", customerId: "12345" });
  assert.deepEqual(validateChainToken(
    { ...base, processorType: "stripe", stripeSecretKey: "configured" },
    "cus_customer1|pm_payment1",
  ), { processorToken: "pm_payment1", customerId: "cus_customer1" });
  assert.throws(() => validateChainToken(
    { ...base, processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: null },
    "savedcard_key",
  ), /invalid for the active processor/);
  assert.throws(() => validateChainToken(
    { ...base, processorType: "nmi", nmiSecurityKey: "configured" },
    "4242424242424242",
  ), /invalid for the active processor/);
});

test("posted Chain notifications retain transaction identity and do not require card data", () => {
  const [item] = normalizeChainPaymentRequest({
    filenumber: "F-1",
    paymentdate: "2030-03-02",
    paymentamount: 15,
    paymentstatus: "POSTED",
    transactionid: "txn-chain-1",
  });
  assert.equal(item.paymentStatus, "posted");
  assert.equal(item.transactionId, "txn-chain-1");
  assert.equal(item.cardNumber, "");
  assert.equal(chainPaymentIdentity(item), "chain:txn-chain-1:2030-03-02");
});

test("storage identities reject concurrent arrangement and vault duplicates per tenant", async () => {
  const store = new MemStorage();
  const payment = {
    organizationId: "org-a", debtorId: "debtor-a", amount: 1000,
    paymentDate: "2030-01-01", paymentMethod: "card", status: "pending",
    idempotencyKey: "chain:arr:2030-01-01",
  };
  const paymentResults = await Promise.allSettled([
    store.createPayment(payment),
    store.createPayment(payment),
  ]);
  assert.equal(paymentResults.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(paymentResults.filter(result => result.status === "rejected").length, 1);
  await assert.doesNotReject(() => store.createPayment({ ...payment, organizationId: "org-b" }));

  const card = {
    organizationId: "org-a", debtorId: "debtor-a", cardType: "visa",
    cardholderName: "Jane Doe", cardNumberLast4: "4242", expiryMonth: "12",
    expiryYear: "2030", addedDate: "2026-01-01",
    externalIdempotencyKey: "chain-card:one",
  };
  const cardResults = await Promise.allSettled([
    store.createPaymentCard(card),
    store.createPaymentCard(card),
  ]);
  assert.equal(cardResults.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(cardResults.filter(result => result.status === "rejected").length, 1);
});

test("recursive Chain screening rejects PAN hidden in paymentdata invoice fields", () => {
  assert.throws(() => rejectExternalCardDataOutsideDesignatedFields({
    paymentdata: [{ cardnumber: "4242424242424242", cvv: "123", invoice: "4242 4242 4242 4242" }],
  }), /Raw card data/);
  assert.doesNotThrow(() => rejectExternalCardDataOutsideDesignatedFields({
    paymentdata: JSON.stringify([{ cardnumber: "4242424242424242", cvv: "123", invoice: "INV-1" }]),
  }));
});

test("USAePay vault uses documented cc:save transaction contract", async () => {
  const originalFetch = globalThis.fetch;
  let request: any;
  globalThis.fetch = (async (url: string, init: any) => {
    request = { url, init };
    return { ok: true, json: async () => ({ result_code: "A", savedcard: { key: "saved_card_123" } }) } as any;
  }) as typeof fetch;
  try {
    const vaulted = await vaultCard(
      { processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: "pin", testMode: true } as any,
      { id: "debtor-1" } as any,
      { pan: "4242424242424242", cvv: "123", expiryMonth: "12", expiryYear: "2030", cardholderName: "Jane Doe", billingZip: "12345" },
    );
    assert.equal(request.url, "https://sandbox.usaepay.com/api/v2/transactions");
    assert.equal(request.init.method, "POST");
    assert.deepEqual(JSON.parse(request.init.body), {
      command: "cc:save",
      creditcard: { cardholder: "Jane Doe", number: "4242424242424242", expiration: "1230", cvc: "123", avs_zip: "12345" },
    });
    assert.equal(vaulted.processorToken, "saved_card_123");
    assert.equal(vaulted.processorCustomerId, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("USAePay vault treats transport failures as ambiguous and non-approvals as failures", async () => {
  const originalFetch = globalThis.fetch;
  const merchant = { processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: "pin", testMode: true } as any;
  const card = { pan: "4242424242424242", cvv: "123", expiryMonth: "12", expiryYear: "2030", cardholderName: "Jane Doe", billingZip: "12345" };
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as typeof fetch;
  await assert.rejects(() => vaultCard(merchant, { id: "debtor-1" } as any, card), (error: any) =>
    error instanceof CardVaultError && /uncertain/.test(error.message));
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ result_code: "D" }) })) as typeof fetch;
  await assert.rejects(() => vaultCard(merchant, { id: "debtor-1" } as any, card), (error: any) =>
    error instanceof CardVaultError && /failed/.test(error.message));
  globalThis.fetch = originalFetch;
});

test("concurrent two-date arrangement retry reuses one vault and becomes runner eligible", async () => {
  const store = new MemStorage();
  const items = normalizeChainPaymentRequest({
    filenumber: "F-1", invoice: "ARR-CONCURRENT", cardnumber: "4242424242424242",
    paymentdata: [
      { paymentdate: "2030-06-01", paymentamount: "10" },
      { paymentdate: "2030-07-01", paymentamount: "20" },
    ],
  });
  const reservations = await Promise.all(items.map(item => store.createPayment({
    organizationId: "org-1", debtorId: "debtor-1", amount: item.amountCents,
    paymentDate: item.paymentDate, paymentMethod: "card", status: "needs_review",
    idempotencyKey: chainPaymentIdentity(item),
  })));
  const sharedIdentity = chainCardIdentity("org-1", items[0].invoice);
  assert.equal(sharedIdentity, chainCardIdentity("org-1", items[1].invoice));
  const fingerprint = withTestFingerprintKey(() =>
    chainCredentialFingerprint("org-1", items[0].invoice, items[0].cardNumber));
  let card = await store.createPaymentCard({
    organizationId: "org-1", debtorId: "debtor-1", cardType: "visa",
    cardholderName: "Jane Doe", cardNumberLast4: "4242", expiryMonth: "12",
    expiryYear: "2030", addedDate: "2026-01-01", processorType: "usaepay",
    vaultStatus: "vaulting", externalIdempotencyKey: sharedIdentity,
    externalCredentialFingerprint: fingerprint,
  });

  const originalFetch = globalThis.fetch;
  let vaultCalls = 0;
  globalThis.fetch = (async () => {
    vaultCalls++;
    return { ok: true, json: async () => ({ result_code: "A", savedcard: { key: "saved_card_once" } }) } as any;
  }) as typeof fetch;
  try {
    const vaulted = await vaultCard(
      { processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: "pin", testMode: true } as any,
      { id: "debtor-1" } as any,
      { pan: "4242424242424242", cvv: "123", expiryMonth: "12", expiryYear: "2030", cardholderName: "Jane Doe", billingZip: "12345" },
    );
    card = (await store.updatePaymentCard(card.id, { ...vaulted, vaultStatus: "vaulted" }))!;
    // Retry the reservation that lost while the shared card was vaulting.
    const resumed = await store.updatePayment(reservations[1].id, { cardId: card.id, status: "pending" });
    // The first installment attaches the exact same protected card as well.
    const first = await store.updatePayment(reservations[0].id, { cardId: card.id, status: "pending" });
    assert.equal(vaultCalls, 1);
    assert.equal(first?.cardId, resumed?.cardId);
    assert.equal(resumed?.status, "pending");
    assert.equal((await store.getPendingPayments("org-1")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("concurrent due-today reservation recovery has one promotion winner and no status regression", async () => {
  const store = new MemStorage();
  const reservation = await store.createPayment({
    organizationId: "org-1", debtorId: "debtor-1", amount: 2500,
    paymentDate: "2030-08-01", paymentMethod: "card", status: "needs_review",
    idempotencyKey: "chain:arr-due:2030-08-01",
  });
  const card = await store.createPaymentCard({
    organizationId: "org-1", debtorId: "debtor-1", cardType: "visa",
    cardholderName: "Jane Doe", cardNumberLast4: "4242", expiryMonth: "12",
    expiryYear: "2030", addedDate: "2026-01-01", processorType: "usaepay",
    processorToken: "saved_card_once", vaultStatus: "vaulted",
    externalIdempotencyKey: "chain-card:due",
    externalCredentialFingerprint: "fingerprint",
  });
  let gatewayCalls = 0;
  const retry = async () => {
    const promoted = await store.promoteChainPaymentReservation(
      reservation.id, "org-1", card.id,
    );
    if (!promoted) return "lost";
    gatewayCalls++;
    await store.updatePayment(promoted.id, {
      status: "processed", providerTransactionId: "txn-once",
    });
    await store.updatePayment(promoted.id, { status: "posted" });
    return "won";
  };
  const results = await Promise.all([retry(), retry()]);
  assert.deepEqual(results.sort(), ["lost", "won"]);
  assert.equal(gatewayCalls, 1);
  assert.equal((await store.getPayment(reservation.id))?.status, "posted");
  assert.equal(
    await store.promoteChainPaymentReservation(reservation.id, "org-1", card.id),
    undefined,
  );
  assert.equal((await store.getPayment(reservation.id))?.status, "posted");

  const declined = await store.createPayment({
    organizationId: "org-1", debtorId: "debtor-1", amount: 1000,
    paymentDate: "2030-08-01", paymentMethod: "card", status: "declined",
    idempotencyKey: "chain:declined:2030-08-01",
  });
  assert.equal(
    await store.promoteChainPaymentReservation(declined.id, "org-1", card.id),
    undefined,
  );
  assert.equal((await store.getPayment(declined.id))?.status, "declined");
});
