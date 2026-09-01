import assert from "node:assert/strict";
import test from "node:test";
import type { Organization } from "../shared/schema";
import {
  buildDeclineMessage,
  buildReceiptMessage,
  getPaymentMessageAutomationSettings,
  mergePaymentMessageAutomationLogo,
  mergePaymentMessageAutomationSettings,
  paymentMessageLogoUrl,
  validatePaymentMessageLogo,
} from "../server/payment-message-automation";
import { MemStorage } from "../server/storage";
import { isActiveAdminOrManagerRecord } from "../server/access-control";
import express from "express";
import { registerPaymentMessageAutomationRoutes, registerPaymentMessagePublicLogoRoute } from "../server/payment-message-routes";

const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).toString("base64")}`;
const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")}`;
const webp = `data:image/webp;base64,${Buffer.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).toString("base64")}`;
const org = (settings: string | null = null) => ({
  id: "org/a",
  name: "A < Agency",
  settings,
} as Organization);

test("payment logo validation accepts matching magic bytes and rejects malformed, spoofed, and oversized uploads", () => {
  assert.equal(validatePaymentMessageLogo(png).ok, true);
  assert.equal(validatePaymentMessageLogo(jpeg).ok, true);
  assert.equal(validatePaymentMessageLogo(webp).ok, true);
  assert.equal(validatePaymentMessageLogo("data:image/jpeg;base64,iVBORw0KGgoA").ok, false);
  assert.equal(validatePaymentMessageLogo("data:image/gif;base64,R0lGODlh").ok, false);
  assert.equal(validatePaymentMessageLogo("data:image/png;base64,not valid").ok, false);
  assert.equal(validatePaymentMessageLogo(`${png}=`).ok, false);
  const huge = Buffer.alloc(2 * 1024 * 1024 + 1);
  huge.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = validatePaymentMessageLogo(`data:image/png;base64,${huge.toString("base64")}`);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});

test("atomic settings updates keep concurrent normal settings and logo operations", async () => {
  const storage = new MemStorage();
  const original = await storage.getOrganization("default-org");
  assert.ok(original);
  const logo = validatePaymentMessageLogo(png);
  assert.ok(logo.ok);
  await Promise.all([
    storage.updateOrganizationSettingsAtomic(original.id, (latest) =>
      mergePaymentMessageAutomationSettings(latest, { enabled: true, callbackPhone: "555-0100" }),
    ),
    storage.updateOrganizationSettingsAtomic(original.id, (latest) =>
      mergePaymentMessageAutomationLogo(latest, logo.logo),
    ),
  ]);
  const branded = await storage.getOrganization(original.id);
  assert.ok(branded);
  assert.equal(getPaymentMessageAutomationSettings(branded).enabled, true);
  assert.equal(getPaymentMessageAutomationSettings(branded).logo?.dataUrl, png);

  await Promise.all([
    storage.updateOrganizationSettingsAtomic(original.id, (latest) =>
      mergePaymentMessageAutomationSettings(latest, { callbackEmail: "support@example.test" }),
    ),
    storage.updateOrganizationSettingsAtomic(original.id, (latest) =>
      mergePaymentMessageAutomationLogo(latest, null),
    ),
  ]);
  const removed = await storage.getOrganization(original.id);
  assert.ok(removed);
  assert.equal(getPaymentMessageAutomationSettings(removed).callbackEmail, "support@example.test");
  assert.equal(getPaymentMessageAutomationSettings(removed).logo, undefined);
});

test("live payment automation role policy rejects stale, inactive, and foreign collectors", () => {
  const session = { id: "collector-1" };
  assert.equal(isActiveAdminOrManagerRecord(session, { id: "collector-1", status: "active", organizationId: "org-1", role: "admin" }, "org-1"), true);
  assert.equal(isActiveAdminOrManagerRecord(session, { id: "collector-1", status: "active", organizationId: "org-1", role: "manager" }, "org-1"), true);
  assert.equal(isActiveAdminOrManagerRecord(session, { id: "collector-1", status: "inactive", organizationId: "org-1", role: "admin" }, "org-1"), false);
  assert.equal(isActiveAdminOrManagerRecord(session, { id: "collector-1", status: "active", organizationId: "org-2", role: "admin" }, "org-1"), false);
  assert.equal(isActiveAdminOrManagerRecord(session, { id: "collector-1", status: "active", organizationId: "org-1", role: "collector" }, "org-1"), false);
  assert.equal(isActiveAdminOrManagerRecord(session, { id: "collector-2", status: "active", organizationId: "org-1", role: "admin" }, "org-1"), false);
});

