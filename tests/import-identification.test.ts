import test from "node:test";
import assert from "node:assert/strict";
import {
  debtorMatchesImportIdentifier,
  sanitizeDebtorImportMappings,
  discoverReferenceSlots,
} from "../server/import-identification";

test("imports identify debtors by file number, account number, or full SSN", () => {
  const debtor = { accountNumber: "AC-001", ssn: "123-45-6789", fileNumber: "42" };
  assert.equal(debtorMatchesImportIdentifier(debtor, { accountNumber: " AC-001 " }), true);
  assert.equal(debtorMatchesImportIdentifier(debtor, { ssn: "123456789" }), true);
  assert.equal(debtorMatchesImportIdentifier(debtor, { ssn: "6789" }), false);
  assert.equal(debtorMatchesImportIdentifier(debtor, { fileNumber: "42" }), true);
});

test("backend mapping sanitizer accepts file number and rejects arbitrary debtor fields", () => {
  assert.deepEqual(
    sanitizeDebtorImportMappings({
      Account: "accountNumber",
      File: "fileNumber",
      Organization: "organizationId",
      Notes: "custom1",
      Ignored: "skip",
    }),
    { Account: "accountNumber", File: "fileNumber", Notes: "custom1", Ignored: "skip" },
  );
});

test("reference field mappings are accepted for any slot number, not just 1-3", () => {
  assert.deepEqual(
    sanitizeDebtorImportMappings({
      A: "ref1Name", B: "ref4Name", C: "ref50Phone2", D: "ref7Phone1", E: "ref3Bogus",
    }),
    // E is neither "skip" nor a recognized field, so (matching the existing
    // behavior for any other unrecognized field) it's dropped entirely
    // rather than rewritten to "skip".
    { A: "ref1Name", B: "ref4Name", C: "ref50Phone2", D: "ref7Phone" },
  );
});

test("discoverReferenceSlots finds every mapped reference slot with no fixed cap", () => {
  assert.deepEqual(
    discoverReferenceSlots({
      ref1Name: "Jane", ref2Phone: "555-0100", ref47Name: "John", ref47Notes: "met at work",
      firstName: "Not", accountNumber: "A1",
    }),
    [1, 2, 47],
  );
  assert.deepEqual(discoverReferenceSlots({ firstName: "Only debtor fields" }), []);
});

test("expanded slots, legacy labels, and Phone 1 reference alias are accepted", () => {
  assert.deepEqual(
    sanitizeDebtorImportMappings({
      Phone7: "phone7",
      PhoneLabel: "phoneLabel",
      EmailLabel: "emailLabel",
      RelativePhoneOne: "ref2Phone1",
      RelativePhoneThree: "ref2Phone3",
      Custom: "custom10",
    }),
    {
      Phone7: "phone7",
      PhoneLabel: "phoneLabel",
      EmailLabel: "emailLabel",
      RelativePhoneOne: "ref2Phone",
      RelativePhoneThree: "ref2Phone3",
      Custom: "custom10",
    },
  );
});
