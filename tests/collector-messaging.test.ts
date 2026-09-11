import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";
import { MemStorage, storage as routeStorage } from "../server/storage";

test("DMP sends SMS through Chain only for collectors with messaging permission", async () => {
  const memory = new MemStorage();
  const originalMethods = new Map<string, PropertyDescriptor | undefined>();
  for (const name of Object.getOwnPropertyNames(MemStorage.prototype)) {
    if (name === "constructor") continue;
    originalMethods.set(name, Object.getOwnPropertyDescriptor(routeStorage, name));
    Object.defineProperty(routeStorage, name, {
      configurable: true,
      writable: true,
      value: (memory as any)[name].bind(memory),
    });
  }

  const organization = await memory.createOrganization({
    name: "Messaging Test", slug: "messaging-test", isActive: true,
    createdDate: "2026-01-01", ipRestrictionEnabled: false,
  } as any);
  const permitted = await memory.createCollector({
    organizationId: organization.id, name: "Permitted Collector", username: "permitted",
    password: "unused", role: "collector", status: "active", canViewEmail: true,
  } as any);
  const denied = await memory.createCollector({
    organizationId: organization.id, name: "Denied Collector", username: "denied",
    password: "unused", role: "collector", status: "active", canViewEmail: false,
  } as any);
  const portfolio = await memory.createPortfolio({
    organizationId: organization.id, name: "Accounts", purchaseDate: "2026-01-01",
    purchasePrice: 0, totalFaceValue: 10000, totalAccounts: 1,
  } as any);
  const debtor = await memory.createDebtor({
    organizationId: organization.id, portfolioId: portfolio.id, accountNumber: "ACCT-1",
    fileNumber: "1001", firstName: "Ada", lastName: "Lovelace",
    originalBalance: 10000, currentBalance: 7500, status: "open",
  } as any);
  const phone = await memory.createDebtorContact({
    organizationId: organization.id, debtorId: debtor.id, type: "phone",
    value: "2025550101", label: "Mobile", isPrimary: true, isValid: true,
  });
  const template = await memory.createEmailTemplate({
    organizationId: organization.id, name: "Balance reminder", subject: "",
    body: "Hello {{firstName}}, your balance is {{balance}}.",
    templateType: "text", isActive: true, createdDate: "2026-01-01",
  });
  const integration = await memory.createCampaignIntegration({
    organizationId: organization.id, name: "Chain", type: "both",
    apiBaseUrl: "https://chain.test/api", apiKey: "secret-chain-key",
    isActive: true, createdDate: "2026-01-01",
  });

  let sessionCollector = permitted;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { collector: sessionCollector };
    next();
  });
  const server = createServer(app);
  const nativeFetch = globalThis.fetch;
  const deliveries: Array<{ url: string; init?: RequestInit }> = [];

  try {
    await registerRoutes(server, app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/collector/messages/send`;
    const requestBody = {
      debtorId: debtor.id, templateId: template.id,
      contactValue: phone.value, contactType: "phone",
    };

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url === "https://chain.test/api/campaigns/send") {
        deliveries.push({ url, init });
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      return nativeFetch(input, init);
    };

    const permittedResponse = await nativeFetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    assert.equal(permittedResponse.status, 200, await permittedResponse.text());
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].init?.method, "POST");
    assert.equal((deliveries[0].init?.headers as Record<string, string>).Authorization, "Bearer secret-chain-key");
    const chainPayload = JSON.parse(String(deliveries[0].init?.body));
    assert.equal(chainPayload.campaignType, "sms");
    assert.equal(chainPayload.accounts[0].contactType, "phone");
    assert.equal(chainPayload.accounts[0].contactValue, phone.value);
    assert.equal(chainPayload.accounts[0].renderedBody, "Hello Ada, your balance is $75.00.");

    const logs = await memory.getCampaignLogs(organization.id);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, "sent");
    assert.equal(logs[0].sentBy, permitted.id);
    assert.equal(logs[0].integrationId, integration.id);

    sessionCollector = denied;
    const deniedResponse = await nativeFetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    assert.equal(deniedResponse.status, 403);
    assert.match(await deniedResponse.text(), /Messaging is not enabled/);
    assert.equal(deliveries.length, 1, "a denied collector must not reach Chain");
  } finally {
    globalThis.fetch = nativeFetch;
    if (server.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
    for (const [name, descriptor] of originalMethods) {
      if (descriptor) Object.defineProperty(routeStorage, name, descriptor);
      else delete (routeStorage as any)[name];
    }
  }
});
