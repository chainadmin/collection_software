import test from "node:test";
import assert from "node:assert/strict";
import {
  autoMapColumns,
  parseCSV,
  parseXlsxBuffer,
  sanitizeColumnMappings,
  tableFromRows,
  systemFields,
  contactFields,
} from "../client/src/lib/csv-import";
import ExcelJS from "exceljs";

test("CSV parser handles CRLF, escaped quotes, commas, and quoted newlines", () => {
  const parsed = parseCSV(
    '\uFEFFAccount Number,Name,Notes\r\n"00123","Doe, Jane","Said ""hello""\r\nagain"\r\n',
  );
  assert.deepEqual(parsed.columns, ["Account Number", "Name", "Notes"]);
  assert.deepEqual(parsed.data, [["00123", "Doe, Jane", 'Said "hello"\r\nagain']]);
});

test("XLSX parser uses the first worksheet and preserves import-ready values", async () => {
  const workbook = new ExcelJS.Workbook();
  const first = workbook.addWorksheet("Accounts");
  first.addRow(["Account Number", "DOB", "Formatted Account", "SSN", "Balance", "Notes"]);
  first.addRow(["000045", new Date(Date.UTC(2020, 0, 2)), 45, 123456789, 1234.5, 'Said "hello", again']);
  first.getCell("B2").numFmt = "yyyy-mm-dd";
  first.getCell("C2").numFmt = "000000";
  first.getCell("D2").numFmt = "000-00-0000";
  first.getCell("E2").numFmt = '$#,##0.00';
  const ignored = workbook.addWorksheet("Ignored");
  ignored.addRow(["Account Number"]);
  ignored.addRow(["should-not-appear"]);

  const buffer = await workbook.xlsx.writeBuffer();
  const parsed = await parseXlsxBuffer(buffer as ArrayBuffer);
  assert.deepEqual(parsed.columns, ["Account Number", "DOB", "Formatted Account", "SSN", "Balance", "Notes"]);
  assert.deepEqual(parsed.data, [["000045", "2020-01-02", "000045", "123-45-6789", "1234.5", 'Said "hello", again']]);
});

test("file numbers are neither auto-mapped nor restored from old schemas", () => {
  assert.equal(autoMapColumns(["File Number"])["File Number"], "skip");
  assert.deepEqual(
    sanitizeColumnMappings({ VendorId: "fileNumber", Account: "accountNumber" }),
    { VendorId: "skip", Account: "accountNumber" },
  );
});

test("empty spreadsheet rows are rejected", () => {
  assert.throws(() => tableFromRows([["", ""], [null, ""]]), /empty/i);
});

test("all import entry points offer seven phones, three per reference, and ten custom fields", () => {
  for (const fields of [systemFields, contactFields]) {
    const values = fields.map((field) => field.value);
    assert.equal(new Set(values).size, values.length);
    for (let phone = 1; phone <= 7; phone++) {
      assert.ok(values.includes(`phone${phone}`));
      assert.ok(values.includes(`phone${phone}Label`));
    }
    for (let relative = 1; relative <= 3; relative++) {
      for (const suffix of ["", "2", "3"]) {
        assert.ok(values.includes(`ref${relative}Phone${suffix}`));
      }
    }
    for (let custom = 1; custom <= 10; custom++) assert.ok(values.includes(`custom${custom}`));
  }
});

test("auto mapping and saved schemas preserve old and expanded phone/custom mappings", () => {
  assert.deepEqual(autoMapColumns([
    "Phone 7", "Phone 6 Label", "Reference 1 Phone", "Reference 2 Phone 3",
    "Relative 3 Phone 2", "ref2Phone1", "Custom Field 1", "Custom Field 10",
  ]), {
    "Phone 7": "phone7",
    "Phone 6 Label": "phone6Label",
    "Reference 1 Phone": "ref1Phone",
    "Reference 2 Phone 3": "ref2Phone3",
    "Relative 3 Phone 2": "ref3Phone2",
    ref2Phone1: "ref2Phone",
    "Custom Field 1": "custom1",
    "Custom Field 10": "custom10",
  });
  const saved = {
    Phone: "phone", Label: "phoneLabel", EmailLabel: "emailLabel", Mobile7: "phone7",
    Reference: "ref1Phone", SecondReference: "ref2Phone1", ThirdPhone: "ref3Phone3",
    Other: "custom10", NotAllowed: "organizationId",
  };
  assert.deepEqual(sanitizeColumnMappings(saved), {
    ...saved, SecondReference: "ref2Phone", NotAllowed: "skip",
  });
});

test("CSV and XLSX retain the complete expanded account row, including custom labels", async () => {
  const columns = ["Account Number",
    ...Array.from({ length: 7 }, (_, index) => `Phone ${index + 1}`),
    ...Array.from({ length: 3 }, (_, relative) =>
      Array.from({ length: 3 }, (_, phone) => `Reference ${relative + 1} Phone ${phone + 1}`)).flat(),
    ...Array.from({ length: 10 }, (_, index) => `Custom Field ${index + 1}`),
  ];
  const values = ["000123",
    ...Array.from({ length: 16 }, (_, index) => `202555${String(index).padStart(4, "0")}`),
    ...Array.from({ length: 10 }, (_, index) => `Distinct value ${index + 1}`),
  ];
  const csv = parseCSV(`${columns.join(",")}\n${values.join(",")}`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Accounts");
  sheet.addRow(columns);
  sheet.addRow(values);
  const xlsx = await parseXlsxBuffer(await workbook.xlsx.writeBuffer() as ArrayBuffer);
  assert.deepEqual(csv, xlsx);
  assert.deepEqual(csv.data[0], values);
  const mappings = autoMapColumns(columns);
  assert.equal(Object.values(mappings).filter((field) => field !== "skip").length, columns.length);
  assert.equal(new Set(Object.values(mappings)).size, columns.length);
});