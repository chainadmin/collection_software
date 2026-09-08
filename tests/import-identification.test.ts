import test from "node:test";
import assert from "node:assert/strict";
import {
  debtorMatchesImportIdentifier,
  sanitizeDebtorImportMappings,
} from "../server/import-identification";

test("imports identify debtors only by account number or full SSN", () => {
  const debtor = { accountNumber: "AC-001", ssn: "123-45-6789", fileNumber: "42" };
  assert.equal(debtorMatchesImportIdentifier(debtor, { accountNumber: " AC-001 " }), true);
  assert.equal(debtorMatchesImportIdentifier(debtor, { ssn: "123456789" }), true);
  assert.equal(debtorMatchesImportIdentifier(debtor, { ssn: "6789" }), false);
  assert.equal(debtorMatchesImportIdentifier(debtor, { fileNumber: "42" } as any), false);
});

test("backend mapping sanitizer rejects file number and arbitrary debtor fields", () => {
  assert.deepEqual(
    sanitizeDebtorImportMappings({
      Account: "accountNumber",
      File: "fileNumber",
      Organization: "organizationId",
      Notes: "custom1",
      Ignored: "skip",
    }),
    { Account: "accountNumber", Notes: "custom1", Ignored: "skip" },
  );
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