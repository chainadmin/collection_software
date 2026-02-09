import nodemailer from "nodemailer";
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

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getSuperAdminEmailSettings();

    if (!settings || !settings.isActive) {
      console.log("Email not sent - super admin email settings not configured or inactive");
      return { success: false, error: "Email settings not configured or inactive" };
    }

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      console.log("Email not sent - incomplete SMTP configuration");
      return { success: false, error: "Incomplete SMTP configuration" };
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure ?? false,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: `"${settings.fromName || "Debt Manager Pro"}" <${settings.fromEmail || settings.smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log(`Email sent successfully to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send email:", error.message);
    return { success: false, error: error.message };
  }
}

export async function sendNewOrgNotificationEmail(orgName: string, contactName: string, contactEmail: string, contactPhone: string) {
  const settings = await getSuperAdminEmailSettings();
  const notificationEmail = settings?.notificationEmail || "support@chainsoftwaregroup.com";

  return sendEmail({
    to: notificationEmail,
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
  });
}
