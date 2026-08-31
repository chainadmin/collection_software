import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("startup migration supports Chain card fingerprints and tenant-scoped provider IDs", {
  skip: !process.env.DATABASE_URL && "DATABASE_URL is not configured",
}, async () => {
  const [{ runMigrations }, { DatabaseStorage }, { pool }] = await Promise.all([
    import("../server/migrate"),
    import("../server/database-storage"),
    import("../server/db"),
  ]);
  await runMigrations();
  const storage = new DatabaseStorage();
  const orgA = `migration-test-org-a-${randomUUID()}`;
  const orgB = `migration-test-org-b-${randomUUID()}`;
  const debtorA = `migration-test-debtor-a-${randomUUID()}`;
  const debtorB = `migration-test-debtor-b-${randomUUID()}`;
  const transactionId = `migration-test-txn-${randomUUID()}`;
  const createdPaymentIds: string[] = [];
  const createdCardIds: string[] = [];
  try {
    const card = await storage.createPaymentCard({
      organizationId: orgA,
      debtorId: debtorA,
      cardType: "visa",
      cardholderName: "Migration Test",
      cardNumberLast4: "4242",
      expiryMonth: "12",
      expiryYear: "2030",
      billingZip: null,
      processorType: "nmi",
      processorToken: "nmi_vault_migration_test",
      processorCustomerId: "nmi_vault_migration_test",
      vaultStatus: "vaulted",
      externalIdempotencyKey: `chain-card:${randomUUID()}`,
      externalCredentialFingerprint: randomUUID().replace(/-/g, ""),
      isDefault: false,
      addedDate: "2030-01-01",
      addedBy: null,
    });
    createdCardIds.push(card.id);
    assert.ok(card.externalCredentialFingerprint);

    const first = await storage.createPayment({
      organizationId: orgA,
      debtorId: debtorA,
      amount: 1000,
      paymentDate: "2030-01-01",
      paymentMethod: "card",
      status: "processed",
      providerTransactionId: transactionId,
      idempotencyKey: `chain:migration-a:${randomUUID()}`,
    });
    createdPaymentIds.push(first.id);
    const secondTenant = await storage.createPayment({
      organizationId: orgB,
      debtorId: debtorB,
      amount: 1000,
      paymentDate: "2030-01-01",
      paymentMethod: "card",
      status: "processed",
      providerTransactionId: transactionId,
      idempotencyKey: `chain:migration-b:${randomUUID()}`,
    });
    createdPaymentIds.push(secondTenant.id);

    await assert.rejects(() => storage.createPayment({
      organizationId: orgA,
      debtorId: debtorA,
      amount: 1000,
      paymentDate: "2030-01-02",
      paymentMethod: "card",
      status: "processed",
      providerTransactionId: transactionId,
      idempotencyKey: `chain:migration-duplicate:${randomUUID()}`,
    }), (error: any) => error?.code === "23505");
  } finally {
    if (createdPaymentIds.length) {
      await pool.query("DELETE FROM payments WHERE id = ANY($1::varchar[])", [createdPaymentIds]);
    }
    if (createdCardIds.length) {
      await pool.query("DELETE FROM payment_cards WHERE id = ANY($1::varchar[])", [createdCardIds]);
    }
    await pool.end();
  }
});