import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import type { Client, Debtor, DebtorContact, Portfolio } from "../shared/schema";
import {
  accountExportFilename,
  escapeCsvCell,
  selectAccountExportRows,
  serializeAccountExport,
  serializeAccountRowsToCsv,
  serializeAccountRowsToJson,
  serializeAccountRowsToXlsx,
} from "../server/account-export";

const portfolio = {
  id: "portfolio-a",
  organizationId: "org-a",
  name: "Portfolio A",
  clientId: "client-a",
  status: "active",
} as Portfolio;
const foreignPortfolio = {
  ...portfolio,
  id: "portfolio-b",
  organizationId: "org-b",
  name: "Foreign Portfolio",
} as Portfolio;
const client = {
  id: "client-a",
  organizationId: "org-a",
  name: "Client A",
  contactName: "Case Owner",
  email: "owner@client.example",
  phone: "555-0100",
} as Client;
const debtor = {
  id: "debtor-a",
  organizationId: "org-a",
  portfolioId: portfolio.id,
  accountNumber: 'ACCT,"1"',
  fileNumber: "FILE-1",
  firstName: "Jane",
  lastName: "Doe",
  ssn: "123-45-6789",
  ssnLast4: "6789",
  email: "jane@example.com",
  address: "1 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  originalCreditor: "Original Bank",
  clientName: "Legacy Client Name",
  clientId: client.id,
  originalBalance: 12345,
  currentBalance: 10001,
  status: "open",
  lastContactDate: "2025-01-01",
  nextFollowUpDate: "2025-01-05",
  chargeOffDate: null,
} as Debtor;
const foreignDebtor = {
  ...debtor,
  id: "debtor-b",
  organizationId: "org-b",
  portfolioId: foreignPortfolio.id,
  accountNumber: "SECRET-ACCOUNT",
} as Debtor;
const secondPortfolio = {
  ...portfolio,
  id: "portfolio-a-2",
  name: "Portfolio A2",
} as Portfolio;
const secondDebtor = {
  ...debtor,
  id: "debtor-a-2",
  portfolioId: secondPortfolio.id,
  accountNumber: "SECOND-ACCOUNT",
} as Debtor;
const contacts = [
  {
    id: "contact-a",
    organizationId: "org-a",
    debtorId: debtor.id,
    type: "phone",
    value: "555-1212",
    isPrimary: true,
    isValid: true,
  },
  {
    id: "foreign-contact",
    organizationId: "org-b",
    debtorId: debtor.id,
    type: "phone",
    value: "SHOULD-NOT-LEAK",
    isPrimary: true,
    isValid: true,
  },
] as DebtorContact[];

test("account export selection enforces tenant and portfolio scope", () => {
  const allRows = selectAccountExportRows({
    organizationId: "org-a",
    debtors: [debtor, secondDebtor, foreignDebtor],
    portfolios: [portfolio, secondPortfolio, foreignPortfolio],
    clients: [client],
    contacts,
  });
  const rows = selectAccountExportRows({
    organizationId: "org-a",
    debtors: [debtor, secondDebtor, foreignDebtor],
    portfolios: [portfolio, secondPortfolio, foreignPortfolio],
    clients: [client],
    contacts,
    portfolioId: portfolio.id,
  });

  assert.deepEqual(allRows.map((row) => row.accountNumber), [debtor.accountNumber, "SECOND-ACCOUNT"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].accountNumber, debtor.accountNumber);
  assert.equal(rows[0].portfolioName, portfolio.name);
  assert.equal(rows[0].clientName, client.name);
  assert.equal(rows[0].phone, "555-1212");
  assert.doesNotMatch(JSON.stringify(rows), /SECRET|SHOULD-NOT-LEAK/);
});

test("account export includes useful fields without full SSN or credentials", () => {
  const [row] = selectAccountExportRows({
    organizationId: "org-a",
    debtors: [debtor],
    portfolios: [portfolio],
    clients: [client],
    contacts,
  });

  assert.equal(row.ssnLast4, "6789");
  assert.equal(row.currentBalance, 100.01);
  assert.equal(row.address, "1 Main St");
  assert.equal(row.clientContactName, "Case Owner");
  assert.equal("ssn" in row, false);
  assert.equal("paymentToken" in row, false);
  assert.doesNotMatch(JSON.stringify(row), /123-45-6789/);
});

test("CSV and JSON serializers preserve fields and correctly escape CSV", () => {
  const rows = selectAccountExportRows({
    organizationId: "org-a",
    debtors: [debtor],
    portfolios: [portfolio],
    clients: [client],
    contacts,
  });
  const csv = serializeAccountRowsToCsv(rows);
  assert.match(csv, /"ACCT,""1"""/);
  assert.equal(escapeCsvCell("line 1\nline 2"), '"line 1\nline 2"');
  const parsed = JSON.parse(serializeAccountRowsToJson(rows));
  assert.equal(parsed[0].accountNumber, debtor.accountNumber);
  assert.equal(parsed[0].ssnLast4, "6789");
});

test("CSV serializer neutralizes spreadsheet formulas without changing numeric balances", () => {
  assert.equal(escapeCsvCell("=2+2"), "'=2+2");
  assert.equal(escapeCsvCell("+SUM(A1:A2)"), "'+SUM(A1:A2)");
  assert.equal(escapeCsvCell("-1+2"), "'-1+2");
  assert.equal(escapeCsvCell("@cmd"), "'@cmd");
  assert.equal(escapeCsvCell("\tformula"), "'\tformula");
  assert.equal(escapeCsvCell("\rformula"), '"\'\rformula"');
  assert.equal(escapeCsvCell("  =2+2"), "'  =2+2");
  assert.equal(escapeCsvCell("\f=2+2"), "'\f=2+2");
  assert.equal(escapeCsvCell("\uFEFF=2+2"), "'\uFEFF=2+2");
  assert.equal(escapeCsvCell("\u00A0=2+2"), "'\u00A0=2+2");
  assert.equal(escapeCsvCell("\u2003=2+2"), "'\u2003=2+2");
  assert.equal(escapeCsvCell(-12.34), "-12.34");

  const rows = selectAccountExportRows({
    organizationId: "org-a",
    debtors: [{ ...debtor, firstName: "=HYPERLINK(\"bad\")" }],
    portfolios: [portfolio],
    clients: [client],
    contacts,
  });
  const csv = serializeAccountRowsToCsv(rows);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /123\.45,100\.01/);
});

test("XLSX serializer creates a readable workbook with account data", async () => {
  const rows = selectAccountExportRows({
    organizationId: "org-a",
    debtors: [debtor],
    portfolios: [portfolio],
    clients: [client],
    contacts,
  });
  const data = await serializeAccountRowsToXlsx(rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheet = workbook.getWorksheet("Accounts");
  assert.ok(sheet);
  assert.equal(sheet.getCell("B2").value, debtor.accountNumber);
  assert.equal(sheet.getCell("E2").value, "6789");
});

test("format metadata and generated filenames are download-safe", async () => {
  const exported = await serializeAccountExport([], "xlsx");
  assert.equal(
    exported.contentType,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.equal(accountExportFilename("csv", new Date("2025-02-03T12:00:00Z")), "accounts-export-2025-02-03.csv");
  assert.doesNotMatch(accountExportFilename("json"), /[\\/"\r\n]/);
});