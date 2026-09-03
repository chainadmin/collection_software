import assert from "node:assert/strict";
import test from "node:test";
import { generateScheduleRows } from "../shared/payment-schedule";
import { MemStorage } from "../server/storage";

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