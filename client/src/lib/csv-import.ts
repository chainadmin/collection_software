export type SystemField = { value: string; label: string };

export const systemFields: SystemField[] = [
  { value: "skip", label: "-- Skip --" },
  { value: "accountNumber", label: "Account Number" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "dateOfBirth", label: "Date of Birth" },
  { value: "ssn", label: "SSN (Full)" },
  { value: "ssnLast4", label: "SSN Last 4" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zipCode", label: "ZIP Code" },
  { value: "originalBalance", label: "Original Balance" },
  { value: "currentBalance", label: "Current Balance" },
  { value: "originalCreditor", label: "Original Creditor" },
  { value: "clientName", label: "Client Name" },
  { value: "status", label: "Status" },
  { value: "lastContactDate", label: "Last Contact Date" },
  { value: "nextFollowUpDate", label: "Next Follow Up Date" },
  { value: "chargeOffDate", label: "Charge Off Date" },
  { value: "clientId", label: "Client ID" },
  { value: "portfolioId", label: "Portfolio ID" },
  { value: "phone1", label: "Phone 1" },
  { value: "phone1Label", label: "Phone 1 Label" },
  { value: "phone2", label: "Phone 2" },
  { value: "phone2Label", label: "Phone 2 Label" },
  { value: "phone3", label: "Phone 3" },
  { value: "phone3Label", label: "Phone 3 Label" },
  { value: "phone4", label: "Phone 4" },
  { value: "phone4Label", label: "Phone 4 Label" },
  { value: "phone5", label: "Phone 5" },
  { value: "phone5Label", label: "Phone 5 Label" },
  { value: "email1", label: "Email 1" },
  { value: "email1Label", label: "Email 1 Label" },
  { value: "email2", label: "Email 2" },
  { value: "email2Label", label: "Email 2 Label" },
  { value: "email3", label: "Email 3" },
  { value: "email3Label", label: "Email 3 Label" },
  { value: "employerName", label: "Employer Name" },
  { value: "employerPhone", label: "Employer Phone" },
  { value: "employerAddress", label: "Employer Address" },
  { value: "position", label: "Job Position/Title" },
  { value: "salary", label: "Salary (Annual)" },
  { value: "ref1Name", label: "Reference 1 Name" },
  { value: "ref1Relationship", label: "Reference 1 Relationship" },
  { value: "ref1Phone", label: "Reference 1 Phone" },
  { value: "ref1Address", label: "Reference 1 Address" },
  { value: "ref1City", label: "Reference 1 City" },
  { value: "ref1State", label: "Reference 1 State" },
  { value: "ref1ZipCode", label: "Reference 1 ZIP Code" },
  { value: "ref2Name", label: "Reference 2 Name" },
  { value: "ref2Relationship", label: "Reference 2 Relationship" },
  { value: "ref2Phone", label: "Reference 2 Phone" },
  { value: "ref2Address", label: "Reference 2 Address" },
  { value: "ref2City", label: "Reference 2 City" },
  { value: "ref2State", label: "Reference 2 State" },
  { value: "ref2ZipCode", label: "Reference 2 ZIP Code" },
  { value: "ref3Name", label: "Reference 3 Name" },
  { value: "ref3Relationship", label: "Reference 3 Relationship" },
  { value: "ref3Phone", label: "Reference 3 Phone" },
  { value: "ref3Address", label: "Reference 3 Address" },
  { value: "ref3City", label: "Reference 3 City" },
  { value: "ref3State", label: "Reference 3 State" },
  { value: "ref3ZipCode", label: "Reference 3 ZIP Code" },
  { value: "ref1Notes", label: "Reference 1 Notes" },
  { value: "ref2Notes", label: "Reference 2 Notes" },
  { value: "ref3Notes", label: "Reference 3 Notes" },
  { value: "phone", label: "Phone (Legacy)" },
  { value: "email", label: "Email (Legacy)" },
  { value: "custom1", label: "→ Custom Field (uses column name)" },
  { value: "custom2", label: "→ Custom Field 2" },
  { value: "custom3", label: "→ Custom Field 3" },
  { value: "custom4", label: "→ Custom Field 4" },
  { value: "custom5", label: "→ Custom Field 5" },
  { value: "custom6", label: "→ Custom Field 6" },
  { value: "custom7", label: "→ Custom Field 7" },
  { value: "custom8", label: "→ Custom Field 8" },
  { value: "custom9", label: "→ Custom Field 9" },
  { value: "custom10", label: "→ Custom Field 10" },
];

export type ParsedImportFile = { columns: string[]; data: string[][] };

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export function parseCSV(text: string): { columns: string[]; data: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;
  let quoted = false;

  const pushValue = () => {
    row.push(quoted ? value : value.trim());
    value = "";
    quoted = false;
  };
  const pushRow = () => {
    pushValue();
    if (row.some((cell) => cell.length > 0)) rows.push(row);
    row = [];
  };

  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"' && value.trim() === "") {
      value = "";
      quoted = true;
      inQuotes = true;
    } else if (char === ",") {
      pushValue();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      pushRow();
    } else {
      value += char;
    }
  }
  if (inQuotes) throw new ImportFileError("The CSV file contains an unclosed quoted value.");
  if (value.length > 0 || row.length > 0) pushRow();
  if (rows.length === 0) return { columns: [], data: [] };

  const columns = rows[0].map((column) => column.trim());
  return { columns, data: rows.slice(1) };
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value);
}

