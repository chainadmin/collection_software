export const IMPORT_IDENTIFIER_FIELDS = new Set(["accountNumber", "ssn"]);

export const ACCEPTED_DEBTOR_IMPORT_FIELDS = new Set([
  "accountNumber", "firstName", "lastName", "dateOfBirth", "ssn", "ssnLast4",
  "address", "city", "state", "zipCode", "originalBalance", "currentBalance",
  "originalCreditor", "clientName", "status", "lastContactDate", "nextFollowUpDate",
  "chargeOffDate", "phone", "phone1", "phone1Label", "phone2", "phone2Label",
  "phone3", "phone3Label", "phone4", "phone4Label", "phone5", "phone5Label",
  "email", "email1", "email1Label", "email2", "email2Label", "email3", "email3Label",
  "employerName", "employerPhone", "employerAddress", "position", "salary",
  "ref1Name", "ref1Relationship", "ref1Phone", "ref1Address", "ref1City",
  "ref1State", "ref1ZipCode", "ref1Notes", "ref2Name", "ref2Relationship",
  "ref2Phone", "ref2Address", "ref2City", "ref2State", "ref2ZipCode", "ref2Notes",
  "ref3Name", "ref3Relationship", "ref3Phone", "ref3Address", "ref3City",
  "ref3State", "ref3ZipCode", "ref3Notes",
]);

export function sanitizeDebtorImportMappings(
  mappings: Record<string, unknown>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [column, field] of Object.entries(mappings || {})) {
    if (field === "skip") {
      sanitized[column] = "skip";
    } else if (
      typeof field === "string" &&
      (ACCEPTED_DEBTOR_IMPORT_FIELDS.has(field) || /^custom(?:[1-9]|10)$/.test(field))
    ) {
      sanitized[column] = field;
    }
  }
  return sanitized;
}

export function normalizeImportSsn(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

export function normalizeImportText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

export function debtorMatchesImportIdentifier(
  debtor: { accountNumber?: string | null; ssn?: string | null },
  imported: { accountNumber?: unknown; ssn?: unknown },
): boolean {
  const accountNumber = normalizeImportText(imported.accountNumber);
  const ssn = normalizeImportSsn(imported.ssn);
  return Boolean(
    (accountNumber && debtor.accountNumber === accountNumber) ||
    (ssn && normalizeImportSsn(debtor.ssn) === ssn),
  );
}