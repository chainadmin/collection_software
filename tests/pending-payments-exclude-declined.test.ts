import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "../server/storage";

test("getPendingPayments excludes a declined payment that already completed a run attempt", async () => {
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

  // A decline leaves status "pending" (so it can be re-run) but sets
  // completedAt and a "DECLINED:" note - it must not also show up as an
  // untouched pending payment in the same list.
  const declined = await storage.createPayment({
    organizationId: org, debtorId: debtor.id, amount: 2000,
    paymentDate: "2030-01-01", paymentMethod: "ach", status: "pending",
  });
  await storage.updatePayment(declined.id, {
    status: "pending",
    completedAt: new Date(),
    notes: "DECLINED: Insufficient funds",
  });

  const pending = await storage.getPendingPayments(org);
  assert.deepEqual(pending.map(p => p.id), [untouched.id]);
});
