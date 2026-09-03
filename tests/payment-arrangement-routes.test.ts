import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { registerPaymentArrangementRoutes } from "../server/payment-arrangement-routes";
import { MemStorage } from "../server/storage";

async function fixture() {
  const storage = new MemStorage();
  const org = "route-org";
  const other = "other-org";
  const debtor = await storage.createDebtor({ organizationId: org, portfolioId: "p", accountNumber: "a", firstName: "A", lastName: "B", originalBalance: 10000, currentBalance: 10000, status: "open" });
  const foreignDebtor = await storage.createDebtor({ organizationId: other, portfolioId: "p", accountNumber: "b", firstName: "C", lastName: "D", originalBalance: 10000, currentBalance: 10000, status: "open" });
  const merchant = await storage.createMerchant({ organizationId: org, name: "Gateway", merchantId: "gateway", processorType: "usaepay", usaepaySourceKey: "source", usaepayPin: "pin", isActive: true, testMode: true, createdDate: "2025-01-01" });
  const card = await storage.createPaymentCard({ organizationId: org, debtorId: debtor.id, cardType: "visa", cardholderName: "A B", cardNumberLast4: "4242", expiryMonth: "12", expiryYear: "2030", addedDate: "2025-01-01", processorType: "usaepay", processorToken: "token", vaultStatus: "vaulted", merchantId: merchant.id });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = req.headers["x-auth"] === "yes" ? { collector: { id: "collector", organizationId: org } } : {}; next(); });
  registerPaymentArrangementRoutes(app, storage);
  const server = await new Promise<any>(resolve => { const value = app.listen(0, () => resolve(value)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (id: string, body: any, auth = true) => fetch(`${base}/api/debtors/${id}/payment-arrangements`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { "x-auth": "yes" } : {}) }, body: JSON.stringify(body),
  });
  const manage = async (id: string, arrangementId: string, body: any, auth = true) => fetch(`${base}/api/debtors/${id}/payment-arrangements/${arrangementId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", ...(auth ? { "x-auth": "yes" } : {}) }, body: JSON.stringify(body),
  });
  return { storage, debtor, foreignDebtor, merchant, card, request, manage, close: () => new Promise<void>(resolve => server.close(resolve)) };
}

const rows = [{ amount: 1000, paymentDate: "2030-01-01" }, { amount: 1000, paymentDate: "2030-02-01" }];
test("arrangement route enforces tenant, raw-card, processing and row validation", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-auth-1", paymentMethod: "ach", rows }, false)).status, 401);
    assert.equal((await f.request(f.foreignDebtor.id, { arrangementId: "arr-tenant-1", paymentMethod: "ach", rows })).status, 403);
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-raw-1", paymentMethod: "ach", cardNumber: "4242424242424242", rows })).status, 400);
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-now-1", paymentMethod: "ach", processNow: true, rows })).status, 400);
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-bad-1", paymentMethod: "ach", rows: [{ amount: 1.5, paymentDate: "2030-02-30" }] })).status, 400);
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-over-1", paymentMethod: "ach", rows: [{ amount: 10000, paymentDate: "2030-01-01" }, { amount: 1, paymentDate: "2030-02-01" }] })).status, 400);
  } finally { await f.close(); }
});

test("arrangement management is tenant-scoped, immutable, and retry-safe", async () => {
  const f = await fixture();
  try {
    const created: any[] = await (await f.request(f.debtor.id, {
      arrangementId: "arr-manage-1", paymentMethod: "ach", rows,
    })).json();
    await f.storage.updatePayment(created[0].id, { status: "processing" });
    const update = {
      mutationId: "manage-retry-1", action: "update",
      rows: [{ id: created[1].id, amount: 1200, paymentDate: "2030-03-01" }],
    };
    assert.equal((await f.manage(f.debtor.id, "arr-manage-1", update, false)).status, 401);
    assert.equal((await f.manage(f.foreignDebtor.id, "arr-manage-1", update)).status, 403);
    const first = await f.manage(f.debtor.id, "arr-manage-1", update);
    assert.equal(first.status, 200);
    const updated: any[] = await first.json();
    assert.equal(updated[0].status, "processing");
    assert.equal(updated[0].amount, 1000);
    assert.equal(updated[1].amount, 1200);
    const replay: any[] = await (await f.manage(f.debtor.id, "arr-manage-1", update)).json();
    assert.deepEqual(replay.map(row => row.id), updated.map(row => row.id));
    assert.equal((await f.manage(f.debtor.id, "arr-manage-1", {
      ...update, rows: [{ ...update.rows[0], amount: 1300 }],
    })).status, 409);
    const cancelled: any[] = await (await f.manage(f.debtor.id, "arr-manage-1", {
      mutationId: "manage-cancel-1", action: "cancel",
    })).json();
    assert.equal(cancelled[0].status, "processing");
    assert.equal(cancelled[1].status, "cancelled");
  } finally { await f.close(); }
});

test("arrangement card replacement requires a debtor-owned active vault", async () => {
  const f = await fixture();
  try {
    const created: any[] = await (await f.request(f.debtor.id, {
      arrangementId: "arr-card-manage", paymentMethod: "card", cardId: f.card.id, rows,
    })).json();
    const replacement = await f.storage.createPaymentCard({
      organizationId: f.debtor.organizationId, debtorId: f.debtor.id, cardType: "visa",
      cardholderName: "A B", cardNumberLast4: "1111", expiryMonth: "12", expiryYear: "2031",
      addedDate: "2025-01-01", processorType: "usaepay", processorToken: "replacement-token",
      vaultStatus: "vaulted", merchantId: f.merchant.id,
    });
    const response = await f.manage(f.debtor.id, "arr-card-manage", {
      mutationId: "manage-card-replace", action: "update", cardId: replacement.id,
      rows: created.map(row => ({ id: row.id, amount: row.amount, paymentDate: row.paymentDate })),
    });
    const responseBody = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(responseBody));
    assert.ok((responseBody as any[]).every(row => row.cardId === replacement.id));
    const unvaulted = await f.storage.createPaymentCard({
      organizationId: f.debtor.organizationId, debtorId: f.debtor.id, cardType: "visa",
      cardholderName: "A B", cardNumberLast4: "2222", expiryMonth: "12", expiryYear: "2031",
      addedDate: "2025-01-01", vaultStatus: "legacy_unvaulted",
    });
    assert.equal((await f.manage(f.debtor.id, "arr-card-manage", {
      mutationId: "manage-card-invalid", action: "update", cardId: unvaulted.id,
      rows: created.map(row => ({ id: row.id, amount: row.amount, paymentDate: row.paymentDate })),
    })).status, 409);
  } finally { await f.close(); }
});

test("arrangement route validates bound cards and immutable replay", async () => {
  const f = await fixture();
  try {
    const base = { arrangementId: "arr-replay-1", paymentMethod: "card", cardId: f.card.id, rows };
    const first = await f.request(f.debtor.id, base);
    const firstRows: any[] = await first.json();
    const replay = await f.request(f.debtor.id, base);
    assert.equal(replay.status, 200);
    assert.deepEqual((await replay.json()).map((row: any) => row.id), firstRows.map(row => row.id));
    assert.equal((await f.request(f.debtor.id, { ...base, rows: [...rows].reverse() })).status, 409);
    assert.equal((await f.request(f.debtor.id, { ...base, paymentMethod: "ach", cardId: null })).status, 409);
    const foreign = await f.storage.createPaymentCard({ organizationId: "other-org", debtorId: f.foreignDebtor.id, cardType: "visa", cardholderName: "C D", cardNumberLast4: "4242", expiryMonth: "12", expiryYear: "2030", addedDate: "2025-01-01", processorType: "usaepay", processorToken: "x", vaultStatus: "vaulted", merchantId: f.merchant.id });
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-foreign-card", paymentMethod: "card", cardId: foreign.id, rows })).status, 400);
    const unvaulted = await f.storage.createPaymentCard({ organizationId: "route-org", debtorId: f.debtor.id, cardType: "visa", cardholderName: "A B", cardNumberLast4: "1111", expiryMonth: "12", expiryYear: "2030", addedDate: "2025-01-01", vaultStatus: "legacy_unvaulted" });
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-unvaulted", paymentMethod: "card", cardId: unvaulted.id, rows })).status, 409);
    const wrongMerchant = await f.storage.updatePaymentCard(f.card.id, { merchantId: "missing" });
    assert.ok(wrongMerchant);
    assert.equal((await f.request(f.debtor.id, { arrangementId: "arr-merchant", paymentMethod: "card", cardId: f.card.id, rows })).status, 409);
  } finally { await f.close(); }
});