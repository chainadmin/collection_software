import type { Express } from "express";
import type { IStorage } from "./storage";
import { rejectRawCardData } from "./payment-input";
import { redactPayments } from "./payment-presenter";
import { getPaymentBusinessDate } from "./payment-date";

export const MAX_ARRANGEMENT_ROWS = 60;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function rejectArrangementRawCardData(body: unknown): void {
  if (!body || typeof body !== "object") return rejectRawCardData(body);
  const { cardId: _cardId, arrangementId: _arrangementId, mutationId: _mutationId, rows, ...rest } =
    body as Record<string, unknown>;
  rejectRawCardData(rest);
  if (Array.isArray(rows)) {
    rejectRawCardData(rows.map(row => {
      if (!row || typeof row !== "object") return row;
      const { id: _id, ...safeRow } = row as Record<string, unknown>;
      return safeRow;
    }));
  } else {
    rejectRawCardData(rows);
  }
}

export function registerPaymentArrangementRoutes(app: Express, storage: IStorage): void {
  app.get("/api/debtors/:id/payment-arrangements", async (req: any, res) => {
    const organizationId = req.session?.collector?.organizationId;
    if (!organizationId) return res.status(401).json({ error: "Authentication required" });
    const debtor = await storage.getDebtor(req.params.id);
    if (!debtor) return res.status(404).json({ error: "Debtor not found" });
    if (debtor.organizationId !== organizationId) return res.status(403).json({ error: "Access denied" });
    const payments = await storage.getPaymentsForDebtor(debtor.id);
    const groups = new Map<string, typeof payments>();
    payments.filter(payment => payment.arrangementId).forEach(payment => {
      const group = groups.get(payment.arrangementId!) ?? [];
      group.push(payment);
      groups.set(payment.arrangementId!, group);
    });
    return res.json(Array.from(groups.entries()).map(([arrangementId, rows]) => ({
      arrangementId,
      rows: redactPayments(rows.sort((a, b) => (a.arrangementIndex ?? 0) - (b.arrangementIndex ?? 0))),
    })));
  });

  app.post("/api/debtors/:id/payment-arrangements", async (req: any, res) => {
    try {
      try {
        rejectArrangementRawCardData(req.body);
      } catch {
        return res.status(400).json({ error: "Raw card data is not accepted by this endpoint" });
      }

      const organizationId = req.session?.collector?.organizationId;
      if (!organizationId) return res.status(401).json({ error: "Authentication required" });
      if (req.body.processNow !== undefined) {
        return res.status(400).json({ error: "Multiple payments can only be scheduled, not processed now" });
      }
      const arrangementId = String(req.get("Idempotency-Key") || req.body.arrangementId || "");
      if (!/^[A-Za-z0-9._:-]{8,180}$/.test(arrangementId)) {
        return res.status(400).json({ error: "A valid arrangement idempotency key is required" });
      }
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (debtor.organizationId !== organizationId) return res.status(403).json({ error: "Access denied" });
      const rows = req.body.rows;
      if (!Array.isArray(rows) || rows.length < 2 || rows.length > MAX_ARRANGEMENT_ROWS) {
        return res.status(400).json({ error: `An arrangement requires 2 to ${MAX_ARRANGEMENT_ROWS} payments` });
      }
      const today = getPaymentBusinessDate();
      for (const row of rows) {
        if (!row || !Number.isSafeInteger(row.amount) || row.amount <= 0) {
          return res.status(400).json({ error: "Every payment amount must be a positive whole number of cents" });
        }
        if (typeof row.paymentDate !== "string" || !isCalendarDate(row.paymentDate) || row.paymentDate < today) {
          return res.status(400).json({ error: "Every payment date must be a valid Eastern business date on or after today" });
        }
      }
      const total = rows.reduce((sum: number, row: any) => sum + row.amount, 0);
      if (!Number.isSafeInteger(total)) return res.status(400).json({ error: "Payment total is too large" });

      if (total > debtor.currentBalance) {
        return res.status(400).json({ error: "Payment total cannot exceed the current balance" });
      }

      const paymentMethod = String(req.body.paymentMethod || "");
      if (!["ach", "card", "check", "cash"].includes(paymentMethod)) {
        return res.status(400).json({ error: "Invalid payment method" });
      }
      let cardId: string | null = null;
      if (paymentMethod === "card") {
        cardId = typeof req.body.cardId === "string" ? req.body.cardId : null;
        if (!cardId) return res.status(400).json({ error: "A saved vaulted card is required" });
        const card = await storage.getPaymentCard(cardId);
        if (!card || card.organizationId !== organizationId || card.debtorId !== debtor.id) {
          return res.status(400).json({ error: "Payment card does not belong to this debtor" });
        }
        if (card.vaultStatus !== "vaulted" || !card.processorType || !card.processorToken) {
          return res.status(409).json({ error: "Payment card is not vaulted and cannot be scheduled" });
        }
        const activeMerchant = (await storage.getMerchants(organizationId))
          .find(merchant => merchant.isActive && merchant.id === card.merchantId);
        if (!activeMerchant || activeMerchant.processorType !== card.processorType) {
          return res.status(409).json({ error: "Payment card is not vaulted with its active merchant" });
        }
      } else if (req.body.cardId != null) {
        return res.status(400).json({ error: "A card may only be used with card payments" });
      }

      // This lookup is deliberately after all immutable request validation;
      // storage repeats the comparison under the debtor lock to close races.
      const replay = await storage.getPaymentArrangement(organizationId, debtor.id, arrangementId);
      const payments = await storage.createPaymentArrangement({
        organizationId,
        debtorId: debtor.id,
        arrangementId,
        paymentMethod,
        cardId,
        processedBy: req.session.collector.id,
        rows: rows.map((row: any) => ({ amount: row.amount, paymentDate: row.paymentDate })),
      });
      return res.status(replay.length ? 200 : 201).json(redactPayments(payments));
    } catch (error: any) {
      if (typeof error?.status === "number") return res.status(error.status).json({ error: error.message });
      return res.status(500).json({ error: "Failed to schedule payment arrangement" });
    }
  });

  app.patch("/api/debtors/:id/payment-arrangements/:arrangementId", async (req: any, res) => {
    try {
      try { rejectArrangementRawCardData(req.body); } catch {
        return res.status(400).json({ error: "Raw card data is not accepted by this endpoint" });
      }
      const organizationId = req.session?.collector?.organizationId;
      if (!organizationId) return res.status(401).json({ error: "Authentication required" });
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) return res.status(404).json({ error: "Debtor not found" });
      if (debtor.organizationId !== organizationId) return res.status(403).json({ error: "Access denied" });
      const mutationId = String(req.get("Idempotency-Key") || req.body.mutationId || "");
      if (!/^[A-Za-z0-9._:-]{8,180}$/.test(mutationId)) {
        return res.status(400).json({ error: "A valid mutation idempotency key is required" });
      }
      const action = req.body.action;
      if (action !== "update" && action !== "cancel") return res.status(400).json({ error: "Action must be update or cancel" });
      let rows: Array<{ id: string; amount: number; paymentDate: string }> | undefined;
      let cardId: string | null | undefined;
      if (action === "update") {
        if (!Array.isArray(req.body.rows) || !req.body.rows.length || req.body.rows.length > MAX_ARRANGEMENT_ROWS) {
          return res.status(400).json({ error: "Pending payment rows are required" });
        }
        const today = getPaymentBusinessDate();
        rows = req.body.rows as Array<{ id: string; amount: number; paymentDate: string }>;
        for (const row of rows) {
          if (!row || typeof row.id !== "string" || !Number.isSafeInteger(row.amount) || row.amount <= 0) {
            return res.status(400).json({ error: "Every payment must have an id and positive whole-number cents" });
          }
          if (typeof row.paymentDate !== "string" || !isCalendarDate(row.paymentDate) || row.paymentDate < today) {
            return res.status(400).json({ error: "Every pending payment date must be today or later" });
          }
        }
        if (req.body.cardId !== undefined) {
          cardId = req.body.cardId === null ? null : String(req.body.cardId);
          if (!cardId) return res.status(400).json({ error: "A replacement card id is required" });
          const card = await storage.getPaymentCard(cardId);
          if (!card || card.organizationId !== organizationId || card.debtorId !== debtor.id) {
            return res.status(400).json({ error: "Payment card does not belong to this debtor" });
          }
          const activeMerchant = (await storage.getMerchants(organizationId))
            .find(merchant => merchant.isActive && merchant.id === card.merchantId);
          if (card.vaultStatus !== "vaulted" || !card.processorType || !card.processorToken ||
              !activeMerchant || activeMerchant.processorType !== card.processorType) {
            return res.status(409).json({ error: "Replacement card must be vaulted with its active merchant" });
          }
        }
      }
      const result = await storage.mutatePaymentArrangement({
        organizationId, debtorId: debtor.id, arrangementId: req.params.arrangementId,
        mutationId, collectorId: req.session.collector.id, action, rows, cardId,
      });
      return res.json(redactPayments(result));
    } catch (error: any) {
      if (typeof error?.status === "number") return res.status(error.status).json({ error: error.message });
      return res.status(500).json({ error: "Failed to change payment arrangement" });
    }
  });
}