test("production payment-message routes enforce live tenancy and serve only validated public logo bytes", async () => {
  const storage = new MemStorage();
  const collectors = await storage.getCollectors();
  const manager = collectors.find((collector) => collector.role === "manager")!;
  const collector = collectors.find((entry) => entry.role === "collector")!;
  const other = await storage.createOrganization({ name: "Other", slug: "other", createdDate: "2026-01-01" } as any);
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use((req: any, _res, next) => {
    const kind = req.headers["x-case"];
    if (kind === "manager") req.session = { collector: { id: manager.id, organizationId: manager.organizationId } };
    if (kind === "collector") req.session = { collector: { id: collector.id, organizationId: collector.organizationId } };
    if (kind === "foreign") req.session = { collector: { id: manager.id, organizationId: other.id } };
    if (kind === "mismatch") req.session = { collector: { id: "not-the-live-id", organizationId: manager.organizationId } };
    next();
  });
  registerPaymentMessagePublicLogoRoute(app, storage);
  registerPaymentMessageAutomationRoutes(app, storage);
  const server = await new Promise<import("http").Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, init);
  try {
    assert.equal((await request("/api/payment-message-automation")).status, 401);
    assert.equal((await request("/api/payment-message-automation", { headers: { "x-case": "collector" } })).status, 403);
    assert.equal((await request("/api/payment-message-automation", { headers: { "x-case": "foreign" } })).status, 403);
    assert.equal((await request("/api/payment-message-automation", { headers: { "x-case": "mismatch" } })).status, 403);
    await storage.updateCollector(manager.id, { status: "inactive" });
    assert.equal((await request("/api/payment-message-automation", { headers: { "x-case": "manager" } })).status, 403);
    await storage.updateCollector(manager.id, { status: "active" });
    assert.equal((await request("/api/payment-message-automation", { headers: { "x-case": "manager" } })).status, 200);
    await storage.updateCollector(manager.id, { role: "admin" });
    assert.equal((await request("/api/payment-message-automation", { headers: { "x-case": "manager" } })).status, 200);
    await storage.updateCollector(manager.id, { role: "manager" });

    const post = (path: string, body: unknown) => request(path, { method: "POST", headers: { "x-case": "manager", "content-type": "application/json" }, body: JSON.stringify(body) });
    const upload = await post("/api/payment-message-automation/logo", { dataUrl: png, filename: "brand.png", organizationId: other.id });
    assert.equal(upload.status, 200);
    const settings = await (await request("/api/payment-message-automation", { headers: { "x-case": "manager" } })).json();
    assert.equal(settings.logoPreviewUrl.includes(encodeURIComponent(manager.organizationId)), true);
    assert.equal("dataUrl" in settings, false);
    assert.equal(getPaymentMessageAutomationSettings(await storage.getOrganization(other.id)).logo, undefined);
    const publicOne = await request(settings.logoPreviewUrl);
    const firstEtag = publicOne.headers.get("etag");
    assert.equal(publicOne.headers.get("content-type"), "image/png");
    assert.equal(publicOne.headers.get("x-content-type-options"), "nosniff");
    assert.match(publicOne.headers.get("cache-control") || "", /max-age=60/);
    assert.deepEqual(Buffer.from(await publicOne.arrayBuffer()), Buffer.from(png.split(",")[1], "base64"));
    assert.equal((await request(settings.logoPreviewUrl, { headers: { "if-none-match": firstEtag! } })).status, 304);
    const png2 = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64")}`;
    assert.equal((await post("/api/payment-message-automation/logo", { dataUrl: png2 })).status, 200);
    const replacementSettings = await (await request("/api/payment-message-automation", { headers: { "x-case": "manager" } })).json();
    assert.notEqual(replacementSettings.logoPreviewUrl, settings.logoPreviewUrl);
    const replacementPublic = await request(replacementSettings.logoPreviewUrl);
    assert.notEqual(replacementPublic.headers.get("etag"), firstEtag);
    assert.deepEqual(Buffer.from(await replacementPublic.arrayBuffer()), Buffer.from(png2.split(",")[1], "base64"));
    assert.equal((await post("/api/payment-message-automation/logo", { dataUrl: "data:image/jpeg;base64,iVBORw0KGgoA" })).status, 400);
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1); oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal((await post("/api/payment-message-automation/logo", { dataUrl: `data:image/png;base64,${oversized.toString("base64")}` })).status, 413);
    assert.equal((await request("/api/payment-message-automation/logo/not-found")).status, 404);
    assert.equal((await request("/api/payment-message-automation/logo", { method: "DELETE", headers: { "x-case": "manager" } })).status, 204);
    assert.equal((await request(settings.logoPreviewUrl)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("logo merges persist, replace, remove, and normal settings cannot inject an external URL", () => {
  const first = validatePaymentMessageLogo(png);
  assert.ok(first.ok);
  const withLogo = org(mergePaymentMessageAutomationLogo(org(), first.logo));
  assert.equal(getPaymentMessageAutomationSettings(withLogo).logo?.dataUrl, png);
  const saved = org(mergePaymentMessageAutomationSettings(withLogo, { enabled: true, callbackEmail: "a@example.test" }));
  const settings = getPaymentMessageAutomationSettings(saved);
  assert.equal(settings.enabled, true);
  assert.equal(settings.logo?.dataUrl, png);
  assert.equal((settings as any).logoUrl, undefined);
  const removed = org(mergePaymentMessageAutomationLogo(saved, null));
  assert.equal(getPaymentMessageAutomationSettings(removed).logo, undefined);
});

test("payment email HTML embeds custom logo for receipt and decline and defaults safely", () => {
  const validated = validatePaymentMessageLogo(png);
  assert.ok(validated.ok);
  const branded = org(mergePaymentMessageAutomationLogo(org(), validated.logo));
  const debtor = { firstName: "<Debtor>" } as any;
  const payment = { amount: 1250, paymentDate: "2026-01-02" } as any;
  assert.match(buildReceiptMessage(branded, debtor, payment, "<txn>", {}, true), new RegExp(png.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(buildDeclineMessage(branded, debtor, payment, "<reason>", {}, true), new RegExp(png.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(buildReceiptMessage(org(), debtor, payment, null, {}, true), /src="\/logo\.png"/);
  assert.match(buildReceiptMessage(org(), debtor, payment, null, {}, true), /Hello &lt;Debtor&gt;/);
  assert.equal(paymentMessageLogoUrl("org/a"), "/payment-message-automation/logo/org%2Fa");
});