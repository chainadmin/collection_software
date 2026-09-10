import test from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "../server/storage";

const debtor = {
  organizationId: "org-a", portfolioId: "portfolio-a", accountNumber: "A-1",
  firstName: "Ada", lastName: "Lovelace", originalBalance: 100, currentBalance: 100,
};

test("nested debtor storage retains seven phones and three reference phone slots", async () => {
  const storage = new MemStorage();
  const created = await storage.createDebtorWithNested(
    debtor,
    Array.from({ length: 7 }, (_, i) => ({ type: "phone", value: `555000000${i}`, label: `Phone ${i + 1}`, isPrimary: i === 0, isValid: true })),
    Array.from({ length: 3 }, (_, i) => ({ name: `Reference ${i}`, phone: `111${i}`, phone2: `222${i}`, phone3: `333${i}`, addedDate: "2025-01-01" })),
  );
  assert.equal((await storage.getDebtorContacts(created.id)).length, 7);
  const references = await storage.getDebtorReferences(created.id);
  assert.equal(references.length, 3);
  assert.deepEqual(references.map((reference) => [reference.phone, reference.phone2, reference.phone3]), [
    ["1110", "2220", "3330"], ["1111", "2221", "3331"], ["1112", "2222", "3332"],
  ]);
});

test("nested storage rolls back debtor and companions when a nested write fails", async () => {
  const storage = new MemStorage();
  const before = (await storage.getDebtors()).length;
  const original = storage.createDebtorContact.bind(storage);
  let calls = 0;
  storage.createDebtorContact = async (input: any) => {
    calls++;
    if (calls === 2) throw new Error("simulated nested failure");
    return original(input);
  };
  await assert.rejects(() => storage.createDebtorWithNested(debtor, [
    { type: "phone", value: "5550000000", isPrimary: true, isValid: true },
    { type: "phone", value: "5550000001", isPrimary: false, isValid: true },
  ], []), /simulated nested failure/);
  assert.equal((await storage.getDebtors()).length, before);
});

test("account search finds formatted phone numbers in contacts and every reference slot", async () => {
  const storage = new MemStorage();
  const created = await storage.createDebtorWithNested(
    debtor,
    [{ type: "phone", value: "(555) 867-5309", label: "Mobile", isPrimary: true, isValid: true }],
    [{ name: "Grace Hopper", phone: "111-111-1111", phone2: "222-222-2222", phone3: "333-333-3333", addedDate: "2025-01-01" }],
  );

  assert.deepEqual((await storage.searchDebtors("5558675309", "org-a")).map(({ id }) => id), [created.id]);
  assert.deepEqual((await storage.searchDebtors("2222222", "org-a")).map(({ id }) => id), [created.id]);
  assert.deepEqual((await storage.searchDebtors("333-333-3333", "org-a")).map(({ id }) => id), [created.id]);
  assert.deepEqual(await storage.searchDebtors("5558675309", "org-b"), []);
});
