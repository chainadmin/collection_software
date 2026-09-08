import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../server/db";
import {
  claimPaymentForProcessing,
  markPaymentNeedsReviewIfProcessing,
  markStaleProcessingPaymentsNeedsReview,
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
    await markPaymentNeedsReviewIfProcessing("payment-1", "org-1");
    const staleCount = await markStaleProcessingPaymentsNeedsReview("org-1", 45);

    assert.equal(staleCount, 2);
    assert.match(calls[0].sql, /organization_id = \$2/);
    assert.match(calls[0].sql, /status = 'pending'/);
    assert.match(calls[0].sql, /payment_date <= \$3/);
    assert.deepEqual(calls[0].params, ["payment-1", "org-1", "2026-09-08"]);

    assert.match(calls[1].sql, /status = 'processing'/);
    assert.match(calls[1].sql, /organization_id = \$2/);
    assert.deepEqual(calls[1].params.slice(0, 2), ["payment-1", "org-1"]);

    assert.match(calls[2].sql, /processing_started_at < NOW\(\) - make_interval/);
    assert.match(calls[2].sql, /\(\$2::text IS NULL OR organization_id = \$2\)/);
    assert.deepEqual(calls[2].params.slice(0, 2), [45, "org-1"]);
  } finally {
    (pool as any).query = originalQuery;
  }
});