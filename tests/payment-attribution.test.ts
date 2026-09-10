import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedPaymentCollectorId, buildInternalPaymentInsert } from "../server/payment-input";

test("payment attribution comes from the authenticated collector session", () => {
  assert.equal(authenticatedPaymentCollectorId({ collector: { id: "collector-1" } }), "collector-1");
  assert.equal(authenticatedPaymentCollectorId({ collectorId: "legacy-wrong-location" }), null);
  assert.equal(authenticatedPaymentCollectorId({ collector: { id: "" } }), null);
  assert.equal(authenticatedPaymentCollectorId(undefined), null);

  const insert = buildInternalPaymentInsert({
    paymentMethod: "ach",
    paymentDate: "2030-01-01",
    processedBy: "caller-controlled",
  }, {
    amount: 2500,
    debtorId: "debtor-1",
    organizationId: "org-1",
    idempotencyKey: "payment-attribution-1",
    processedBy: authenticatedPaymentCollectorId({ collector: { id: "collector-1" } }),
  });
  assert.equal(insert.processedBy, "collector-1");
});
