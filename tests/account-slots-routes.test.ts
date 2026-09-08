import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer, type Server } from "node:http";
import { registerRoutes } from "../server/routes";
import { MemStorage, storage as routeStorage } from "../server/storage";

type JsonResponse = { response: Response; body: any };

async function fixture() {
  const memory = new MemStorage();
  const original = new Map<string, PropertyDescriptor | undefined>();
  for (const name of Object.getOwnPropertyNames(MemStorage.prototype)) {
    if (name === "constructor") continue;
    original.set(name, Object.getOwnPropertyDescriptor(routeStorage, name));
    Object.defineProperty(routeStorage, name, {
      configurable: true,
      writable: true,
      value: (memory as any)[name].bind(memory),
    });
  }

  const organization = await memory.createOrganization({
    name: "Route Test Organization", slug: `route-test-${Date.now()}`,
    isActive: true, createdDate: "2025-01-01", ipRestrictionEnabled: false,
  } as any);
  const otherOrganization = await memory.createOrganization({
    name: "Other Organization", slug: `other-test-${Date.now()}`,
    isActive: true, createdDate: "2025-01-01", ipRestrictionEnabled: false,
  } as any);
  const collector = await memory.createCollector({
    organizationId: organization.id, name: "Route Admin", email: "route@example.test",
    username: `route-admin-${Date.now()}`, password: "not-used", role: "admin", status: "active",
  } as any);
  const client = await memory.createClient({
    organizationId: organization.id, name: "Local Client", createdDate: "2025-01-01",
  } as any);
  const foreignClient = await memory.createClient({
    organizationId: otherOrganization.id, name: "Foreign Client", createdDate: "2025-01-01",
  } as any);
  const portfolio = await memory.createPortfolio({
    organizationId: organization.id, clientId: client.id, name: "Local Portfolio",
    purchaseDate: "2025-01-01", purchasePrice: 0, totalFaceValue: 0, totalAccounts: 0,
  } as any);
  const foreignPortfolio = await memory.createPortfolio({
    organizationId: otherOrganization.id, clientId: foreignClient.id, name: "Foreign Portfolio",
    purchaseDate: "2025-01-01", purchasePrice: 0, totalFaceValue: 0, totalAccounts: 0,
  } as any);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = {
      collector: {
        id: collector.id, organizationId: organization.id, role: "admin",
        name: collector.name, email: collector.email,
      },
    };
    next();
  });
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (method: string, path: string, body?: unknown): Promise<JsonResponse> => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { response, body: text ? JSON.parse(text) : null };
  };
  const close = async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(routeStorage, name, descriptor);
      else delete (routeStorage as any)[name];
    }
  };
  return {
    memory, organization, otherOrganization, collector, client, foreignClient,
    portfolio, foreignPortfolio, request, close,
  };
}

function debtorBody(portfolioId: string, accountNumber: string) {
  return {
    portfolioId, accountNumber, firstName: "Ada", lastName: "Lovelace",
    originalBalance: 12500, currentBalance: 12500, status: "newbiz",
  };
}

