import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { paymentCards } from "../shared/schema";
import { validateCardNumber } from "../shared/card-validation";

test("public payment card model contains vault metadata but no PAN or CVV", () => {
  const columns = getTableColumns(paymentCards);
  assert.equal("cardNumber" in columns, false);
  assert.equal("cvv" in columns, false);
  assert.ok("processorToken" in columns);
  assert.ok("processorCustomerId" in columns);
  assert.ok("cardNumberLast4" in columns);
});

test("card format validation provides immediate local valid and invalid states", () => {
  assert.equal(validateCardNumber("4242").status, "incomplete");
  assert.equal(validateCardNumber("4242 4242 4242 4242").status, "valid");
  assert.equal(validateCardNumber("4242 4242 4242 4241").status, "invalid");
});