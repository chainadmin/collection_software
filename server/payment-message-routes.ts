import type { Express } from "express";
import type { IStorage } from "./storage";
import { isActiveAdminOrManagerRecord } from "./access-control";
import {
  getPaymentMessageAutomationSettings,
  getPaymentMessageAutomationSettingsResponse,
  mergePaymentMessageAutomationLogo,
  mergePaymentMessageAutomationSettings,
  paymentMessageLogoUrl,
  validatePaymentMessageLogo,
} from "./payment-message-automation";

function sessionOrganizationId(req: any): string | undefined {
  return req.session?.collector?.organizationId;
}

async function allowed(req: any, storage: IStorage): Promise<string | undefined> {
  const orgId = sessionOrganizationId(req);
  const sessionCollector = req.session?.collector;
  if (!orgId || !sessionCollector?.id) return undefined;
  const live = await storage.getCollector(sessionCollector.id);
  return isActiveAdminOrManagerRecord(sessionCollector, live, orgId) ? orgId : undefined;
}

export function registerPaymentMessagePublicLogoRoute(app: Express, storage: IStorage): void {
  app.get("/payment-message-automation/logo/:organizationId", async (req, res) => {
    try {
      const organization = await storage.getOrganization(req.params.organizationId);
      if (!organization) return res.status(404).json({ error: "Logo not found" });
      const checked = validatePaymentMessageLogo(getPaymentMessageAutomationSettings(organization).logo?.dataUrl);
      if (!checked.ok) return res.status(404).json({ error: "Logo not found" });
      const etag = `"${checked.logo.sha256}"`;
      if (req.headers["if-none-match"] === etag) return res.status(304).end();
      res.set({
        "Content-Type": checked.logo.mimeType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=60, must-revalidate",
        ETag: etag,
      });
      return res.send(Buffer.from(checked.logo.dataUrl.split(",")[1], "base64"));
    } catch {
      return res.status(500).json({ error: "Failed to fetch logo" });
    }
  });
}

export function registerPaymentMessageAutomationRoutes(app: Express, storage: IStorage): void {
  app.get("/api/payment-message-automation", async (req: any, res) => {
    try {
      const orgId = await allowed(req, storage);
      if (!orgId) return res.status(req.session?.collector ? 403 : 401).json({ error: "Only admins and managers can manage payment message automation" });
      const organization = await storage.getOrganization(orgId);
      if (!organization) return res.status(404).json({ error: "Organization not found" });
      return res.json(getPaymentMessageAutomationSettingsResponse(organization));
    } catch { return res.status(500).json({ error: "Failed to fetch payment message automation settings" }); }
  });

  app.post("/api/payment-message-automation", async (req: any, res) => {
    try {
      const orgId = await allowed(req, storage);
      if (!orgId) return res.status(req.session?.collector ? 403 : 401).json({ error: "Only admins and managers can manage payment message automation" });
      const clean = {
        enabled: Boolean(req.body.enabled), sendDeclineEmail: Boolean(req.body.sendDeclineEmail),
        sendDeclineSms: Boolean(req.body.sendDeclineSms), sendReceiptEmail: Boolean(req.body.sendReceiptEmail),
        sendReceiptSms: Boolean(req.body.sendReceiptSms), callbackPhone: String(req.body.callbackPhone || "").trim(),
        callbackEmail: String(req.body.callbackEmail || "").trim(),
      };
      const updated = await storage.updateOrganizationSettingsAtomic(orgId, (latest) => mergePaymentMessageAutomationSettings(latest, clean));
      if (!updated) return res.status(404).json({ error: "Organization not found" });
      return res.json(getPaymentMessageAutomationSettingsResponse(updated));
    } catch { return res.status(500).json({ error: "Failed to save payment message automation settings" }); }
  });

  app.post("/api/payment-message-automation/logo", async (req: any, res) => {
    try {
      const orgId = await allowed(req, storage);
      if (!orgId) return res.status(req.session?.collector ? 403 : 401).json({ error: "Only admins and managers can manage payment message automation" });
      const checked = validatePaymentMessageLogo(req.body?.dataUrl);
      if (!checked.ok) return res.status(checked.status).json({ error: checked.error });
      const filename = typeof req.body?.filename === "string" ? req.body.filename.replace(/[^\w.\- ]/g, "").slice(0, 160) : undefined;
      const updated = await storage.updateOrganizationSettingsAtomic(orgId, (latest) => mergePaymentMessageAutomationLogo(latest, { ...checked.logo, filename }));
      if (!updated) return res.status(404).json({ error: "Organization not found" });
      return res.json({ logoPreviewUrl: `${paymentMessageLogoUrl(orgId)}?v=${checked.logo.sha256.slice(0, 16)}`, logoFilename: filename || null });
    } catch { return res.status(500).json({ error: "Failed to upload logo" }); }
  });

  app.delete("/api/payment-message-automation/logo", async (req: any, res) => {
    try {
      const orgId = await allowed(req, storage);
      if (!orgId) return res.status(req.session?.collector ? 403 : 401).json({ error: "Only admins and managers can manage payment message automation" });
      const updated = await storage.updateOrganizationSettingsAtomic(orgId, (latest) => mergePaymentMessageAutomationLogo(latest, null));
      if (!updated) return res.status(404).json({ error: "Organization not found" });
      return res.status(204).send();
    } catch { return res.status(500).json({ error: "Failed to remove logo" }); }
  });
}