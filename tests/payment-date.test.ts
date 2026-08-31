import test from "node:test";
import assert from "node:assert/strict";
import { getPaymentBusinessDate } from "../server/payment-date";

test("payment business date follows Eastern time around UTC midnight", () => {
  assert.equal(getPaymentBusinessDate(new Date("2026-08-31T02:00:00Z")), "2026-08-30");
  assert.equal(getPaymentBusinessDate(new Date("2026-08-31T14:00:00Z")), "2026-08-31");
});
