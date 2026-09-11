import test from "node:test";
import assert from "node:assert/strict";
import { canRunPaymentsRecord, isActiveGlobalAdminSession } from "../server/access-control";

test("global-admin bypass requires the matching live active administrator", () => {
  assert.equal(isActiveGlobalAdminSession("admin-1", { id: "admin-1", isActive: true }), true);
  assert.equal(isActiveGlobalAdminSession("admin-1", { id: "admin-1", isActive: false }), false);
  assert.equal(isActiveGlobalAdminSession("admin-1", { id: "admin-2", isActive: true }), false);
  assert.equal(isActiveGlobalAdminSession("admin-1", undefined), false);
  assert.equal(isActiveGlobalAdminSession(undefined, { id: "admin-1", isActive: true }), false);
});

test("payment runner permission grants active collectors access without admin privileges", () => {
  const session = { id: "collector-1" };
  const collector = {
    id: "collector-1",
    organizationId: "org-1",
    status: "active",
    role: "collector",
    canViewPaymentRunner: true,
  };

  assert.equal(canRunPaymentsRecord(session, collector, "org-1"), true);
  assert.equal(canRunPaymentsRecord(session, { ...collector, canViewPaymentRunner: false }, "org-1"), false);
  assert.equal(canRunPaymentsRecord(session, { ...collector, status: "inactive" }, "org-1"), false);
  assert.equal(canRunPaymentsRecord(session, { ...collector, organizationId: "org-2" }, "org-1"), false);
  assert.equal(canRunPaymentsRecord({ id: "collector-2" }, collector, "org-1"), false);
});

test("active admins and managers retain payment runner access", () => {
  for (const role of ["admin", "manager"]) {
    assert.equal(canRunPaymentsRecord(
      { id: `${role}-1` },
      { id: `${role}-1`, organizationId: "org-1", status: "active", role, canViewPaymentRunner: false },
      "org-1",
    ), true);
  }
});
