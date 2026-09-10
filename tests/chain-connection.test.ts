import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { MemStorage, storage } from "../server/storage";
import { registerChainConnectionTestRoute, registerExternalApiRoutes } from "../server/external-api";

async function fixture() {
  // External routes import the application storage singleton. Swap its backing
  // implementation for an isolated in-memory store for this HTTP test.
  const memory = new MemStorage();
  const originalPrototype = Object.getPrototypeOf(storage);
  const originalProperties = Object.getOwnPropertyDescriptors(storage);
  Object.setPrototypeOf(storage, Object.getPrototypeOf(memory));
  Object.assign(storage, memory);

  const alpha = await memory.createOrganization({ name: "Alpha", slug: "alpha", createdDate: "2025-01-01", isActive: true });
  const beta = await memory.createOrganization({ name: "Beta", slug: "beta", createdDate: "2025-01-01", isActive: true });
  const empty = await memory.createOrganization({ name: "Empty", slug: "empty", createdDate: "2025-01-01", isActive: true });
  const admin = await memory.createCollector({
    organizationId: alpha.id, username: "admin", password: "hash", name: "Admin", role: "admin", status: "active", createdDate: "2025-01-01",
  });
  const agent = await memory.createCollector({
    organizationId: alpha.id, username: "agent", password: "hash", name: "Agent", role: "collector", status: "active", createdDate: "2025-01-01",
  });
  const manager = await memory.createCollector({
    organizationId: empty.id, username: "manager", password: "hash", name: "Manager", role: "manager", status: "active", createdDate: "2025-01-01",
  });
  const alphaKey = await memory.createApiToken({
    organizationId: alpha.id, name: "Chain", token: "dmv2_alpha_test_key", isActive: true, createdDate: "2025-01-01",
  });
  const betaKey = await memory.createApiToken({
    organizationId: beta.id, name: "Chain", token: "dmv2_beta_test_key", isActive: true, createdDate: "2025-01-01",
  });
  const emptyKey = await memory.createApiToken({
    organizationId: empty.id, name: "Chain", token: "dmv2_empty_test_key", isActive: true, createdDate: "2025-01-01",
  });
  const alphaPortfolio = await memory.createPortfolio({
    organizationId: alpha.id, name: "Alpha portfolio", purchaseDate: "2025-01-01", purchasePrice: 100, totalFaceValue: 200, totalAccounts: 1,
  });
  const betaPortfolio = await memory.createPortfolio({
    organizationId: beta.id, name: "Beta portfolio", purchaseDate: "2025-01-01", purchasePrice: 100, totalFaceValue: 200, totalAccounts: 1,
  });
  const alphaDebtor = await memory.createDebtor({
    organizationId: alpha.id, portfolioId: alphaPortfolio.id, accountNumber: "ALPHA-1",
    fileNumber: "1001", firstName: "Alpha", lastName: "Debtor", originalBalance: 10000, currentBalance: 10000, status: "open",
  });
  await memory.createDebtorContact({
    organizationId: alpha.id, debtorId: alphaDebtor.id, type: "email", value: "alpha@example.test",
    label: "Primary", isPrimary: true, isValid: true,
  });
  await memory.createDebtor({
    organizationId: beta.id, portfolioId: betaPortfolio.id, accountNumber: "BETA-1",
    firstName: "Beta", lastName: "Debtor", originalBalance: 10000, currentBalance: 10000, status: "open",
  });

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const role = req.headers["x-role"];
    req.session = role ? { collector: role === "agent" ? agent : role === "manager" ? manager : admin } : {};
    next();
  });
  registerChainConnectionTestRoute(app);
  registerExternalApiRoutes(app);
  const server = await new Promise<any>((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const request = (path: string, options: RequestInit = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  const restore = async () => {
    await new Promise<void>((resolve) => server.close(resolve));
    for (const key of Reflect.ownKeys(storage)) Reflect.deleteProperty(storage, key);
    Object.defineProperties(storage, originalProperties);
    Object.setPrototypeOf(storage, originalPrototype);
  };
  return { memory, alpha, beta, empty, admin, agent, manager, alphaKey, betaKey, emptyKey, alphaPortfolio, betaPortfolio, alphaDebtor, request, restore };
}

test("Chain login and portfolio contract are tenant isolated and stable", async () => {
  const f = await fixture();
  try {
    const login = () => f.request("/api/v2/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alpha", password: "dmv2_alpha_test_key" }),
    });
    const first: any = await (await login()).json();
    const second: any = await (await login()).json();
    assert.equal(first.token, second.token);
    assert.equal((await f.memory.getApiTokensByOrg(f.alpha.id)).length, 1);

    const portfolios: any = await (await f.request("/api/v2/getportfoliolist", {
      headers: { Authorization: `Bearer ${first.token}` },
    })).json();
    assert.equal(portfolios.data.length, 1);
    assert.equal(portfolios.data[0].id, f.alphaPortfolio.id);
    assert.equal(portfolios.data[0].portfolioId, f.alphaPortfolio.id);

    const accountsByChainId = await f.request("/api/v2/get_accounts_in_portfolio", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${first.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: portfolios.data[0].id }),
    });
    const accountsByChainIdPayload: any = await accountsByChainId.json();
    assert.equal(accountsByChainId.status, 200);
    assert.equal(accountsByChainIdPayload.total, 1);
    assert.equal(accountsByChainIdPayload.data[0].accountNumber, "ALPHA-1");
    assert.equal(accountsByChainIdPayload.data[0].email, "alpha@example.test");
    assert.equal(accountsByChainIdPayload.data[0].emailAddress, "alpha@example.test");

    const updatedAccount = await f.request("/api/v2/updatedbase", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${first.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileNumber: f.alphaDebtor.fileNumber, emailAddress: "updated@example.test" }),
    });
    assert.equal(updatedAccount.status, 200);
    assert.equal((await updatedAccount.json()).data.email, "updated@example.test");

    const account: any = await (await f.request(`/api/v2/getaccount/${f.alphaDebtor.fileNumber}`, {
      headers: { Authorization: `Bearer ${first.token}` },
    })).json();
    assert.equal(account.data.email, "updated@example.test");
    assert.equal(account.data.emailAddress, "updated@example.test");

    const emails: any = await (await f.request(`/api/v2/getemails/${f.alphaDebtor.fileNumber}`, {
      headers: { Authorization: `Bearer ${first.token}` },
    })).json();
    assert.equal(emails.data[0].emailAddress, "updated@example.test");

    const foreignAccountsByChainId = await f.request("/api/v2/get_accounts_in_portfolio", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${first.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: f.betaPortfolio.id }),
    });
    const foreignAccountsPayload: any = await foreignAccountsByChainId.json();
    assert.equal(foreignAccountsByChainId.status, 200);
    assert.equal(foreignAccountsPayload.total, 0);
    assert.deepEqual(foreignAccountsPayload.data, []);

    const warningLines: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warningLines.push(args.map(String).join(" "));
    try {
      const wrongOrganization = await f.request("/api/v2/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "beta", password: "dmv2_alpha_test_key" }),
      });
      assert.equal(wrongOrganization.status, 401);
      assert.doesNotMatch(await wrongOrganization.text(), /dmv2_alpha_test_key/);

      // An unknown key for a valid company code must produce a useful
      // server-side reason without disclosing the submitted credential.
      const staleSavedKey = await f.request("/api/v2/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alpha", password: "dmv2_old_saved_key" }),
      });
      assert.equal(staleSavedKey.status, 401);
      assert.doesNotMatch(await staleSavedKey.text(), /dmv2_old_saved_key/);
    } finally {
      console.warn = originalWarn;
    }
    assert.match(warningLines.join("\n"), /TOKEN_ORGANIZATION_MISMATCH/);
    assert.match(warningLines.join("\n"), /TOKEN_NOT_FOUND/);
    assert.doesNotMatch(warningLines.join("\n"), /dmv2_(?:alpha_test_key|old_saved_key)/);
    assert.equal((await f.request("/api/v2/getportfoliolist", {
      headers: { Authorization: "Bearer invalid-key" },
    })).status, 401);

    f.alpha.isActive = false;
    assert.equal((await login()).status, 403);
    f.alpha.isActive = true;
    f.alpha.ipRestrictionEnabled = true;
    assert.equal((await login()).status, 403);
    f.alpha.ipRestrictionEnabled = false;
  } finally { await f.restore(); }
});

