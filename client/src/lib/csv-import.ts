export type SystemField = { value: string; label: string };

export const systemFields: SystemField[] = [
  { value: "skip", label: "-- Skip --" },
  { value: "accountNumber", label: "Account Number" },
  { value: "fileNumber", label: "File Number" },
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

export function parseCSV(text: string): { columns: string[]; data: string[][] } {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return { columns: [], data: [] };

  const columns = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const data = lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });

  return { columns, data };
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
