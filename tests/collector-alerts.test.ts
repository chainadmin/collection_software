import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "../server/storage";

test("a reminder with no remindAt delivers immediately and only once", async () => {
  const storage = new MemStorage();
  const org = "alerts-org";
  await storage.createCollectorAlert({
    organizationId: org, fromCollectorId: "sender-1", toCollectorId: "recipient-1",
    message: "Call back at 3:00", remindAt: null,
  });

  const first = await storage.claimDueCollectorAlerts("recipient-1", org);
  assert.equal(first.length, 1);
  assert.equal(first[0].message, "Call back at 3:00");
  assert.ok(first[0].deliveredAt);

  const second = await storage.claimDueCollectorAlerts("recipient-1", org);
  assert.equal(second.length, 0);
});

test("a future remindAt does not deliver until it arrives", async () => {
  const storage = new MemStorage();
  const org = "alerts-org";
  const future = new Date(Date.now() + 60_000);
  await storage.createCollectorAlert({
    organizationId: org, fromCollectorId: "sender-1", toCollectorId: "recipient-1",
    message: "Follow up tomorrow", remindAt: future,
  });

  assert.equal((await storage.claimDueCollectorAlerts("recipient-1", org)).length, 0);

  // Directly create one already in the past to prove it delivers once due.
  const past = new Date(Date.now() - 1000);
  await storage.createCollectorAlert({
    organizationId: org, fromCollectorId: "sender-1", toCollectorId: "recipient-1",
    message: "Overdue reminder", remindAt: past,
  });
  const due = await storage.claimDueCollectorAlerts("recipient-1", org);
  assert.deepEqual(due.map((a) => a.message), ["Overdue reminder"]);
});

test("alerts are isolated by recipient and organization", async () => {
  const storage = new MemStorage();
  await storage.createCollectorAlert({
    organizationId: "org-a", fromCollectorId: "sender-1", toCollectorId: "recipient-1",
    message: "For recipient-1 in org-a", remindAt: null,
  });
  await storage.createCollectorAlert({
    organizationId: "org-a", fromCollectorId: "sender-1", toCollectorId: "recipient-2",
    message: "For recipient-2 in org-a", remindAt: null,
  });

  const forWrongRecipient = await storage.claimDueCollectorAlerts("recipient-2", "org-a");
  assert.deepEqual(forWrongRecipient.map((a) => a.message), ["For recipient-2 in org-a"]);

  const forWrongOrg = await storage.claimDueCollectorAlerts("recipient-1", "org-b");
  assert.equal(forWrongOrg.length, 0);

  const forRightOrg = await storage.claimDueCollectorAlerts("recipient-1", "org-a");
  assert.deepEqual(forRightOrg.map((a) => a.message), ["For recipient-1 in org-a"]);
});