test("session Chain test uses token IDs, role and tenant checks without leaking credentials", async () => {
  const f = await fixture();
  try {
    const noSession = await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST" });
    assert.equal(noSession.status, 401);
    const denied = await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "agent" } });
    assert.equal(denied.status, 403);

    const ok = await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } });
    const payload: any = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(payload.code, "PORTFOLIOS_AVAILABLE");
    assert.equal(payload.portfolioCount, 1);
    assert.equal(payload.hasAuthenticatedExternally, false);
    assert.doesNotMatch(JSON.stringify(payload), /dmv2_alpha_test_key/);
    f.emptyKey.lastUsedDate = "2026-09-08T12:00:00.000Z";
    const noPortfolios: any = await (await f.request(`/api/settings/tokens/${f.emptyKey.id}/test-chain`, { method: "POST", headers: { "x-role": "manager" } })).json();
    assert.equal(noPortfolios.code, "NO_PORTFOLIOS");
    assert.equal(noPortfolios.portfolioCount, 0);
    assert.equal(noPortfolios.hasAuthenticatedExternally, true);
    assert.equal((await f.request(`/api/settings/tokens/${f.betaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).status, 404);

    const legacyKey = await f.memory.createApiToken({
      organizationId: f.alpha.id,
      name: "Legacy session",
      token: "legacy-session-key",
      isActive: true,
      createdDate: "2025-01-01",
    });
    const incompatible: any = await (await f.request(`/api/settings/tokens/${legacyKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(incompatible.code, "INVALID_CREDENTIALS");

    f.admin.role = "collector";
    assert.equal((await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).status, 403);
    f.admin.role = "admin";
    f.admin.status = "inactive";
    assert.equal((await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).status, 403);
    f.admin.status = "active";

    // MemStorage keeps the returned record as its backing value.
    f.alphaKey.isActive = false;
    const inactive: any = await (await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(inactive.code, "TOKEN_INACTIVE");

    f.alphaKey.isActive = true;
    f.alphaKey.expiresAt = "2000-01-01T00:00:00.000Z";
    const expired: any = await (await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(expired.code, "TOKEN_EXPIRED");

    f.alphaKey.expiresAt = "not-a-date";
    const malformedExpiry: any = await (await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(malformedExpiry.code, "TOKEN_EXPIRED");

    f.alphaKey.expiresAt = null;
    f.alpha.isActive = false;
    const organizationInactive: any = await (await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(organizationInactive.code, "ORGANIZATION_INACTIVE");

    f.alpha.isActive = true;
    f.alpha.ipRestrictionEnabled = true;
    const ipBlocked: any = await (await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(ipBlocked.code, "IP_NOT_ALLOWED");

    f.alpha.ipRestrictionEnabled = false;
    f.alphaPortfolio.id = "";
    const invalidPortfolio: any = await (await f.request(`/api/settings/tokens/${f.alphaKey.id}/test-chain`, { method: "POST", headers: { "x-role": "admin" } })).json();
    assert.equal(invalidPortfolio.code, "PORTFOLIO_CONTRACT_INVALID");
  } finally { await f.restore(); }
});
