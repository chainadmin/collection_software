import test from "node:test";
import assert from "node:assert/strict";
import { canRunPaymentsRecord, canEditPaymentsRecord, canViewFinancialsRecord, isActiveGlobalAdminSession } from "../server/access-control";

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

test("edit-payments permission is its own dedicated grant, separate from Payment Runner access", () => {
  const session = { id: "collector-1" };
  const collector = {
    id: "collector-1",
    organizationId: "org-1",
    status: "active",
    role: "collector",
    canEditPayments: true,
  };

  assert.equal(canEditPaymentsRecord(session, collector, "org-1"), true);
  assert.equal(canEditPaymentsRecord(session, { ...collector, canEditPayments: false }, "org-1"), false);
  assert.equal(canEditPaymentsRecord(session, { ...collector, status: "inactive" }, "org-1"), false);
  assert.equal(canEditPaymentsRecord(session, { ...collector, organizationId: "org-2" }, "org-1"), false);
  assert.equal(canEditPaymentsRecord({ id: "collector-2" }, collector, "org-1"), false);

  // Payment Runner access alone does not imply payment-editing rights, and
  // vice versa - the two are deliberately independent toggles.
  assert.equal(
    canEditPaymentsRecord(session, { ...collector, canEditPayments: false, canViewPaymentRunner: true }, "org-1"),
    false,
  );
});

test("active admins and managers retain edit-payments access regardless of the toggle", () => {
  for (const role of ["admin", "manager"]) {
    assert.equal(canEditPaymentsRecord(
      { id: `${role}-1` },
      { id: `${role}-1`, organizationId: "org-1", status: "active", role, canEditPayments: false },
      "org-1",
    ), true);
  }
});

test("viewing company financials requires the explicit grant - admin/manager role never implies it", () => {
  const session = { id: "collector-1" };
  const collector = {
    id: "collector-1",
    organizationId: "org-1",
    status: "active",
    canViewFinancials: true,
  };

  assert.equal(canViewFinancialsRecord(session, collector, "org-1"), true);
  assert.equal(canViewFinancialsRecord(session, { ...collector, canViewFinancials: false }, "org-1"), false);
  assert.equal(canViewFinancialsRecord(session, { ...collector, status: "inactive" }, "org-1"), false);
  assert.equal(canViewFinancialsRecord(session, { ...collector, organizationId: "org-2" }, "org-1"), false);
  assert.equal(canViewFinancialsRecord({ id: "collector-2" }, collector, "org-1"), false);

  // Unlike every other permission, role=admin/manager alone must NOT grant
  // this - a collector promoted to admin to run operations should not
  // automatically see pay and profitability data unless separately granted.
  for (const role of ["admin", "manager"]) {
    assert.equal(
      canViewFinancialsRecord(
        { id: "collector-1" },
        { ...collector, role, canViewFinancials: false },
        "org-1",
      ),
      false,
    );
  }
});
