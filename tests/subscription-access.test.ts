import test from "node:test";
import assert from "node:assert/strict";
import { computeSubscriptionAccess } from "../server/subscription-access";

// This is the gate every login path and the global "/api" middleware run
// on every request. The global admin's organization on/off toggle
// (PATCH /api/super-admin/organizations/:id/toggle) only ever writes
// `isActive`, so these cases confirm that flag is authoritative over
// every other subscription state - i.e. a global admin can always cut an
// organization's access on or off, regardless of billing status.

test("an inactive organization is blocked even with a paid, active subscription", () => {
  const result = computeSubscriptionAccess({
    isActive: false,
    subscriptionStatus: "active",
  });
  assert.equal(result.active, false);
  assert.equal(result.reason, "Organization is inactive");
});

test("an inactive organization is blocked even mid-trial", () => {
  const result = computeSubscriptionAccess({
    isActive: false,
    subscriptionStatus: "trial",
    trialEndDate: "2999-01-01",
  });
  assert.equal(result.active, false);
  assert.equal(result.reason, "Organization is inactive");
});

test("re-activating a toggled-off organization restores access", () => {
  const result = computeSubscriptionAccess({
    isActive: true,
    subscriptionStatus: "active",
  });
  assert.equal(result.active, true);
});

test("an active organization mid-trial is allowed", () => {
  const result = computeSubscriptionAccess({
    isActive: true,
    subscriptionStatus: "trial",
    trialEndDate: "2999-01-01",
  });
  assert.equal(result.active, true);
});

test("an active organization with an expired trial and no paid subscription is blocked", () => {
  const result = computeSubscriptionAccess({
    isActive: true,
    subscriptionStatus: "trial",
    trialEndDate: "2000-01-01",
  });
  assert.equal(result.active, false);
  assert.equal(result.reason, "Trial has expired. Please subscribe to continue.");
});

test("a free-month grant extends trial access to the later of trial end or billing start", () => {
  const result = computeSubscriptionAccess({
    isActive: true,
    subscriptionStatus: "trial",
    trialEndDate: "2000-01-01",
    billingStartDate: "2999-01-01",
  });
  assert.equal(result.active, true);
});

test("legacy organizations without a subscription status default to allowed", () => {
  const result = computeSubscriptionAccess({ isActive: true, subscriptionStatus: null });
  assert.equal(result.active, true);
});
