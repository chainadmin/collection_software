export const IMPORT_IDENTIFIER_FIELDS = new Set(["fileNumber", "accountNumber", "ssn"]);

export const ACCEPTED_DEBTOR_IMPORT_FIELDS = new Set([
  "fileNumber", "accountNumber", "firstName", "lastName", "dateOfBirth", "openDate", "ssn", "ssnLast4",
  "address", "city", "state", "zipCode", "originalBalance", "currentBalance",
  "originalCreditor", "clientName", "status", "lastContactDate", "nextFollowUpDate",
  "chargeOffDate",
  "phone", "phoneLabel", "phone1", "phone1Label", "phone2", "phone2Label",
  "phone3", "phone3Label", "phone4", "phone4Label", "phone5", "phone5Label",
  "phone6", "phone6Label", "phone7", "phone7Label",
  "email", "emailLabel", "email1", "email1Label", "email2", "email2Label", "email3", "email3Label",
  "employerName", "employerPhone", "employerAddress", "position", "salary",
]);

// A reference's own name/relationship/phone(2/3)/address/notes fields, for
// any reference slot number - references are not capped at a fixed count
// during import, only each reference's own phone count stays fixed at 3.
const DYNAMIC_REFERENCE_FIELD =
  /^ref(\d+)(?:Name|Relationship|Phone|Phone2|Phone3|Address|City|State|ZipCode|Notes)$/;
// Older schemas exposed refNPhone1; it is the established Phone 1 field.
const LEGACY_REFERENCE_PHONE1 = /^ref\d+Phone1$/;

export function sanitizeDebtorImportMappings(mappings: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [column, field] of Object.entries(mappings || {})) {
    if (field === "skip") sanitized[column] = "skip";
    else if (typeof field === "string") {
      const canonical = LEGACY_REFERENCE_PHONE1.test(field) ? field.replace(/Phone1$/, "Phone") : field;
      if (
        ACCEPTED_DEBTOR_IMPORT_FIELDS.has(canonical) ||
        /^custom(?:[1-9]|10)$/.test(canonical) ||
        DYNAMIC_REFERENCE_FIELD.test(canonical)
      ) {
        sanitized[column] = canonical;
      }
    }
  }
  return sanitized;
}

// Which reference slot numbers this row actually has mapped data for -
// driven entirely by which ref{N}* keys are present, so a file with
// Reference 1..3 columns behaves exactly as before while one with
// Reference 1..50 columns creates all 50 references, with no fixed cap.
export function discoverReferenceSlots(mappedData: Record<string, unknown>): number[] {
  const slots = new Set<number>();
  for (const key of Object.keys(mappedData)) {
    const match = DYNAMIC_REFERENCE_FIELD.exec(key);
    if (match) slots.add(parseInt(match[1], 10));
  }
  return Array.from(slots).sort((a, b) => a - b);
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
  debtor: { fileNumber?: string | null; accountNumber?: string | null; ssn?: string | null },
  imported: { fileNumber?: unknown; accountNumber?: unknown; ssn?: unknown },
): boolean {
  const fileNumber = normalizeImportText(imported.fileNumber);
  const accountNumber = normalizeImportText(imported.accountNumber);
  const ssn = normalizeImportSsn(imported.ssn);
  return Boolean((fileNumber && debtor.fileNumber === fileNumber) ||
    (accountNumber && debtor.accountNumber === accountNumber) ||
    (ssn && normalizeImportSsn(debtor.ssn) === ssn));
}
