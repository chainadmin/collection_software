import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("getCollectorByEmail matches regardless of case or surrounding whitespace", {
  skip: !process.env.DATABASE_URL && "DATABASE_URL is not configured",
}, async () => {
  const [{ DatabaseStorage }] = await Promise.all([
    import("../server/database-storage"),
  ]);
  const storage = new DatabaseStorage();
  const email = `Login.Test.${randomUUID()}@Example.com`;

  const organization = await storage.createOrganization({
    name: "Login Test Org",
    slug: `login-test-org-${randomUUID()}`,
    createdDate: "2030-01-01",
  } as any);

  const collector = await storage.createCollector({
    organizationId: organization.id,
    name: "Login Test Collector",
    email,
    username: `login-test-${randomUUID()}`,
    password: "irrelevant-hash",
  } as any);

  try {
    const found = await storage.getCollectorByEmail(email.toLowerCase());
    assert.ok(found);
    assert.equal(found?.id, collector.id);

    const foundWithWhitespace = await storage.getCollectorByEmail(`  ${email.toUpperCase()}  `);
    assert.ok(foundWithWhitespace);
    assert.equal(foundWithWhitespace?.id, collector.id);
  } finally {
    await storage.deleteCollector(collector.id);
    await storage.deleteOrganization(organization.id);
  }
});
