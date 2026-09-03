import assert from "node:assert/strict";
import test from "node:test";
import { generateScheduleRows } from "../shared/payment-schedule";
import { MemStorage } from "../server/storage";
import { readFileSync } from "node:fs";

test("monthly schedules retain their anchor and clamp only short months", () => {
  assert.deepEqual(
    generateScheduleRows(4, "10.00", "monthly", "2024-01-31").map(row => row.paymentDate),
    ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"],
  );
  assert.deepEqual(
    generateScheduleRows(3, "10.00", "monthly", "2023-01-30").map(row => row.paymentDate),
    ["2023-01-30", "2023-02-28", "2023-03-30"],
  );
});

test("weekly and bi-weekly schedules cross calendar boundaries", () => {
  assert.deepEqual(
    generateScheduleRows(3, "5", "weekly", "2024-12-25").map(row => row.paymentDate),
    ["2024-12-25", "2025-01-01", "2025-01-08"],
  );
  assert.equal(generateScheduleRows(2, "5", "bi_weekly", "2024-02-25")[1].paymentDate, "2024-03-10");
});

test("memory arrangements are atomic against balance and idempotent", async () => {
  const storage = new MemStorage();
  const debtor = await storage.createDebtor({
    organizationId: "arrangement-test-org",
    portfolioId: "portfolio",
    accountNumber: "account",
    firstName: "Test",
    lastName: "Debtor",
    originalBalance: 10000,
    currentBalance: 10000,
    status: "open",
  });
  const input = {
    organizationId: debtor.organizationId,
    debtorId: debtor.id,
    arrangementId: "arrangement-retry-1",
    paymentMethod: "ach",
    rows: [
      { amount: 2500, paymentDate: "2030-01-01" },
      { amount: 2500, paymentDate: "2030-02-01" },
    ],
  };
  const first = await storage.createPaymentArrangement(input);
  const retry = await storage.createPaymentArrangement(input);
  assert.deepEqual(retry.map(row => row.id), first.map(row => row.id));
  assert.equal((await storage.getPayments(debtor.id)).length, 2);
  assert.equal((await storage.getDebtor(debtor.id))?.currentBalance, 10000);
  await assert.rejects(
    storage.createPaymentArrangement({ ...input, rows: [{ amount: 1, paymentDate: "2031-01-01" }] }),
    /conflicts/,
  );

  await assert.rejects(
    storage.createPaymentArrangement({ ...input, arrangementId: "arrangement-too-large", rows: [
      { amount: 6000, paymentDate: "2030-01-01" },
      { amount: 6000, paymentDate: "2030-02-01" },
    ] }),
    /cannot exceed/,
  );
  assert.equal((await storage.getPayments(debtor.id)).length, 2);
  await assert.rejects(
    storage.createPaymentArrangement({
      ...input, arrangementId: "arrangement-over-remaining",
      rows: [{ amount: 6000, paymentDate: "2031-01-01" }, { amount: 1, paymentDate: "2031-02-01" }],
    }),
    /outstanding/,
  );
});

test("arrangement mutations change only pending rows and replay safely", async () => {
  const storage = new MemStorage();
  const debtor = await storage.createDebtor({
    organizationId: "manage-org", portfolioId: "portfolio", accountNumber: "managed",
    firstName: "Managed", lastName: "Debtor", originalBalance: 10000, currentBalance: 10000, status: "open",
  });
  const created = await storage.createPaymentArrangement({
    organizationId: debtor.organizationId, debtorId: debtor.id, arrangementId: "managed-arrangement",
    paymentMethod: "ach", rows: [
      { amount: 1000, paymentDate: "2030-01-01" },
      { amount: 1000, paymentDate: "2030-02-01" },
    ],
  });
  await storage.updatePayment(created[0].id, { status: "processed" });
  const input = {
    organizationId: debtor.organizationId, debtorId: debtor.id, arrangementId: "managed-arrangement",
    mutationId: "mutation-update-1", collectorId: "collector", action: "update" as const,
    rows: [{ id: created[1].id, amount: 1500, paymentDate: "2030-03-01" }],
  };
  const updated = await storage.mutatePaymentArrangement(input);
  assert.equal(updated[0].status, "processed");
  assert.equal(updated[0].amount, 1000);
  assert.equal(updated[1].amount, 1500);
  assert.equal(updated[1].paymentDate, "2030-03-01");
  assert.deepEqual(await storage.mutatePaymentArrangement(input), updated);
  await assert.rejects(
    storage.mutatePaymentArrangement({ ...input, rows: [{ ...input.rows[0], amount: 1600 }] }),
    /conflicts/,
  );
  const cancelled = await storage.mutatePaymentArrangement({
    ...input, mutationId: "mutation-cancel-1", action: "cancel", rows: undefined,
  });
  assert.equal(cancelled[0].status, "processed");
  assert.equal(cancelled[1].status, "cancelled");
});

