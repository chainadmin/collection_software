import assert from "node:assert/strict";
import test from "node:test";
import type { Merchant, Payment, PaymentCard } from "../shared/schema";
import type { IStorage } from "../server/storage";
import { processPayment, selectActiveMerchant } from "../server/payment-processor";
import {
  classifyAuthorizeNetDisposition,
  isPotentialDuplicateGatewayMessage,
} from "../server/payment-gateway-result";
import { AutoPaymentRunRegistry, type RunResult } from "../server/auto-payment-runner";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    organizationId: "org-1",
    debtorId: "debtor-1",
    batchId: null,
    cardId: null,
    amount: 2500,
    paymentDate: "2026-09-08",
    paymentMethod: "card",
    status: "processing",
    referenceNumber: null,
    paymentToken: null,
    processedBy: "system",
    notes: null,
    frequency: "one_time",
    nextPaymentDate: null,
    specificDates: null,
    isRecurring: false,
    idempotencyKey: "payment-1",
    providerTransactionId: null,
    processingStartedAt: new Date("2026-09-08T12:00:00Z"),
    completedAt: null,
    arrangementId: null,
    arrangementIndex: null,
    ...overrides,
  };
}

function savedCardStorage(
  source: Payment,
  processorType: "nmi" | "usaepay",
  onUpdate: (update: Partial<Payment>) => void,
): IStorage {
  const merchant = {
    id: "merchant-1",
    organizationId: "org-1",
    processorType,
    isActive: true,
    testMode: true,
    nmiSecurityKey: processorType === "nmi" ? "test-security-key" : null,
    usaepaySourceKey: processorType === "usaepay" ? "test-source-key" : null,
    usaepayPin: processorType === "usaepay" ? "test-pin" : null,
  };
  const card = {
    id: "card-1",
    organizationId: "org-1",
    debtorId: "debtor-1",
    merchantId: "merchant-1",
    processorType,
    processorToken: "test-vault-token",
    processorCustomerId: null,
    vaultStatus: "vaulted",
  };
  return {
    getDebtor: async () => ({ id: "debtor-1", organizationId: "org-1" }),
    getMerchants: async () => [merchant],
    getPaymentCard: async () => card,
    updatePayment: async (_id: string, update: Partial<Payment>) => {
      onUpdate(update);
      return { ...source, ...update };
    },
    updateDebtor: async () => ({ id: "debtor-1", organizationId: "org-1" }),
    createNote: async () => ({}),
    getOrganization: async () => undefined,
  } as unknown as IStorage;
}

test("locally stored cards follow the currently active merchant after configuration rotation", () => {
  const oldMerchant = {
    id: "merchant-old",
    processorType: "nmi",
    isActive: false,
    nmiSecurityKey: "old-security-key",
  } as Merchant;
  const activeMerchant = {
    id: "merchant-active",
    processorType: "nmi",
    isActive: true,
    nmiSecurityKey: "active-security-key",
  } as Merchant;
  const localCard = {
    merchantId: oldMerchant.id,
    processorType: "nmi",
    vaultStatus: "locally_stored",
  } as PaymentCard;

  assert.equal(selectActiveMerchant([oldMerchant, activeMerchant], localCard), activeMerchant);
});

test("vaulted cards remain bound to the active merchant that issued their token", () => {
  const oldMerchant = {
    id: "merchant-old",
    processorType: "nmi",
    isActive: false,
    nmiSecurityKey: "old-security-key",
  } as Merchant;
  const activeMerchant = {
    id: "merchant-active",
    processorType: "nmi",
    isActive: true,
    nmiSecurityKey: "active-security-key",
  } as Merchant;
  const vaultedCard = {
    merchantId: oldMerchant.id,
    processorType: "nmi",
    vaultStatus: "vaulted",
  } as PaymentCard;

  assert.equal(selectActiveMerchant([oldMerchant, activeMerchant], vaultedCard), undefined);
});

test("payment processing rejects invalid cent amounts before any account or gateway lookup", async () => {
  const source = payment({ amount: 0 });
  let persisted: Partial<Payment> | undefined;
  const storage = {
    getDebtor: async () => {
      throw new Error("account lookup must not run");
    },
    getMerchants: async () => {
      throw new Error("gateway lookup must not run");
    },
    updatePayment: async (_id: string, update: Partial<Payment>) => {
      persisted = update;
      return { ...source, ...update };
    },
  } as unknown as IStorage;

  const result = await processPayment(source, storage, "org-1");

  assert.equal(result.success, false);
  assert.equal(result.ambiguous, undefined);
  assert.equal(persisted?.status, "declined");
  assert.match(result.declineReason || "", /positive whole number of cents/);
});

test("payment processing rejects a foreign account before selecting a merchant", async () => {
  const source = payment();
  let gatewayLookupRan = false;
  let persisted: Partial<Payment> | undefined;
  const storage = {
    getDebtor: async () => ({ id: "debtor-1", organizationId: "org-2" }),
    getMerchants: async () => {
      gatewayLookupRan = true;
      return [];
    },
    updatePayment: async (_id: string, update: Partial<Payment>) => {
      persisted = update;
      return { ...source, ...update };
    },
  } as unknown as IStorage;

  const result = await processPayment(source, storage, "org-1");

  assert.equal(result.success, false);
  assert.equal(gatewayLookupRan, false);
  assert.equal(persisted?.status, "declined");
  assert.match(result.declineReason || "", /does not belong/);
});

