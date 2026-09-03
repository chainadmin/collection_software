import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { registerPaymentCardRoutes } from "../server/payment-card-routes";
import { chainCredentialFingerprint } from "../server/chain-payment";
import { MemStorage } from "../server/storage";
import { CardVaultError } from "../server/card-vault";

const body = {
  cardType: "visa", cardNumber: "4242424242424242", cvv: "123",
  expiryMonth: "12", expiryYear: "2030", cardholderName: "Jane Doe", billingZip: "12345",
};

async function fixture(vault: any) {
  process.env.PAYMENT_FINGERPRINT_KEY = "card-route-test-key";
  const storage = new MemStorage();
  const debtor = await storage.createDebtor({ organizationId: "card-org", portfolioId: "p", accountNumber: "a", firstName: "Jane", lastName: "Doe", originalBalance: 10000, currentBalance: 10000, status: "open" });
  const foreign = await storage.createDebtor({ organizationId: "foreign-org", portfolioId: "p", accountNumber: "b", firstName: "F", lastName: "D", originalBalance: 10000, currentBalance: 10000, status: "open" });
  const merchant = await storage.createMerchant({ organizationId: "card-org", name: "Gateway", merchantId: "gateway", processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: "pin", isActive: true, testMode: true, createdDate: "2025-01-01" });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = req.headers["x-auth"] ? { collector: { id: "collector", organizationId: "card-org" } } : {}; next(); });
  registerPaymentCardRoutes(app, storage, { vaultCard: vault });
  const server = await new Promise<any>(resolve => { const listening = app.listen(0, () => resolve(listening)); });
  const request = (id: string, requestBody: any, key = "stable-card-key", auth = true) => fetch(`http://127.0.0.1:${server.address().port}/api/debtors/${id}/cards`, {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...(auth ? { "x-auth": "yes" } : {}) }, body: JSON.stringify(requestBody),
  });
  return { storage, debtor, foreign, merchant, request, close: () => new Promise<void>(resolve => server.close(resolve)) };
}

test("card vault HTTP route is tenant protected, idempotent, conflict safe, and redacted", async () => {
  let calls = 0;
  const f = await fixture(async () => {
    calls++;
    return { processorType: "usaepay", processorToken: "processor-secret", processorCustomerId: "customer-secret", vaultStatus: "vaulted" };
  });
  try {
    assert.equal((await f.request(f.debtor.id, body, "unauth-card", false)).status, 401);
    assert.equal((await f.request(f.foreign.id, body, "foreign-card")).status, 403);
    const first = await f.request(f.debtor.id, body);
    assert.equal(first.status, 201);
    const firstCard: any = await first.json();
    const replay = await f.request(f.debtor.id, body);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).id, firstCard.id);
    assert.equal(calls, 1);
    const changed = await f.request(f.debtor.id, { ...body, cardNumber: "5555555555554444", cardType: "mastercard" });
    assert.equal(changed.status, 409);
    const changedExpiry = await f.request(f.debtor.id, { ...body, expiryYear: "2031" });
    assert.equal(changedExpiry.status, 409);
    assert.equal(calls, 1);
    const serialized = JSON.stringify(firstCard);
    assert.doesNotMatch(serialized, /processor-secret|customer-secret|4242424242424242|externalCredentialFingerprint|externalIdempotencyKey|cvv/i);
  } finally { await f.close(); }
});

test("vaulting reservation replay never calls processor", async () => {
  let calls = 0;
  const f = await fixture(async () => { calls++; throw new Error("must not run"); });
  try {
    const key = "already-vaulting-key";
    await f.storage.createPaymentCard({
      organizationId: "card-org", debtorId: f.debtor.id, cardType: "visa", cardholderName: "Jane Doe",
      cardNumberLast4: "4242", expiryMonth: "12", expiryYear: "2030", billingZip: "12345",
      processorType: "usaepay", merchantId: f.merchant.id, vaultStatus: "vaulting",
      externalIdempotencyKey: `ui-card:${key}`,
      externalCredentialFingerprint: chainCredentialFingerprint("card-org", `ui-card:${key}`, "4242424242424242"),
      addedDate: "2025-01-01", isDefault: false,
    });
    assert.equal((await f.request(f.debtor.id, body, key)).status, 409);
    assert.equal(calls, 0);
  } finally { await f.close(); }
});

test("vault failure preserves the prior usable default", async () => {
  const f = await fixture(async () => { throw new CardVaultError("declined"); });
  try {
    const previous = await f.storage.createPaymentCard({
      organizationId: "card-org", debtorId: f.debtor.id, cardType: "visa", cardholderName: "Jane Doe",
      cardNumberLast4: "1111", expiryMonth: "12", expiryYear: "2030", processorType: "usaepay",
      processorToken: "old-token", merchantId: f.merchant.id, vaultStatus: "vaulted",
      addedDate: "2025-01-01", isDefault: true,
    });
    assert.equal((await f.request(f.debtor.id, body, "failed-vault-key")).status, 422);
    assert.equal((await f.storage.getPaymentCard(previous.id))?.isDefault, true);
    const failed = (await f.storage.getPaymentCards(f.debtor.id)).find(card => card.externalIdempotencyKey === "ui-card:failed-vault-key");
    assert.equal(failed?.isDefault, false);
    assert.equal(failed?.vaultStatus, "vault_failed");
  } finally { await f.close(); }
});

test("customer profile reuse is bound to both merchant and processor", async () => {
  let receivedCustomer: string | undefined;
  const f = await fixture(async (_merchant: any, _debtor: any, _card: any, customer: string | undefined) => {
    receivedCustomer = customer;
    return { processorType: "usaepay", processorToken: "new-token", processorCustomerId: null, vaultStatus: "vaulted" };
  });
  try {
    await f.storage.createPaymentCard({
      organizationId: "card-org", debtorId: f.debtor.id, cardType: "visa", cardholderName: "Jane Doe",
      cardNumberLast4: "1111", expiryMonth: "12", expiryYear: "2030",
      merchantId: f.merchant.id, processorType: "nmi", processorToken: "old-token",
      processorCustomerId: "old-customer-profile", vaultStatus: "vaulted",
      addedDate: "2025-01-01", isDefault: true,
    });
    assert.equal((await f.request(f.debtor.id, body, "processor-change-key")).status, 201);
    assert.equal(receivedCustomer, undefined);
  } finally { await f.close(); }
});