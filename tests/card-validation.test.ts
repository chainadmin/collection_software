import assert from "node:assert/strict";
import test from "node:test";
import { IinLookupCache, validateCardNumber } from "../shared/card-validation";

const valid = [
  ["Visa", "4242 4242 4242 4242"],
  ["Mastercard", "5555-5555-5555-4444"],
  ["American Express", "378282246310005"],
  ["Discover", "6011111111111117"],
] as const;

for (const [network, number] of valid) test(`valid ${network}`, () => {
  const result = validateCardNumber(number);
  assert.equal(result.isValid, true);
  assert.equal(result.network, network);
});

test("rejects an invalid Luhn checksum", () => assert.equal(validateCardNumber("4242424242424241").status, "invalid"));
test("does not aggressively reject a short number", () => assert.equal(validateCardNumber("4242").status, "incomplete"));
test("rejects malformed characters", () => assert.equal(validateCardNumber("4242x424242424242").status, "invalid"));
test("accepts spaces and hyphens", () => assert.equal(validateCardNumber("5555-5555 5555-4444").isValid, true));
test("valid checksum can have an unknown network", () => assert.equal(validateCardNumber("1234567890123452").network, "Unknown"));
test("finds eight-digit debit metadata", () => assert.equal(validateCardNumber("4000056655665556").type, "Debit"));
test("finds six-digit credit metadata", () => assert.equal(validateCardNumber("4242424242424242").type, "Credit"));
test("missing BIN metadata is Unknown and does not invalidate PAN", () => {
  const result = validateCardNumber("5555555555554444");
  assert.equal(result.type, "Unknown"); assert.equal(result.isValid, true);
});
test("duplicate IIN lookup is cached without using the full PAN key", () => {
  const cache = new IinLookupCache();
  cache.lookup("4242424242424242"); cache.lookup("4242424299999999");
  assert.equal(cache.size, 1);
});
test("provider unavailability is non-applicable to local lookup and processor approval is not inferred", () => {
  const result = validateCardNumber("4242424242424242");
  assert.equal("approved" in result, false);
});