test("registered debtor route creates seven phone slots, three complete references, and ten custom values", async () => {
  const f = await fixture();
  try {
    const contacts = Array.from({ length: 7 }, (_, i) => ({
      type: "phone", value: `20255501${String(i + 1).padStart(2, "0")}`,
      label: `Slot ${i + 1}`, isPrimary: i === 0,
    }));
    const references = Array.from({ length: 3 }, (_, i) => ({
      name: `Relative ${i + 1}`, relationship: "friend",
      phone: `30155510${i}1`, phone2: `30155510${i}2`, phone3: `30155510${i}3`,
    }));
    const custom = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Heading ${i + 1}`, `Value ${i + 1}`]));
    const result = await f.request("POST", "/api/debtors", {
      ...debtorBody(f.portfolio.id, "NESTED-1"), clientId: f.client.id,
      customFields: JSON.stringify(custom), contacts, references,
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    const savedContacts = await f.memory.getDebtorContacts(result.body.id);
    const savedReferences = await f.memory.getDebtorReferences(result.body.id);
    assert.deepEqual(savedContacts.map(row => [row.value, row.label, row.isPrimary]),
      contacts.map(row => [row.value, row.label, row.isPrimary]));
    assert.equal(savedReferences.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(
        [savedReferences[i].phone, savedReferences[i].phone2, savedReferences[i].phone3],
        [references[i].phone, references[i].phone2, references[i].phone3],
      );
    }
    assert.deepEqual(JSON.parse(result.body.customFields), custom);
  } finally {
    await f.close();
  }
});

test("invalid nested bodies and unnamed relatives make no partial writes", async () => {
  const f = await fixture();
  try {
    const before = (await f.memory.getDebtors(f.portfolio.id)).length;
    for (const invalid of [
      { contacts: { type: "phone", value: "2025550100" } },
      { contacts: [{ type: "fax", value: "2025550100" }] },
      { contacts: [{ type: "phone", value: "1", isPrimary: true }, { type: "phone", value: "2", isPrimary: true }] },
      { references: [{ name: " ", phone: "2025550199" }] },
    ]) {
      const result = await f.request("POST", "/api/debtors", {
        ...debtorBody(f.portfolio.id, `INVALID-${Math.random()}`), ...invalid,
      });
      assert.equal(result.response.status, 400, JSON.stringify(result.body));
    }
    assert.equal((await f.memory.getDebtors(f.portfolio.id)).length, before);
  } finally {
    await f.close();
  }
});

test("account and child routes enforce portfolio, client, debtor, contact, and reference tenancy", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("POST", "/api/debtors", debtorBody(f.foreignPortfolio.id, "FOREIGN-P"))).response.status, 400);
    assert.equal((await f.request("POST", "/api/debtors", {
      ...debtorBody(f.portfolio.id, "FOREIGN-C"), clientId: f.foreignClient.id,
    })).response.status, 400);
    assert.equal((await f.request("POST", "/api/import/debtors", {
      portfolioId: f.foreignPortfolio.id, records: [], mappings: { Account: "accountNumber" },
    })).response.status, 403);
    assert.equal((await f.request("POST", "/api/import/debtors", {
      portfolioId: f.portfolio.id, clientId: f.foreignClient.id,
      records: [], mappings: { Account: "accountNumber" },
    })).response.status, 403);

    const foreignDebtor = await f.memory.createDebtor({
      organizationId: f.otherOrganization.id, ...debtorBody(f.foreignPortfolio.id, "FOREIGN-D"),
    } as any);
    const foreignContact = await f.memory.createDebtorContact({
      organizationId: f.otherOrganization.id, debtorId: foreignDebtor.id,
      type: "phone", value: "999", isPrimary: true, isValid: true,
    } as any);
    const foreignReference = await f.memory.createDebtorReference({
      organizationId: f.otherOrganization.id, debtorId: foreignDebtor.id,
      name: "Foreign Relative", addedDate: "2025-01-01",
    } as any);
    assert.equal((await f.request("GET", `/api/debtors/${foreignDebtor.id}`)).response.status, 403);
    assert.equal((await f.request("GET", `/api/debtors/${foreignDebtor.id}/contacts`)).response.status, 404);
    assert.equal((await f.request("POST", `/api/debtors/${foreignDebtor.id}/contacts`, { type: "phone", value: "1" })).response.status, 404);
    assert.equal((await f.request("GET", `/api/debtors/${foreignDebtor.id}/references`)).response.status, 404);
    assert.equal((await f.request("POST", `/api/debtors/${foreignDebtor.id}/references`, { name: "X" })).response.status, 404);
    assert.equal((await f.request("PATCH", `/api/contacts/${foreignContact.id}`, { label: "stolen" })).response.status, 403);
    assert.equal((await f.request("PATCH", `/api/references/${foreignReference.id}`, { notes: "stolen" })).response.status, 403);
  } finally {
    await f.close();
  }
});

test("debtor import supports expanded and legacy mappings plus arbitrary custom source labels", async () => {
  const f = await fixture();
  try {
    const mappings: Record<string, string> = {
      Account: "accountNumber", First: "firstName", Last: "lastName",
      LegacyPhone: "phone", LegacyLabel: "phoneLabel",
      Phone7: "phone7", Phone7Label: "phone7Label",
      Relative: "ref1Name", RefPhone1: "ref1Phone", RefPhone2: "ref1Phone2", RefPhone3: "ref1Phone3",
      LegacyRelative: "ref2Name", LegacyRefPhone: "ref2Phone1",
      phone7: "custom1", status: "custom2",
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`Odd heading ${i + 3}`, `custom${i + 3}`])),
    };
    const record: Record<string, string> = {
      Account: "IMPORT-EXPANDED", First: "Grace", Last: "Hopper",
      LegacyPhone: "2025551001", LegacyLabel: "Home",
      Phone7: "2025551007", Phone7Label: "Seventh",
      Relative: "One", RefPhone1: "3011", RefPhone2: "3012", RefPhone3: "3013",
      LegacyRelative: "Two", LegacyRefPhone: "3021",
      phone7: "custom-looking-phone7", status: "custom-looking-status",
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`Odd heading ${i + 3}`, `custom-${i + 3}`])),
    };
    const result = await f.request("POST", "/api/import/debtors", {
      portfolioId: f.portfolio.id, records: [record], mappings,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.results.created, 1);
    const imported = (await f.memory.getDebtors(f.portfolio.id)).find(row => row.accountNumber === "IMPORT-EXPANDED");
    assert.ok(imported);
    assert.equal(imported.status, "newbiz");
    assert.deepEqual(JSON.parse(imported.customFields!), Object.fromEntries([
      ["phone7", "custom-looking-phone7"], ["status", "custom-looking-status"],
      ...Array.from({ length: 8 }, (_, i) => [`Odd heading ${i + 3}`, `custom-${i + 3}`]),
    ]));
    assert.deepEqual((await f.memory.getDebtorContacts(imported.id)).map(row => [row.value, row.label]),
      [["2025551001", "Home"], ["2025551007", "Seventh"]]);
    const refs = await f.memory.getDebtorReferences(imported.id);
    assert.deepEqual(refs.map(row => [row.name, row.phone, row.phone2, row.phone3]),
      [["One", "3011", "3012", "3013"], ["Two", "3021", null, null]]);
  } finally {
    await f.close();
  }
});

test("debtor reimport is duplicate-safe, non-destructive for blanks, and updates only supplied reference details", async () => {
  const f = await fixture();
  try {
    const mappings = {
      Account: "accountNumber", First: "firstName", Phone: "phone1", Label: "phone1Label",
      Relative: "ref1Name", RefPhone: "ref1Phone", RefNotes: "ref1Notes", Extra: "custom1",
    };
    const first = {
      Account: "REIMPORT-1", First: "Existing", Phone: "2025551212", Label: "Mobile",
      Relative: "Aunt May", RefPhone: "3015551212", RefNotes: "keep me", Extra: "original",
    };
    assert.equal((await f.request("POST", "/api/import/debtors", {
      portfolioId: f.portfolio.id, records: [first], mappings,
    })).body.results.created, 1);
    const second = {
      Account: "REIMPORT-1", First: "", Phone: "2025551212", Label: "",
      Relative: "aunt may", RefPhone: "", RefNotes: "new note", Extra: "",
    };
    const result = await f.request("POST", "/api/import/debtors", {
      portfolioId: f.portfolio.id, records: [second], mappings,
    });
    assert.equal(result.body.results.updated, 1);
    const debtor = (await f.memory.getDebtors(f.portfolio.id)).find(row => row.accountNumber === "REIMPORT-1")!;
    assert.equal(debtor.firstName, "Existing");
    assert.deepEqual(JSON.parse(debtor.customFields!), { Extra: "original" });
    assert.equal((await f.memory.getDebtorContacts(debtor.id)).length, 1);
    const refs = await f.memory.getDebtorReferences(debtor.id);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].phone, "3015551212");
    assert.equal(refs[0].notes, "new note");
  } finally {
    await f.close();
  }
});

test("contact reimport is duplicate-safe, preserves blank fields, ignores unnamed relatives, and keeps custom labels", async () => {
  const f = await fixture();
  try {
    const debtor = await f.memory.createDebtor({
      organizationId: f.organization.id, ...debtorBody(f.portfolio.id, "CONTACT-1"),
      customFields: JSON.stringify({ Existing: "keep" }),
    } as any);
    await f.memory.createDebtorContact({
      organizationId: f.organization.id, debtorId: debtor.id, type: "phone",
      value: "2025551313", label: "Original", isPrimary: true, isValid: true,
    } as any);
    await f.memory.createDebtorReference({
      organizationId: f.organization.id, debtorId: debtor.id, name: "Uncle Bob",
      phone: "3015551313", notes: "old", addedDate: "2025-01-01",
    } as any);
    const mappings = {
      Account: "accountNumber", Phone: "phone", Label: "phoneLabel",
      RefName: "ref1Name", RefPhone: "ref1Phone", RefNotes: "ref1Notes",
      NamelessPhone: "ref2Phone", phone7: "custom1", status: "custom2",
    };
    const records = [{
      Account: "CONTACT-1", Phone: "2025551313", Label: "",
      RefName: "uncle bob", RefPhone: "", RefNotes: "updated",
      NamelessPhone: "should-not-create", phone7: "custom seven", status: "custom status",
    }];
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await f.request("POST", "/api/import/contacts", {
        portfolioId: f.portfolio.id, records, mappings,
      });
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.results.added, 0);
    }
    const contacts = await f.memory.getDebtorContacts(debtor.id);
    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].label, "Original");
    const refs = await f.memory.getDebtorReferences(debtor.id);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].phone, "3015551313");
    assert.equal(refs[0].notes, "updated");
    const updated = await f.memory.getDebtor(debtor.id);
    assert.deepEqual(JSON.parse(updated!.customFields!), {
      Existing: "keep", phone7: "custom seven", status: "custom status",
    });
  } finally {
    await f.close();
  }
});

test("explicit null clears work while omitted account and nested fields are preserved", async () => {
  const f = await fixture();
  try {
    const created = await f.request("POST", "/api/debtors", {
      ...debtorBody(f.portfolio.id, "CLEAR-1"), address: "Old address", city: "Austin",
      contacts: [{ type: "phone", value: "2025551414", label: "Old label", isPrimary: true }],
      references: [{ name: "Relative", phone: "3015551414", notes: "Old note" }],
    });
    assert.equal(created.response.status, 201);
    const contact = (await f.memory.getDebtorContacts(created.body.id))[0];
    const reference = (await f.memory.getDebtorReferences(created.body.id))[0];
    assert.equal((await f.request("PATCH", `/api/debtors/${created.body.id}`, { address: null })).response.status, 200);
    assert.equal((await f.request("PATCH", `/api/contacts/${contact.id}`, { label: null })).response.status, 200);
    assert.equal((await f.request("PATCH", `/api/references/${reference.id}`, { notes: null })).response.status, 200);
    const debtor = await f.memory.getDebtor(created.body.id);
    assert.equal(debtor!.address, null);
    assert.equal(debtor!.city, "Austin");
    assert.equal((await f.memory.getDebtorContacts(created.body.id))[0].label, null);
    const savedReference = (await f.memory.getDebtorReferences(created.body.id))[0];
    assert.equal(savedReference.notes, null);
    assert.equal(savedReference.phone, "3015551414");
  } finally {
    await f.close();
  }
});