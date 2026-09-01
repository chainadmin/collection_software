import type { Debtor, Organization, Payment } from "@shared/schema";
import type { IStorage } from "./storage";
import { createHash } from "crypto";

export interface PaymentMessageAutomationSettings {
  enabled?: boolean;
  sendDeclineEmail?: boolean;
  sendDeclineSms?: boolean;
  sendReceiptEmail?: boolean;
  sendReceiptSms?: boolean;
  callbackPhone?: string;
  callbackEmail?: string;
  logo?: PaymentMessageLogo;
}

export interface PaymentMessageLogo {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  filename?: string;
  sha256: string;
}

export interface PaymentMessageContext {
  payment: Payment;
  success: boolean;
  transactionId: string | null;
  declineReason: string | null;
}

function parseOrganizationSettings(org: Organization | undefined): Record<string, any> {
  if (!org?.settings) return {};
  try {
    const parsed = JSON.parse(org.settings);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getPaymentMessageAutomationSettings(org: Organization | undefined): PaymentMessageAutomationSettings {
  const settings = parseOrganizationSettings(org);
  const paymentAutomation = settings.paymentMessageAutomation;
  return paymentAutomation && typeof paymentAutomation === "object" ? paymentAutomation : {};
}

export function getPaymentMessageAutomationSettingsResponse(org: Organization): Omit<PaymentMessageAutomationSettings, "logo"> & { logoPreviewUrl: string | null; logoFilename: string | null } {
  const settings = getPaymentMessageAutomationSettings(org);
  const logo = existingValidLogo(org);
  return {
    ...(typeof settings.enabled === "boolean" ? { enabled: settings.enabled } : {}),
    ...(typeof settings.sendDeclineEmail === "boolean" ? { sendDeclineEmail: settings.sendDeclineEmail } : {}),
    ...(typeof settings.sendDeclineSms === "boolean" ? { sendDeclineSms: settings.sendDeclineSms } : {}),
    ...(typeof settings.sendReceiptEmail === "boolean" ? { sendReceiptEmail: settings.sendReceiptEmail } : {}),
    ...(typeof settings.sendReceiptSms === "boolean" ? { sendReceiptSms: settings.sendReceiptSms } : {}),
    ...(typeof settings.callbackPhone === "string" ? { callbackPhone: settings.callbackPhone } : {}),
    ...(typeof settings.callbackEmail === "string" ? { callbackEmail: settings.callbackEmail } : {}),
    logoPreviewUrl: logo ? `${paymentMessageLogoUrl(org.id)}?v=${logo.sha256.slice(0, 16)}` : null,
    logoFilename: logo?.filename || null,
  };
}

export function paymentMessageLogoUrl(orgId: string): string {
  return `/payment-message-automation/logo/${encodeURIComponent(orgId)}`;
}

function existingValidLogo(org: Organization): PaymentMessageLogo | undefined {
  const logo = getPaymentMessageAutomationSettings(org).logo;
  if (!logo || typeof logo !== "object" || typeof logo.dataUrl !== "string") return undefined;
  const validation = validatePaymentMessageLogo(logo.dataUrl);
  return validation.ok ? { ...validation.logo, filename: typeof logo.filename === "string" ? logo.filename : undefined } : undefined;
}

export function mergePaymentMessageAutomationSettings(
  org: Organization,
  paymentMessageAutomation: PaymentMessageAutomationSettings,
): string {
  const current = parseOrganizationSettings(org);
  const { logoUrl: _legacyLogoUrl, ...currentPaymentSettings } = getPaymentMessageAutomationSettings(org) as PaymentMessageAutomationSettings & { logoUrl?: unknown };
  return JSON.stringify({
    ...current,
    paymentMessageAutomation: {
      ...currentPaymentSettings,
      ...paymentMessageAutomation,
      logo: existingValidLogo(org),
    },
  });
}

export function mergePaymentMessageAutomationLogo(org: Organization, logo: PaymentMessageLogo | null): string {
  const current = parseOrganizationSettings(org);
  const { logo: _oldLogo, logoUrl: _legacyLogoUrl, ...settings } = getPaymentMessageAutomationSettings(org) as PaymentMessageAutomationSettings & { logoUrl?: unknown };
  return JSON.stringify({
    ...current,
    paymentMessageAutomation: { ...settings, ...(logo ? { logo } : {}) },
  });
}

export type LogoValidationResult =
  | { ok: true; logo: PaymentMessageLogo }
  | { ok: false; status: 400 | 413; error: string };

const LOGO_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function imageMimeFromBytes(bytes: Buffer): PaymentMessageLogo["mimeType"] | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
}

export function validatePaymentMessageLogo(dataUrl: unknown): LogoValidationResult {
  if (typeof dataUrl !== "string") return { ok: false, status: 400, error: "Logo must be a base64 PNG, JPEG, or WebP data URL." };
  const match = dataUrl.match(LOGO_DATA_URL);
  if (!match || match[2].length % 4 !== 0) return { ok: false, status: 400, error: "Logo must be a strictly formatted base64 PNG, JPEG, or WebP data URL." };
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return { ok: false, status: 400, error: "Logo image cannot be empty." };
  if (bytes.toString("base64") !== match[2]) return { ok: false, status: 400, error: "Logo must use canonical base64 encoding." };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, status: 413, error: "Logo image must be 2 MiB or smaller." };
  const claimedMime = match[1] as PaymentMessageLogo["mimeType"];
  const detectedMime = imageMimeFromBytes(bytes);
  if (!detectedMime || detectedMime !== claimedMime) return { ok: false, status: 400, error: "Logo file contents do not match its claimed image type." };
  return {
    ok: true,
    logo: {
      dataUrl: `data:${claimedMime};base64,${bytes.toString("base64")}`,
      mimeType: claimedMime,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

function formatMoney(cents: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return new Date().toLocaleDateString("en-US");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getCompanyLogoUrl(org: Organization, settings: PaymentMessageAutomationSettings): string {
  const stored = existingValidLogo(org);
  if (stored) return stored.dataUrl;
  const supplied = validatePaymentMessageLogo(settings.logo?.dataUrl);
  return supplied.ok ? supplied.logo.dataUrl : "/logo.png";
}

function buildContactLine(settings: PaymentMessageAutomationSettings): string {
  const phone = settings.callbackPhone?.trim();
  const email = settings.callbackEmail?.trim();
  if (phone && email) return `call ${phone} or email ${email}`;
  if (phone) return `call ${phone}`;
  if (email) return `email ${email}`;
  return "contact our office";
}

export function buildDeclineMessage(org: Organization, debtor: Debtor, payment: Payment, reason: string | null, settings: PaymentMessageAutomationSettings, html: boolean): string {
  const firstName = debtor.firstName || "there";
  const amount = formatMoney(payment.amount);
  const date = formatDate(payment.paymentDate);
  const declineReason = reason || "the payment was not approved";
  const contactLine = buildContactLine(settings);

  if (!html) {
    return `Hello ${firstName}, your payment to ${org.name} for ${amount} dated ${date} came back as declined. Reason: ${declineReason}. Please ${contactLine} to rectify this. Thank you.`;
  }

  const logoUrl = getCompanyLogoUrl(org, settings);
  return `
<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;max-width:640px;">
  <div style="margin-bottom:16px;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(org.name)} logo" style="max-height:64px;max-width:220px;" /></div>
  <p>Hello ${escapeHtml(firstName)},</p>
  <p>Your payment to <strong>${escapeHtml(org.name)}</strong> for <strong>${escapeHtml(amount)}</strong> dated <strong>${escapeHtml(date)}</strong> came back as declined.</p>
  <p><strong>Decline reason:</strong> ${escapeHtml(declineReason)}</p>
  <p>Please ${escapeHtml(contactLine)} to rectify this.</p>
  <p>Thank you,<br />${escapeHtml(org.name)}</p>
</div>`.trim();
}

export function buildReceiptMessage(org: Organization, debtor: Debtor, payment: Payment, transactionId: string | null, settings: PaymentMessageAutomationSettings, html: boolean): string {
  const firstName = debtor.firstName || "there";
  const amount = formatMoney(payment.amount);
  const date = formatDate(payment.paymentDate);
  const contactLine = buildContactLine(settings);
  const txnLine = transactionId ? ` Transaction ID: ${transactionId}.` : "";

  if (!html) {
    return `Hello ${firstName}, your payment to ${org.name} for ${amount} dated ${date} was approved.${txnLine} If you have questions, please ${contactLine}. Thank you.`;
  }

  const logoUrl = getCompanyLogoUrl(org, settings);
  return `
<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;max-width:640px;">
  <div style="margin-bottom:16px;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(org.name)} logo" style="max-height:64px;max-width:220px;" /></div>
  <p>Hello ${escapeHtml(firstName)},</p>
  <p>Your payment to <strong>${escapeHtml(org.name)}</strong> for <strong>${escapeHtml(amount)}</strong> dated <strong>${escapeHtml(date)}</strong> was approved.</p>
  ${transactionId ? `<p><strong>Transaction ID:</strong> ${escapeHtml(transactionId)}</p>` : ""}
  <p>If you have questions, please ${escapeHtml(contactLine)}.</p>
  <p>Thank you,<br />${escapeHtml(org.name)}</p>
</div>`.trim();
}

async function sendGeneratedPaymentMessage(
  storage: IStorage,
  org: Organization,
  debtor: Debtor,
  payment: Payment,
  settings: PaymentMessageAutomationSettings,
  channel: "email" | "sms",
  context: PaymentMessageContext,
): Promise<void> {
  const contacts = await storage.getDebtorContacts(debtor.id);
  const contactValue = channel === "email"
    ? debtor.email || contacts.find((c) => c.type === "email" && c.isPrimary && c.isValid !== false)?.value || contacts.find((c) => c.type === "email" && c.isValid !== false)?.value
    : contacts.find((c) => c.type === "phone" && c.isPrimary && c.isValid !== false)?.value || contacts.find((c) => c.type === "phone" && c.isValid !== false)?.value;

  if (!contactValue) {
    await storage.createNote({
      organizationId: org.id,
      debtorId: debtor.id,
      collectorId: payment.processedBy || "system",
      content: `Automatic ${context.success ? "receipt" : "decline"} ${channel} not sent: no valid ${channel === "email" ? "email address" : "phone number"} on file.`,
      noteType: "payment_message",
      createdDate: new Date().toISOString().split("T")[0],
    });
    return;
  }

  const integrations = await storage.getCampaignIntegrations(org.id);
  const integration = integrations.find((i) => i.isActive);
  if (!integration) {
    await storage.createNote({
      organizationId: org.id,
      debtorId: debtor.id,
      collectorId: payment.processedBy || "system",
      content: `Automatic ${context.success ? "receipt" : "decline"} ${channel} not sent: no active Chain provider configured.`,
      noteType: "payment_message",
      createdDate: new Date().toISOString().split("T")[0],
    });
    return;
  }

  const typeLabel = context.success ? "Payment Receipt" : "Payment Decline Notice";
  const isEmail = channel === "email";
  const subject = context.success
    ? `Payment receipt from ${org.name}`
    : `Payment declined - ${org.name}`;
  const body = context.success
    ? buildReceiptMessage(org, debtor, payment, context.transactionId, settings, isEmail)
    : buildDeclineMessage(org, debtor, payment, context.declineReason, settings, isEmail);

  const campaignLog = await storage.createCampaignLog({
    organizationId: org.id,
    integrationId: integration.id,
    campaignName: `${typeLabel} - ${debtor.fileNumber || debtor.accountNumber || debtor.id}`,
    campaignType: channel,
    totalAccounts: 1,
    status: "pending",
    sentDate: new Date().toISOString(),
    sentBy: payment.processedBy || "system",
    errorMessage: null,
  });

  const item = await storage.createCampaignLogItem({
    campaignLogId: campaignLog.id,
    debtorId: debtor.id,
    fileNumber: debtor.fileNumber || debtor.accountNumber || debtor.id,
    contactValue,
    contactType: isEmail ? "email" : "phone",
    status: "queued",
    externalId: null,
    responseText: null,
  });

  const payload = {
    organizationId: org.id,
    campaignLogId: campaignLog.id,
    campaignName: campaignLog.campaignName,
    campaignType: channel,
    template: {
      id: `system-${context.success ? "receipt" : "decline"}-${channel}`,
      name: typeLabel,
      type: channel,
      subject: isEmail ? subject : "",
      body,
    },
    accounts: [{
      fileNumber: item.fileNumber,
      contactValue: item.contactValue,
      contactType: item.contactType,
      renderedSubject: isEmail ? subject : "",
      renderedBody: body,
    }],
  };

  const externalResponse = await fetch(`${integration.apiBaseUrl.replace(/\/$/, "")}/campaigns/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!externalResponse.ok) {
    const errorText = await externalResponse.text();
    await storage.updateCampaignLog(campaignLog.id, { status: "failed", errorMessage: errorText || "External send failed" });
    await storage.updateCampaignLogItem(item.id, { status: "failed", responseText: errorText || "External send failed" });
    await storage.createNote({
      organizationId: org.id,
      debtorId: debtor.id,
      collectorId: payment.processedBy || "system",
      content: `Automatic ${context.success ? "receipt" : "decline"} ${channel} failed: ${errorText || "External send failed"}`,
      noteType: "payment_message",
      createdDate: new Date().toISOString().split("T")[0],
    });
    return;
  }

  await storage.updateCampaignLog(campaignLog.id, { status: "sent", errorMessage: null });
  await storage.updateCampaignLogItem(item.id, { status: "sent" });
  await storage.createNote({
    organizationId: org.id,
    debtorId: debtor.id,
    collectorId: payment.processedBy || "system",
    content: `Automatic ${context.success ? "receipt" : "decline notice"} ${channel} sent to ${contactValue}.`,
    noteType: "payment_message",
    createdDate: new Date().toISOString().split("T")[0],
  });
}

export async function sendPaymentOutcomeAutomation(
  storage: IStorage,
  orgId: string,
  debtor: Debtor | undefined,
  context: PaymentMessageContext,
): Promise<void> {
  if (!debtor) return;
  const org = await storage.getOrganization(orgId);
  if (!org) return;

  const settings = getPaymentMessageAutomationSettings(org);
  if (!settings.enabled) return;

  const shouldSendEmail = context.success ? settings.sendReceiptEmail : settings.sendDeclineEmail;
  const shouldSendSms = context.success ? settings.sendReceiptSms : settings.sendDeclineSms;
  const tasks: Array<Promise<void>> = [];

  if (shouldSendEmail) tasks.push(sendGeneratedPaymentMessage(storage, org, debtor, context.payment, settings, "email", context));
  if (shouldSendSms) tasks.push(sendGeneratedPaymentMessage(storage, org, debtor, context.payment, settings, "sms", context));

  await Promise.all(tasks);
}
