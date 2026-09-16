import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "../server/storage";

test("getPendingPayments returns every payment whose status is pending", async () => {
  const storage = new MemStorage();
  const org = "pending-declined-org";
  const debtor = await storage.createDebtor({
    organizationId: org, portfolioId: "p", accountNumber: "a",
    firstName: "A", lastName: "B", originalBalance: 10000, currentBalance: 10000, status: "open",
  });

  const untouched = await storage.createPayment({
    organizationId: org, debtorId: debtor.id, amount: 1000,
    paymentDate: "2030-01-01", paymentMethod: "ach", status: "pending",
  });

  // completedAt and notes must not create a hidden eligibility rule. Status
  // is the single source of truth for membership in the pending queue.
  const previouslyAttempted = await storage.createPayment({
    organizationId: org, debtorId: debtor.id, amount: 2000,
    paymentDate: "2030-01-01", paymentMethod: "ach", status: "pending",
  });
  await storage.updatePayment(previouslyAttempted.id, {
    status: "pending",
    completedAt: new Date(),
    notes: "DECLINED: Insufficient funds",
  });

  const pending = await storage.getPendingPayments(org);
  assert.deepEqual(pending.map(p => p.id), [untouched.id, previouslyAttempted.id]);
});

test("scheduled selection is date-exact and adds declines only on the second run", async () => {
  const storage = new MemStorage();
  const base = {
    organizationId: "org", debtorId: "debtor", amount: 1000,
    paymentMethod: "ach", status: "pending",
  } as const;
  const yesterday = await storage.createPayment({ ...base, paymentDate: "2030-01-01" });
  const today = await storage.createPayment({ ...base, paymentDate: "2030-01-02" });
  const tomorrow = await storage.createPayment({ ...base, paymentDate: "2030-01-03" });
  await storage.updatePayment(yesterday.id, { status: "declined" });
  const declinedToday = await storage.createPayment({ ...base, paymentDate: "2030-01-02" });
  await storage.updatePayment(declinedToday.id, { status: "declined" });

  const firstRun = await storage.getPaymentsScheduledForRun("2030-01-02", false);
  assert.deepEqual(firstRun.map(payment => payment.id), [today.id]);

  const secondRun = await storage.getPaymentsScheduledForRun("2030-01-02", true);
  assert.deepEqual(new Set(secondRun.map(payment => payment.id)), new Set([today.id, declinedToday.id]));
  assert.ok(!secondRun.some(payment => payment.id === yesterday.id || payment.id === tomorrow.id));
});