test("arrangement updates revalidate the remaining available balance", async () => {
  const storage = new MemStorage();
  const debtor = await storage.createDebtor({
    organizationId: "balance-org", portfolioId: "portfolio", accountNumber: "balance",
    firstName: "Balance", lastName: "Debtor", originalBalance: 5000, currentBalance: 5000, status: "open",
  });
  const arrangement = await storage.createPaymentArrangement({
    organizationId: debtor.organizationId, debtorId: debtor.id, arrangementId: "balance-arrangement",
    paymentMethod: "ach", rows: [
      { amount: 1000, paymentDate: "2030-01-01" },
      { amount: 1000, paymentDate: "2030-02-01" },
    ],
  });
  await storage.createPayment({
    organizationId: debtor.organizationId, debtorId: debtor.id, amount: 2000,
    paymentDate: "2030-04-01", paymentMethod: "ach", status: "pending",
  });
  await assert.rejects(storage.mutatePaymentArrangement({
    organizationId: debtor.organizationId, debtorId: debtor.id, arrangementId: "balance-arrangement",
    mutationId: "mutation-over-balance", collectorId: "collector", action: "update",
    rows: arrangement.map(payment => ({ id: payment.id, amount: 1600, paymentDate: payment.paymentDate })),
  }), /cannot exceed/);
  assert.deepEqual((await storage.getPaymentArrangement(debtor.organizationId, debtor.id, "balance-arrangement")).map(row => row.amount), [1000, 1000]);
});

test("tracked arrangement management migration creates the audit idempotency store", () => {
  const migration = readFileSync("migrations/0006_payment_arrangement_management.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "payment_arrangement_audits"/);
  assert.match(migration, /"request_state" text NOT NULL/);
  assert.match(migration, /payment_arrangement_audits_org_mutation_unique/);
});

test("storage revalidates replacement cards inside arrangement mutation", async () => {
  const storage = new MemStorage();
  const debtor = await storage.createDebtor({
    organizationId: "card-recheck-org", portfolioId: "portfolio", accountNumber: "card-recheck",
    firstName: "Card", lastName: "Recheck", originalBalance: 5000, currentBalance: 5000, status: "open",
  });
  const merchant = await storage.createMerchant({
    organizationId: debtor.organizationId, name: "Gateway", merchantId: "gateway", processorType: "usaepay",
    usaepaySourceKey: "source", usaepayPin: "pin", isActive: true, testMode: true, createdDate: "2025-01-01",
  });
  const original = await storage.createPaymentCard({
    organizationId: debtor.organizationId, debtorId: debtor.id, cardType: "visa", cardholderName: "Card Recheck",
    cardNumberLast4: "4242", expiryMonth: "12", expiryYear: "2030", addedDate: "2025-01-01",
    processorType: "usaepay", processorToken: "original", vaultStatus: "vaulted", merchantId: merchant.id,
  });
  const replacement = await storage.createPaymentCard({
    organizationId: debtor.organizationId, debtorId: debtor.id, cardType: "visa", cardholderName: "Card Recheck",
    cardNumberLast4: "1111", expiryMonth: "12", expiryYear: "2031", addedDate: "2025-01-01",
    processorType: "usaepay", processorToken: "replacement", vaultStatus: "vaulted", merchantId: merchant.id,
  });
  const arrangement = await storage.createPaymentArrangement({
    organizationId: debtor.organizationId, debtorId: debtor.id, arrangementId: "card-recheck-arrangement",
    paymentMethod: "card", cardId: original.id,
    rows: [{ amount: 1000, paymentDate: "2030-01-01" }, { amount: 1000, paymentDate: "2030-02-01" }],
  });
  await storage.updateMerchant(merchant.id, { isActive: false });
  await assert.rejects(storage.mutatePaymentArrangement({
    organizationId: debtor.organizationId, debtorId: debtor.id, arrangementId: "card-recheck-arrangement",
    mutationId: "card-recheck-mutation", collectorId: "collector", action: "update", cardId: replacement.id,
    rows: arrangement.map(row => ({ id: row.id, amount: row.amount, paymentDate: row.paymentDate })),
  }), /active merchant/);
  assert.ok((await storage.getPaymentArrangement(debtor.organizationId, debtor.id, "card-recheck-arrangement"))
    .every(row => row.cardId === original.id));
});