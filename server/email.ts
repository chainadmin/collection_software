import { ServerClient } from "postmark";
import { db } from "./db";
import { emailSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const SUPER_ADMIN_ORG_ID = "system-super-admin";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function getSuperAdminEmailSettings() {
  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.organizationId, SUPER_ADMIN_ORG_ID))
    .limit(1);
  return settings || null;
}

export async function getOrgEmailSettings(organizationId: string) {
  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.organizationId, organizationId))
    .limit(1);
  return settings || null;
}

// Resolve the Postmark server token. The super admin can store it via the
// dashboard (persisted on the system email-settings row); a POSTMARK_SERVER_TOKEN
// environment secret is used as a fallback. The token is never returned to clients.
function resolvePostmarkToken(token?: string | null): string | null {
  if (token && token.trim()) return token.trim();
  const envToken = process.env.POSTMARK_SERVER_TOKEN;
  if (envToken && envToken.trim()) return envToken.trim();
  return null;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSuperAdminEmailSettings();

    if (!settings || !settings.isActive) {
      console.log("Email not sent - super admin email settings not configured or inactive");
      return { success: false, error: "Email settings not configured or inactive" };
    }

    const token = resolvePostmarkToken(settings.postmarkServerToken);
    if (!token) {
      console.log("Email not sent - missing Postmark server token");
      return { success: false, error: "Postmark server token is not configured" };
    }

    if (!settings.fromEmail) {
      console.log("Email not sent - missing verified from address");
      return { success: false, error: "A verified 'From' email address is required" };
    }

    const client = new ServerClient(token);
    const fromName = settings.fromName || "Debt Manager Pro";

    await client.sendEmail({
      From: `${fromName} <${settings.fromEmail}>`,
      To: options.to,
      Subject: options.subject,
      HtmlBody: options.html,
      TextBody: options.text,
      MessageStream: "outbound",
    });

    console.log(`Email sent successfully to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send email:", error.message);
    return { success: false, error: error.message };
  }
}

function newOrgEmailContent(orgName: string, contactName: string, contactEmail: string, contactPhone: string) {
  return {
    subject: `New Organization Registered: ${orgName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e; border-bottom: 2px solid #4a90d9; padding-bottom: 10px;">New Organization Registration</h2>
        <p>A new organization has registered on Debt Manager Pro:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f8; font-weight: bold; width: 140px;">Company Name</td>
            <td style="padding: 8px 12px; background: #f4f4f8;">${orgName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold;">Contact Name</td>
            <td style="padding: 8px 12px;">${contactName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f8; font-weight: bold;">Email</td>
            <td style="padding: 8px 12px; background: #f4f4f8;">${contactEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold;">Phone</td>
            <td style="padding: 8px 12px;">${contactPhone || "Not provided"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f8; font-weight: bold;">Registration Date</td>
            <td style="padding: 8px 12px; background: #f4f4f8;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 13px;">This is an automated notification from Debt Manager Pro.</p>
      </div>
    `,
    text: `New Organization Registration\n\nCompany: ${orgName}\nContact: ${contactName}\nEmail: ${contactEmail}\nPhone: ${contactPhone || "Not provided"}\nDate: ${new Date().toLocaleString()}`,
  };
}

export async function sendNewOrgNotificationEmail(orgName: string, contactName: string, contactEmail: string, contactPhone: string) {
  const settings = await getSuperAdminEmailSettings();
  const notificationEmail = settings?.notificationEmail || "support@chainsoftwaregroup.com";
  const content = newOrgEmailContent(orgName, contactName, contactEmail, contactPhone);

  return sendEmail({
    to: notificationEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendSignupWelcomeEmail(
  recipientEmail: string,
  contactName: string,
  companyName: string,
  username: string,
) {
  const safeName = escapeHtml(contactName);
  const safeCompany = escapeHtml(companyName);
  const safeUsername = escapeHtml(username);

  return sendEmail({
    to: recipientEmail,
    subject: "Your Debt Manager Pro account is ready",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #172033;">
        <div style="border-bottom: 3px solid #185f68; padding-bottom: 18px; margin-bottom: 24px;">
          <div style="font-size: 13px; font-weight: 700; color: #185f68; letter-spacing: .08em; text-transform: uppercase;">Debt Manager Pro</div>
          <h1 style="font-size: 26px; line-height: 1.25; margin: 8px 0 0;">Your admin account is ready</h1>
        </div>
        <p>Hello ${safeName},</p>
        <p>Your ${safeCompany} workspace has been created and your 14-day free trial is now active.</p>
        <div style="background: #eef6f5; border: 1px solid #c9e1de; border-radius: 10px; padding: 18px 20px; margin: 24px 0;">
          <div style="font-size: 12px; color: #53636a; text-transform: uppercase; letter-spacing: .06em;">Your username</div>
          <div style="font-size: 20px; font-weight: 700; margin-top: 5px;">${safeUsername}</div>
        </div>
        <p>Use the password you created during registration when you log in. For your security, your password is never included in email.</p>
        <p>You can download the admin system from the confirmation screen shown after registration, or open Debt Manager Pro in your browser and log in with the username above.</p>
        <p style="margin-top: 28px;">Need help? Contact <a href="mailto:support@chainsoftwaregroup.com" style="color: #185f68;">support@chainsoftwaregroup.com</a>.</p>
        <p style="color: #66727a; font-size: 13px; margin-top: 32px;">This is an automated account confirmation from Debt Manager Pro.</p>
      </div>
    `,
    text: `Hello ${contactName},

Your ${companyName} Debt Manager Pro workspace is ready and your 14-day free trial is active.

Your username is: ${username}

Use the password you created during registration to log in. For your security, your password is never included in email.

You can download the admin system from the confirmation screen shown after registration. Need help? Contact support@chainsoftwaregroup.com.`,
  });
}

// Send an email to an organization's configured notification recipients. The
// system Postmark transport is used; the recipients come from the org's own
// email-settings row (tenant isolated). Returns success:false when the org has
// not configured any recipients.
export async function sendOrgNotificationEmail(
  organizationId: string,
  subject: string,
  html: string,
  text?: string,
): Promise<{ success: boolean; error?: string }> {
  const orgSettings = await getOrgEmailSettings(organizationId);

  if (!orgSettings?.isActive) {
    return { success: false, error: "Email notifications are disabled for this organization" };
  }

  const recipients = (orgSettings.notificationEmail || "")
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, error: "No notification recipients configured for this organization" };
  }

  return sendEmail({ to: recipients.join(","), subject, html, text });
}
