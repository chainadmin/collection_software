import test from "node:test";
import assert from "node:assert/strict";
import { isActiveGlobalAdminSession } from "../server/access-control";

test("global-admin bypass requires the matching live active administrator", () => {
  assert.equal(isActiveGlobalAdminSession("admin-1", { id: "admin-1", isActive: true }), true);
  assert.equal(isActiveGlobalAdminSession("admin-1", { id: "admin-1", isActive: false }), false);
  assert.equal(isActiveGlobalAdminSession("admin-1", { id: "admin-2", isActive: true }), false);
  assert.equal(isActiveGlobalAdminSession("admin-1", undefined), false);
  assert.equal(isActiveGlobalAdminSession(undefined, { id: "admin-1", isActive: true }), false);
});