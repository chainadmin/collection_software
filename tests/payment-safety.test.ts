import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { db, pool } from "../server/db";
import { organizations, debtors } from "../shared/schema";
import { applyPaymentToDebtorBalance } from "../server/payment-safety";

async function seedOrgAndDebtor(currentBalanceCents: number) {
  const orgId = randomUUID();
  await db.insert(organizations).values({
    id: orgId,
    name: "Test Org",
    slug: `test-org-${orgId}`,
    createdDate: new Date().toISOString().split("T")[0],
  });

  const debtorId = randomUUID();
  await db.insert(debtors).values({
    id: debtorId,
    organizationId: orgId,
    portfolioId: randomUUID(),
    accountNumber: "ACC-1",
    firstName: "Ada",
    lastName: "Lovelace",
    originalBalance: 100000,
    currentBalance: currentBalanceCents,
  });

  return { orgId, debtorId };
}

test("applyPaymentToDebtorBalance decrements current_balance by the payment amount", async () => {
  const { orgId, debtorId } = await seedOrgAndDebtor(100000);

  const newBalance = await applyPaymentToDebtorBalance(debtorId, orgId, 2500);
  assert.equal(newBalance, 97500);

  const row = await db.query.debtors.findFirst({ where: (d, { eq }) => eq(d.id, debtorId) });
  assert.equal(row?.currentBalance, 97500);
  // The original balance must be untouched - this only ever applies a payment
  // to the live balance, never the placed amount.
  assert.equal(row?.originalBalance, 100000);
});

test("applyPaymentToDebtorBalance clamps at zero instead of going negative", async () => {
  const { orgId, debtorId } = await seedOrgAndDebtor(1000);

  const newBalance = await applyPaymentToDebtorBalance(debtorId, orgId, 5000);
  assert.equal(newBalance, 0);

  const row = await db.query.debtors.findFirst({ where: (d, { eq }) => eq(d.id, debtorId) });
  assert.equal(row?.currentBalance, 0);
});

test("applyPaymentToDebtorBalance rejects a debtor from a different organization", async () => {
  const { debtorId } = await seedOrgAndDebtor(100000);

  await assert.rejects(
    () => applyPaymentToDebtorBalance(debtorId, randomUUID(), 2500),
    /Account not found/,
  );
});

test.after(async () => {
  await pool.end();
});
