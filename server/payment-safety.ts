import { pool } from "./db";

/** Atomically post a processed payment while locking both payment and debtor. */
export async function postPaymentAtomically(paymentId: string, organizationId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [paymentId, organizationId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
    if (payment.status === "posted") {
      await client.query("COMMIT");
      return { payment, alreadyPosted: true };
    }
    if (payment.status !== "processed") {
      throw Object.assign(new Error("Only processed payments can be posted"), { statusCode: 400 });
    }
    const debtorResult = await client.query(
      `SELECT * FROM debtors WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [payment.debtor_id, organizationId],
    );
    const debtor = debtorResult.rows[0];
    if (!debtor) throw Object.assign(new Error("Account not found"), { statusCode: 404 });
    const newBalance = Math.max(0, debtor.current_balance - payment.amount);
    await client.query(
      `UPDATE debtors SET current_balance = $1, status = $2 WHERE id = $3`,
      [newBalance, newBalance === 0 ? "paid" : "in_payment", debtor.id],
    );
    const posted = await client.query(
      `UPDATE payments SET status = 'posted', completed_at = COALESCE(completed_at, NOW()) WHERE id = $1 RETURNING *`,
      [paymentId],
    );
    await client.query(
      `INSERT INTO notes (id, debtor_id, collector_id, content, note_type, created_date, organization_id)
       VALUES (gen_random_uuid(), $1, $2, $3, 'payment', CURRENT_DATE::text, $4)`,
      [payment.debtor_id, payment.processed_by || "system", `Payment of $${(payment.amount / 100).toFixed(2)} POSTED successfully.`, organizationId],
    );
    await client.query("COMMIT");
    return { payment: posted.rows[0], alreadyPosted: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Claims a payment before the provider call; only one worker can win. */
export async function claimPaymentForProcessing(paymentId: string, organizationId: string) {
  const result = await pool.query(
    `UPDATE payments SET status = 'processing', processing_started_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'declined', 'failed')
     RETURNING *`,
    [paymentId, organizationId],
  );
  return result.rows[0];
}
