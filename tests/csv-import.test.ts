import test from "node:test";
import assert from "node:assert/strict";
import {
  autoMapColumns,
  parseCSV,
  parseXlsxBuffer,
  sanitizeColumnMappings,
  tableFromRows,
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