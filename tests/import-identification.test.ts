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