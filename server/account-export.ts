import ExcelJS from "exceljs";
import type { Client, Debtor, DebtorContact, Portfolio } from "@shared/schema";

export const accountExportColumns = [
  ["fileNumber", "File Number"],
  ["accountNumber", "Account Number"],
  ["firstName", "First Name"],
  ["lastName", "Last Name"],
  ["ssnLast4", "SSN Last 4"],
  ["status", "Account Status"],
  ["originalBalance", "Original Balance (USD)"],
  ["currentBalance", "Current Balance (USD)"],
  ["originalCreditor", "Original Creditor"],
  ["portfolioName", "Portfolio"],
  ["portfolioStatus", "Portfolio Status"],
  ["clientName", "Client"],
  ["clientContactName", "Client Contact"],
  ["clientEmail", "Client Email"],
  ["clientPhone", "Client Phone"],
  ["email", "Primary Email"],
  ["phone", "Primary Phone"],
  ["additionalEmails", "Additional Emails"],
  ["additionalPhones", "Additional Phones"],
  ["address", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["zipCode", "ZIP Code"],
  ["lastContactDate", "Last Contact Date"],
  ["nextFollowUpDate", "Next Follow-up Date"],
  ["chargeOffDate", "Charge-off Date"],
] as const;

type AccountExportKey = (typeof accountExportColumns)[number][0];
export type AccountExportRow = Record<AccountExportKey, string | number>;

export interface AccountExportSource {
  organizationId: string;
  debtors: Debtor[];
  portfolios: Portfolio[];
  clients: Client[];
  contacts: DebtorContact[];
  portfolioId?: string;
}

function dollars(cents: number | null | undefined): number {
  return Number(((cents ?? 0) / 100).toFixed(2));
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)),
  );
}

/**
 * Selects and joins only records that independently belong to the requested
 * organization. This deliberately does not trust relationship IDs as proof of
 * tenancy.
 */
export function selectAccountExportRows(source: AccountExportSource): AccountExportRow[] {
  const portfolios = new Map(
    source.portfolios
      .filter((portfolio) => portfolio.organizationId === source.organizationId)
      .map((portfolio) => [portfolio.id, portfolio]),
  );
  const clients = new Map(
    source.clients
      .filter((client) => client.organizationId === source.organizationId)
      .map((client) => [client.id, client]),
  );
  const eligibleDebtors = source.debtors.filter((debtor) =>
    debtor.organizationId === source.organizationId &&
    (!source.portfolioId || debtor.portfolioId === source.portfolioId) &&
    portfolios.has(debtor.portfolioId)
  );
  const eligibleIds = new Set(eligibleDebtors.map((debtor) => debtor.id));
  const contactsByDebtor = new Map<string, DebtorContact[]>();

  for (const contact of source.contacts) {
    if (contact.organizationId !== source.organizationId || !eligibleIds.has(contact.debtorId)) continue;
    const contacts = contactsByDebtor.get(contact.debtorId) ?? [];
    contacts.push(contact);
    contactsByDebtor.set(contact.debtorId, contacts);
  }

  return eligibleDebtors.map((debtor) => {
    const portfolio = portfolios.get(debtor.portfolioId)!;
    const clientId = debtor.clientId || portfolio.clientId;
    const client = clientId ? clients.get(clientId) : undefined;
    const contacts = contactsByDebtor.get(debtor.id) ?? [];
    const contactEmails = contacts.filter((contact) => contact.type === "email" && contact.isValid !== false);
    const contactPhones = contacts.filter((contact) => contact.type === "phone" && contact.isValid !== false);
    const emails = unique([
      debtor.email,
      ...contactEmails.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary)).map((contact) => contact.value),
    ]);
    const phones = unique(
      contactPhones.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary)).map((contact) => contact.value),
    );

    return {
      fileNumber: debtor.fileNumber ?? "",
      accountNumber: debtor.accountNumber,
      firstName: debtor.firstName,
      lastName: debtor.lastName,
      ssnLast4: debtor.ssnLast4 ?? "",
      status: debtor.status,
      originalBalance: dollars(debtor.originalBalance),
      currentBalance: dollars(debtor.currentBalance),
      originalCreditor: debtor.originalCreditor ?? "",
      portfolioName: portfolio.name,
      portfolioStatus: portfolio.status,
      clientName: client?.name ?? debtor.clientName ?? "",
      clientContactName: client?.contactName ?? "",
      clientEmail: client?.email ?? "",
      clientPhone: client?.phone ?? "",
      email: emails[0] ?? "",
      phone: phones[0] ?? "",
      additionalEmails: emails.slice(1).join("; "),
      additionalPhones: phones.slice(1).join("; "),
      address: debtor.address ?? "",
      city: debtor.city ?? "",
      state: debtor.state ?? "",
      zipCode: debtor.zipCode ?? "",
      lastContactDate: debtor.lastContactDate ?? "",
      nextFollowUpDate: debtor.nextFollowUpDate ?? "",
      chargeOffDate: debtor.chargeOffDate ?? "",
    };
  });
}

export function escapeCsvCell(value: string | number): string {
  // Keep real numbers numeric, while preventing spreadsheet applications from
  // evaluating attacker-controlled text as a formula when the CSV is opened.
  const raw = String(value ?? "");
  // Spreadsheet programs ignore leading whitespace/control characters before
  // deciding whether a cell is a formula. Preserve that original text after
  // the apostrophe so the value remains faithful while always being text.
  const text = typeof value === "string" && /^(?:[\t\r]|[\s\uFEFF]*[=+\-@])/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeAccountRowsToCsv(rows: AccountExportRow[]): string {
  const header = accountExportColumns.map(([, label]) => escapeCsvCell(label)).join(",");
  const body = rows.map((row) =>
    accountExportColumns.map(([key]) => escapeCsvCell(row[key])).join(",")
  );
  return [header, ...body].join("\r\n");
}

export function serializeAccountRowsToJson(rows: AccountExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export async function serializeAccountRowsToXlsx(rows: AccountExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DebtFlow";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Accounts");
  worksheet.columns = accountExportColumns.map(([key, header]) => ({
    key,
    header,
    width: Math.max(14, header.length + 2),
  }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row) => worksheet.addRow(row));
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export type AccountExportFormat = "csv" | "xlsx" | "json";

export async function serializeAccountExport(rows: AccountExportRow[], format: AccountExportFormat) {
  if (format === "xlsx") {
    return {
      body: await serializeAccountRowsToXlsx(rows),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }
  if (format === "json") {
    return {
      body: serializeAccountRowsToJson(rows),
      contentType: "application/json; charset=utf-8",
      extension: "json",
    };
  }
  return {
    body: serializeAccountRowsToCsv(rows),
    contentType: "text/csv; charset=utf-8",
    extension: "csv",
  };
}

export function accountExportFilename(extension: AccountExportFormat, date = new Date()): string {
  const day = Number.isNaN(date.getTime()) ? "unknown-date" : date.toISOString().slice(0, 10);
  return `accounts-export-${day}.${extension}`;
}