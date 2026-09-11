import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../server/db";
import {
  claimDeclinedPaymentForRerun,
  claimPaymentForProcessing,
  markPaymentNeedsReviewIfProcessing,
  markStaleProcessingPaymentsNeedsReview,
  postPaymentAtomically,
} from "../server/payment-safety";

test("payment claims and recovery updates retain tenant and status guards", async () => {
  const originalQuery = pool.query.bind(pool);
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  (pool as any).query = async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (/RETURNING id/.test(sql)) return { rowCount: 2, rows: [{ id: "one" }, { id: "two" }] };
    return { rowCount: 1, rows: [{ id: "payment-1" }] };
  };

  try {
    await claimPaymentForProcessing("payment-1", "org-1", "2026-09-08");
    await claimDeclinedPaymentForRerun("payment-2", "org-1");
    await markPaymentNeedsReviewIfProcessing("payment-1", "org-1");
    const staleCount = await markStaleProcessingPaymentsNeedsReview("org-1", 45);

    assert.equal(staleCount, 2);
    assert.match(calls[0].sql, /organization_id = \$2/);
    assert.match(calls[0].sql, /status = 'pending'/);
    assert.match(calls[0].sql, /payment_date <= \$3/);
    assert.deepEqual(calls[0].params, ["payment-1", "org-1", "2026-09-08"]);

    assert.match(calls[1].sql, /status = 'pending'/);
    assert.match(calls[1].sql, /completed_at IS NOT NULL/);
    assert.match(calls[1].sql, /notes LIKE 'DECLINED:%'/);
    assert.deepEqual(calls[1].params, ["payment-2", "org-1"]);

    assert.match(calls[2].sql, /status = 'processing'/);
    assert.match(calls[2].sql, /organization_id = \$2/);
    assert.deepEqual(calls[2].params.slice(0, 2), ["payment-1", "org-1"]);

    assert.match(calls[3].sql, /processing_started_at < NOW\(\) - make_interval/);
    assert.match(calls[3].sql, /\(\$2::text IS NULL OR organization_id = \$2\)/);
    assert.deepEqual(calls[3].params.slice(0, 2), [45, "org-1"]);
  } finally {
    (pool as any).query = originalQuery;
  }
});

test("manual posting permits a pending payment and records the gateway bypass", async () => {
  const originalConnect = pool.connect.bind(pool);
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM payments/.test(sql)) {
        return { rows: [{ id: "payment-1", debtor_id: "debtor-1", amount: 2500, status: "pending", processed_by: "collector-1" }] };
      }
      if (/SELECT \* FROM debtors/.test(sql)) {
        return { rows: [{ id: "debtor-1", current_balance: 10000 }] };
      }
      if (/UPDATE payments SET status = 'posted'/.test(sql)) {
        return { rows: [{ id: "payment-1", status: "posted" }] };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  (pool as any).connect = async () => client;

  try {
    const result = await postPaymentAtomically("payment-1", "org-1", { allowPending: true });

    assert.equal(result.alreadyPosted, false);
    assert.ok(calls.some(({ sql, params }) =>
      /INSERT INTO notes/.test(sql) && String(params?.[2]).includes("manually, without gateway processing")
    ));
    assert.ok(calls.some(({ sql, params }) =>
      /UPDATE debtors/.test(sql) && params?.[0] === 7500
    ));
  } finally {
    (pool as any).connect = originalConnect;
  }
});
