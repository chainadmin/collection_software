import test from "node:test";
import assert from "node:assert/strict";
import { recordAccountChange } from "../client/src/lib/account-history";

test("account history retains the previously worked account", () => {
  const first = recordAccountChange({ currentAccountId: null, previousAccountId: null }, "account-a");
  assert.deepEqual(first, { currentAccountId: "account-a", previousAccountId: null });

  const second = recordAccountChange(first, "account-b");
  assert.deepEqual(second, { currentAccountId: "account-b", previousAccountId: "account-a" });

  const returned = recordAccountChange(second, "account-a");
  assert.deepEqual(returned, { currentAccountId: "account-a", previousAccountId: "account-b" });
});

test("reselecting the active account does not overwrite account history", () => {
  const history = { currentAccountId: "account-b", previousAccountId: "account-a" };
  assert.equal(recordAccountChange(history, "account-b"), history);
});