test("duplicate-like gateway responses are treated as uncertain outcomes", () => {
  assert.equal(isPotentialDuplicateGatewayMessage("A duplicate transaction has been submitted."), true);
  assert.equal(isPotentialDuplicateGatewayMessage("Payment was already processed"), true);
  assert.equal(isPotentialDuplicateGatewayMessage("Previously submitted request"), true);
  assert.equal(isPotentialDuplicateGatewayMessage("Insufficient funds"), false);
  assert.equal(isPotentialDuplicateGatewayMessage("Invalid account number"), false);
});

test("Authorize.Net requires an explicit approval and quarantines held or duplicate results", () => {
  assert.equal(classifyAuthorizeNetDisposition("1", true, null), "approved");
  assert.equal(classifyAuthorizeNetDisposition("2", false, "Insufficient funds"), "declined");
  assert.equal(classifyAuthorizeNetDisposition("3", false, "Invalid account number"), "declined");
  assert.equal(classifyAuthorizeNetDisposition("4", true, "Held for review"), "ambiguous");
  assert.equal(classifyAuthorizeNetDisposition("3", false, "Duplicate transaction"), "ambiguous");
  assert.equal(classifyAuthorizeNetDisposition(undefined, false, "API error"), "ambiguous");
});

test("NMI saved-card duplicate response persists as needs_review", async () => {
  const source = payment({ cardId: "card-1" });
  let persisted: Partial<Payment> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    "response=3&responsetext=Duplicate+transaction&transactionid=txn-duplicate",
    { status: 200 },
  );
  try {
    const result = await processPayment(source, savedCardStorage(source, "nmi", update => {
      persisted = update;
    }), "org-1");
    assert.equal(result.success, false);
    assert.equal(result.ambiguous, true);
    assert.equal(persisted?.status, "needs_review");
    assert.equal(persisted?.providerTransactionId, "txn-duplicate");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("USAePay saved-card duplicate response persists as needs_review", async () => {
  const source = payment({ cardId: "card-1" });
  let persisted: Partial<Payment> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    result_code: "E",
    error: "Transaction already processed",
    refnum: "txn-duplicate",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  try {
    const result = await processPayment(source, savedCardStorage(source, "usaepay", update => {
      persisted = update;
    }), "org-1");
    assert.equal(result.success, false);
    assert.equal(result.ambiguous, true);
    assert.equal(persisted?.status, "needs_review");
    assert.equal(persisted?.providerTransactionId, "txn-duplicate");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("USAePay authentication errors are reported as configuration errors before transaction creation", async () => {
  const source = payment({ cardId: "card-1" });
  let persisted: Partial<Payment> | undefined;
  let requestedUrl = "";
  let requestedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ error: "Invalid source key or pin" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await processPayment(source, savedCardStorage(source, "usaepay", update => {
      persisted = update;
    }), "org-1");
    assert.equal(result.success, false);
    assert.equal(result.ambiguous, undefined);
    assert.equal(result.configurationError, true);
    assert.equal(requestedUrl, "https://usaepay.com/api/v2/transactions");
    assert.equal(requestedBody.command, "cc:sale");
    assert.equal(persisted?.status, "pending");
    assert.match(persisted?.notes || "", /^PROCESSING ERROR:/);
    assert.match(result.declineReason || "", /authentication layer.*live.*before a sale was created.*HTTP 401.*transaction history.*production REST API.*transaction API.*Invalid source key or pin/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("USAePay server errors remain quarantined as needs_review", async () => {
  const source = payment({ cardId: "card-1" });
  let persisted: Partial<Payment> | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("gateway unavailable", { status: 503 });
  try {
    const result = await processPayment(source, savedCardStorage(source, "usaepay", update => {
      persisted = update;
    }), "org-1");
    assert.equal(result.ambiguous, true);
    assert.equal(persisted?.status, "needs_review");
    assert.match(result.declineReason || "", /HTTP 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("automatic runner state and results are isolated by organization", () => {
  const registry = new AutoPaymentRunRegistry();
  const orgAResult: RunResult = {
    runTime: "2026-09-08T12:00:00.000Z",
    totalProcessed: 1,
    totalSuccess: 1,
    totalDeclined: 0,
    totalNeedsReview: 0,
    totalSkipped: 0,
    orgResults: {
      "org-a": {
        orgName: "Agency A",
        processed: 1,
        success: 1,
        declined: 0,
        skipped: false,
      },
    },
  };

  assert.equal(registry.tryStart("org-a"), true);
  assert.equal(registry.tryStart("org-a"), false);
  assert.equal(registry.getStatus("org-a").isRunning, true);
  assert.equal(registry.getStatus("org-b").isRunning, false);

  registry.finish("org-a", orgAResult, orgAResult.runTime);

  assert.equal(registry.getStatus("org-a").lastRunResult, orgAResult);
  assert.equal(registry.getStatus("org-b").lastRunResult, null);
  assert.equal(registry.getStatus("org-b").lastRunTimestamp, null);
});
