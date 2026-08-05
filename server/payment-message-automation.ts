import type { Debtor, Organization, Payment } from "@shared/schema";
import type { IStorage } from "./storage";

export interface PaymentMessageAutomationSettings {
  enabled?: boolean;
  sendDeclineEmail?: boolean;
  sendDeclineSms?: boolean;
  sendReceiptEmail?: boolean;
  sendReceiptSms?: boolean;
  callbackPhone?: string;
  callbackEmail?: string;
  logoUrl?: string;
}

interface PaymentMessageContext {
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

export function mergePaymentMessageAutomationSettings(
  org: Organization,
  paymentMessageAutomation: PaymentMessageAutomationSettings,
): string {
  const current = parseOrganizationSettings(org);
  return JSON.stringify({
    ...current,
    paymentMessageAutomation: {
      ...getPaymentMessageAutomationSettings(org),
      ...paymentMessageAutomation,
    },
  });
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

function getCompanyLogoUrl(org: Organization, settings: PaymentMessageAutomationSettings): string {
  if (settings.logoUrl?.trim()) return settings.logoUrl.trim();
  return "/logo.png";
}

function buildContactLine(settings: PaymentMessageAutomationSettings): string {
  const phone = settings.callbackPhone?.trim();
  const email = settings.callbackEmail?.trim();
  if (phone && email) return `call ${phone} or email ${email}`;
  if (phone) return `call ${phone}`;
  if (email) return `email ${email}`;
  return "contact our office";
}

function buildDeclineMessage(org: Organization, debtor: Debtor, payment: Payment, reason: string | null, settings: PaymentMessageAutomationSettings, html: boolean): string {
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

function buildReceiptMessage(org: Organization, debtor: Debtor, payment: Payment, transactionId: string | null, settings: PaymentMessageAutomationSettings, html: boolean): string {
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
