import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { registerPaymentCardRoutes } from "../server/payment-card-routes";
import { MemStorage } from "../server/storage";

const body = {
  cardType: "visa", cardNumber: "4242424242424242", cvv: "123",
  expiryMonth: "12", expiryYear: "2030", cardholderName: "Jane Doe", billingZip: "12345",
};

async function fixture() {
  process.env.PAYMENT_FINGERPRINT_KEY = "card-route-test-key";
  process.env.PAYMENT_CARD_ENCRYPTION_KEY = "card-route-encryption-key-for-unit-tests";
  const storage = new MemStorage();
  const debtor = await storage.createDebtor({ organizationId: "card-org", portfolioId: "p", accountNumber: "a", firstName: "Jane", lastName: "Doe", originalBalance: 10000, currentBalance: 10000, status: "open" });
  const foreign = await storage.createDebtor({ organizationId: "foreign-org", portfolioId: "p", accountNumber: "b", firstName: "F", lastName: "D", originalBalance: 10000, currentBalance: 10000, status: "open" });
  await storage.createMerchant({ organizationId: "card-org", name: "Gateway", merchantId: "gateway", processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: "pin", isActive: true, testMode: true, createdDate: "2025-01-01" });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = req.headers["x-auth"] ? { collector: { id: "collector", organizationId: "card-org" } } : {}; next(); });
  registerPaymentCardRoutes(app, storage);
  const server = await new Promise<any>(resolve => { const listening = app.listen(0, () => resolve(listening)); });
  const request = (id: string, requestBody: any, key = "stable-card-key", auth = true) => fetch(`http://127.0.0.1:${server.address().port}/api/debtors/${id}/cards`, {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...(auth ? { "x-auth": "yes" } : {}) }, body: JSON.stringify(requestBody),
  });
  return { storage, debtor, foreign, request, close: () => new Promise<void>(resolve => server.close(resolve)) };
}

test("every saved payment card is encrypted locally without a gateway setup call", async () => {
  const f = await fixture();
  try {
    const response = await f.request(f.debtor.id, body, "local-card-key");
    assert.equal(response.status, 201);
    const presented: any = await response.json();
    assert.equal(presented.vaultStatus, "locally_stored");
    const stored = await f.storage.getPaymentCard(presented.id);
    assert.equal(stored?.processorToken, null);
    assert.equal(stored?.processorCustomerId, null);
    assert.ok(stored?.encryptedCardNumber);
    assert.notEqual(stored?.encryptedCardNumber, body.cardNumber);
    assert.doesNotMatch(JSON.stringify(stored), /"cvv"|4242424242424242/);
  } finally { await f.close(); }
});

test("local card save is tenant protected, idempotent, and conflict safe", async () => {
  const f = await fixture();
  try {
    const tokenizedBody = { ...body, saveWithoutTokenization: false };
    assert.equal((await f.request(f.debtor.id, tokenizedBody, "unauth-card", false)).status, 401);
    assert.equal((await f.request(f.foreign.id, tokenizedBody, "foreign-card")).status, 403);
    const first = await f.request(f.debtor.id, tokenizedBody);
    assert.equal(first.status, 201);
    const saved: any = await first.json();
    const replay = await f.request(f.debtor.id, body);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).id, saved.id);
    assert.equal((await f.request(f.debtor.id, { ...body, expiryYear: "2031" })).status, 409);
  } finally { await f.close(); }
});

test("CVV is validated but never retained", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request(f.debtor.id, { ...body, cvv: "1" }, "bad-cvv-key")).status, 400);
    const response = await f.request(f.debtor.id, body, "good-cvv-key");
    const presented = await response.json() as Record<string, unknown>;
    assert.equal(presented.cvv, undefined);
  } finally { await f.close(); }
});