function renderIdentifierNumber(value: number, numberFormat: string | undefined): string | null {
  if (!Number.isSafeInteger(value) || !numberFormat || !numberFormat.includes("0")) return null;
  // These masks are frequently used for account and SSN columns. Render them
  // ourselves because ExcelJS intentionally exposes the underlying number.
  const format = numberFormat.split(";")[0].replace(/\[[^\]]+\]/g, "").replace(/"([^"]*)"/g, "$1");
  if (!/^[0#\s-]+$/.test(format) || format.includes("#") && !format.includes("0")) return null;
  const characters = Array.from(format);
  const placeholders = characters.filter((char) => char === "0" || char === "#").length;
  const digits = String(Math.abs(value)).padStart(placeholders, "0");
  let digitIndex = 0;
  return characters.map((char) =>
    char === "0" || char === "#" ? (digits[digitIndex++] || "") : char,
  ).join("");
}

function excelCellValue(cell: {
  value: unknown;
  numFmt?: string;
}): string {
  let value = cell.value;
  if (value && typeof value === "object" && "result" in value) {
    value = (value as { result: unknown }).result;
  } else if (value && typeof value === "object" && "richText" in value) {
    value = (value as { richText: Array<{ text: string }> }).richText.map((part) => part.text).join("");
  } else if (value && typeof value === "object" && "text" in value) {
    value = (value as { text: string }).text;
  }
  if (typeof value === "number") return renderIdentifierNumber(value, cell.numFmt) ?? String(value);
  return formatCell(value);
}

export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedImportFile> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ImportFileError("The workbook does not contain a worksheet.");
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let column = 1; column <= row.cellCount; column++) {
      values.push(excelCellValue(row.getCell(column)));
    }
    rows.push(values);
  });
  return tableFromRows(rows);
}

export function tableFromRows(rows: unknown[][]): ParsedImportFile {
  const nonEmptyRows = rows
    .map((row) => row.map(formatCell))
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  if (nonEmptyRows.length === 0) {
    throw new ImportFileError("The selected file is empty.");
  }
  const columns = nonEmptyRows[0].map((column) => column.trim());
  if (columns.length === 0 || columns.every((column) => !column)) {
    throw new ImportFileError("The selected file does not contain a header row.");
  }
  if (new Set(columns).size !== columns.length) {
    throw new ImportFileError("The header row contains duplicate column names.");
  }
  if (nonEmptyRows.length === 1) {
    throw new ImportFileError("The selected file does not contain any data rows.");
  }
  return { columns, data: nonEmptyRows.slice(1) };
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xls") {
    throw new ImportFileError("Legacy .xls files are not supported. Save the workbook as .xlsx or CSV and try again.");
  }
  if (extension !== "csv" && extension !== "xlsx") {
    throw new ImportFileError("Unsupported file type. Select a CSV or XLSX file.");
  }
  if (file.size === 0) throw new ImportFileError("The selected file is empty.");

  try {
    if (extension === "csv") {
      const parsed = parseCSV(await file.text());
      return tableFromRows([parsed.columns, ...parsed.data]);
    }
    return parseXlsxBuffer(await file.arrayBuffer());
  } catch (error) {
    if (error instanceof ImportFileError) throw error;
    const detail = error instanceof Error ? error.message.toLowerCase() : "";
    if (detail.includes("password") || detail.includes("encrypt")) {
      throw new ImportFileError("Password-protected workbooks cannot be imported. Remove the password and try again.");
    }
    throw new ImportFileError(
      extension === "xlsx"
        ? "This workbook could not be read. It may be damaged or password-protected."
        : "This CSV file could not be read.",
    );
  }
}

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  acctnumber: "accountNumber",
  acctnum: "accountNumber",
  acct: "accountNumber",
  account: "accountNumber",
  fname: "firstName",
  lname: "lastName",
  firstname: "firstName",
  lastname: "lastName",
  dob: "dateOfBirth",
  ssn: "ssn",
  origbal: "originalBalance",
  origbalance: "originalBalance",
  originalbalance: "originalBalance",
  balance: "currentBalance",
  currbal: "currentBalance",
  currentbalance: "currentBalance",
  zip: "zipCode",
  zipcode: "zipCode",
  creditor: "originalCreditor",
  origcreditor: "originalCreditor",
  phone: "phone1",
  phone1: "phone1",
  email: "email1",
  email1: "email1",
};

export function autoMapColumns(columns: string[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const f of systemFields) {
    if (f.value === "skip") continue;
    lookup[normalizeHeader(f.label)] = f.value;
    lookup[normalizeHeader(f.value)] = f.value;
  }
  const result: Record<string, string> = {};
  for (const col of columns) {
    const norm = normalizeHeader(col);
    const match = lookup[norm] ?? HEADER_ALIASES[norm];
    result[col] = match || "skip";
  }
  return result;
}

export function buildSkipMappings(columns: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const col of columns) result[col] = "skip";
  return result;
}

export function sanitizeColumnMappings(
  mappings: Record<string, string>,
): Record<string, string> {
  const validFields = new Set(systemFields.map((field) => field.value));
  return Object.fromEntries(
    Object.entries(mappings).map(([column, field]) => [
      column,
      validFields.has(field) ? field : "skip",
    ]),
  );
}
