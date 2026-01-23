import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const client = await storage.createClient({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Fee Schedule routes
  app.get("/api/fee-schedules", async (req, res) => {
    try {
      const feeSchedules = await storage.getFeeSchedules();
      res.json(feeSchedules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fee schedules" });
    }
  });

  app.get("/api/fee-schedules/:id", async (req, res) => {
    try {
      const feeSchedule = await storage.getFeeSchedule(req.params.id);
      if (!feeSchedule) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fee schedule" });
    }
  });

  app.post("/api/fee-schedules", async (req, res) => {
    try {
      const feeSchedule = await storage.createFeeSchedule({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to create fee schedule" });
    }
  });

  app.patch("/api/fee-schedules/:id", async (req, res) => {
    try {
      const feeSchedule = await storage.updateFeeSchedule(req.params.id, req.body);
      if (!feeSchedule) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.json(feeSchedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update fee schedule" });
    }
  });

  app.delete("/api/fee-schedules/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFeeSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Fee schedule not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete fee schedule" });
    }
  });

  app.get("/api/collectors", async (req, res) => {
    try {
      const collectors = await storage.getCollectors();
      res.json(collectors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collectors" });
    }
  });

  app.get("/api/collectors/:id", async (req, res) => {
    try {
      const collector = await storage.getCollector(req.params.id);
      if (!collector) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collector" });
    }
  });

  app.post("/api/collectors", async (req, res) => {
    try {
      const collector = await storage.createCollector(req.body);
      res.status(201).json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to create collector" });
    }
  });

  app.patch("/api/collectors/:id", async (req, res) => {
    try {
      const collector = await storage.updateCollector(req.params.id, req.body);
      if (!collector) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.json(collector);
    } catch (error) {
      res.status(500).json({ error: "Failed to update collector" });
    }
  });

  app.delete("/api/collectors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCollector(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Collector not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete collector" });
    }
  });

  app.get("/api/portfolios", async (req, res) => {
    try {
      const portfolios = await storage.getPortfolios();
      res.json(portfolios);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolios", async (req, res) => {
    try {
      const portfolio = await storage.createPortfolio(req.body);
      res.status(201).json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to create portfolio" });
    }
  });

  app.patch("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.updatePortfolio(req.params.id, req.body);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to update portfolio" });
    }
  });

  app.delete("/api/portfolios/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePortfolio(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete portfolio" });
    }
  });

  app.get("/api/debtors", async (req, res) => {
    try {
      const { portfolioId, collectorId } = req.query;
      const debtors = await storage.getDebtors(
        portfolioId as string | undefined,
        collectorId as string | undefined
      );
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debtors" });
    }
  });

  app.get("/api/debtors/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const debtors = await storage.getRecentDebtors(limit);
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent debtors" });
    }
  });

  app.get("/api/debtors/:id", async (req, res) => {
    try {
      const debtor = await storage.getDebtor(req.params.id);
      if (!debtor) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      res.json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debtor" });
    }
  });

  app.post("/api/debtors", async (req, res) => {
    try {
      const debtor = await storage.createDebtor(req.body);
      res.status(201).json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to create debtor" });
    }
  });

  app.patch("/api/debtors/:id", async (req, res) => {
    try {
      const debtor = await storage.updateDebtor(req.params.id, req.body);
      if (!debtor) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      res.json(debtor);
    } catch (error) {
      res.status(500).json({ error: "Failed to update debtor" });
    }
  });

  app.delete("/api/debtors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDebtor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Debtor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete debtor" });
    }
  });

  app.get("/api/debtors/:id/contacts", async (req, res) => {
    try {
      const contacts = await storage.getDebtorContacts(req.params.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/debtors/:id/contacts", async (req, res) => {
    try {
      const contact = await storage.createDebtorContact({
        ...req.body,
        debtorId: req.params.id,
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateDebtorContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.get("/api/debtors/:id/employment", async (req, res) => {
    try {
      const records = await storage.getEmploymentRecords(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employment records" });
    }
  });

  app.post("/api/debtors/:id/employment", async (req, res) => {
    try {
      const record = await storage.createEmploymentRecord({
        ...req.body,
        debtorId: req.params.id,
      });
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create employment record" });
    }
  });

  app.get("/api/debtors/:id/references", async (req, res) => {
    try {
      const references = await storage.getDebtorReferences(req.params.id);
      res.json(references);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch references" });
    }
  });

  app.post("/api/debtors/:id/references", async (req, res) => {
    try {
      const reference = await storage.createDebtorReference({
        ...req.body,
        debtorId: req.params.id,
        addedDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(reference);
    } catch (error) {
      res.status(500).json({ error: "Failed to create reference" });
    }
  });

  app.patch("/api/references/:id", async (req, res) => {
    try {
      const reference = await storage.updateDebtorReference(req.params.id, req.body);
      if (!reference) {
        return res.status(404).json({ error: "Reference not found" });
      }
      res.json(reference);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reference" });
    }
  });

  app.delete("/api/references/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDebtorReference(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Reference not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reference" });
    }
  });

  app.get("/api/debtors/:id/bank-accounts", async (req, res) => {
    try {
      const accounts = await storage.getBankAccounts(req.params.id);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bank accounts" });
    }
  });

  app.post("/api/debtors/:id/bank-accounts", async (req, res) => {
    try {
      const account = await storage.createBankAccount({
        ...req.body,
        debtorId: req.params.id,
      });
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to create bank account" });
    }
  });

  app.get("/api/debtors/:id/cards", async (req, res) => {
    try {
      const cards = await storage.getPaymentCards(req.params.id);
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment cards" });
    }
  });

  app.post("/api/debtors/:id/cards", async (req, res) => {
    try {
      const card = await storage.createPaymentCard({
        ...req.body,
        debtorId: req.params.id,
        addedDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(card);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment card" });
    }
  });

  app.delete("/api/cards/:id", async (req, res) => {
    try {
      const success = await storage.deletePaymentCard(req.params.id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: "Payment card not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payment card" });
    }
  });

  app.get("/api/debtors/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments(req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/debtors/:id/payments", async (req, res) => {
    try {
      const payment = await storage.createPayment({
        ...req.body,
        debtorId: req.params.id,
      });
      
      if (req.body.amount) {
        const debtor = await storage.getDebtor(req.params.id);
        if (debtor) {
          await storage.updateDebtor(req.params.id, {
            currentBalance: debtor.currentBalance - req.body.amount,
          });
        }
      }
      
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.get("/api/debtors/:id/notes", async (req, res) => {
    try {
      const notes = await storage.getNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/debtors/:id/notes", async (req, res) => {
    try {
      const note = await storage.createNote({
        ...req.body,
        debtorId: req.params.id,
      });
      res.status(201).json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.get("/api/payments/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const payments = await storage.getRecentPayments(limit);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent payments" });
    }
  });

  app.get("/api/payments/pending", async (req, res) => {
    try {
      const payments = await storage.getPendingPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  });

  app.get("/api/payment-batches", async (req, res) => {
    try {
      const batches = await storage.getPaymentBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment batches" });
    }
  });

  app.get("/api/payment-batches/:id", async (req, res) => {
    try {
      const batch = await storage.getPaymentBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Payment batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment batch" });
    }
  });

  app.post("/api/payment-batches", async (req, res) => {
    try {
      const batch = await storage.createPaymentBatch(req.body);
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment batch" });
    }
  });

  app.post("/api/payment-batches/:id/run", async (req, res) => {
    try {
      const batch = await storage.updatePaymentBatch(req.params.id, {
        status: "processing",
        scheduledDate: new Date().toISOString(),
      });
      if (!batch) {
        return res.status(404).json({ error: "Payment batch not found" });
      }
      
      setTimeout(async () => {
        await storage.updatePaymentBatch(req.params.id, {
          status: "completed",
          processedDate: new Date().toISOString(),
          successCount: batch.totalPayments ? Math.floor(batch.totalPayments * 0.9) : 0,
          failedCount: batch.totalPayments ? Math.ceil(batch.totalPayments * 0.1) : 0,
        });
      }, 5000);
      
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to run payment batch" });
    }
  });

  app.get("/api/payment-batches/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments(undefined, req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch batch payments" });
    }
  });

  app.post("/api/payment-batches/:id/add-payments", async (req, res) => {
    try {
      const { paymentIds } = req.body;
      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: "Payment IDs required" });
      }
      const batch = await storage.addPaymentsToBatch(req.params.id, paymentIds);
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to add payments to batch" });
    }
  });

  app.get("/api/liquidation/snapshots", async (req, res) => {
    try {
      const { portfolioId } = req.query;
      const snapshots = await storage.getLiquidationSnapshots(portfolioId as string | undefined);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch liquidation snapshots" });
    }
  });

  app.post("/api/liquidation/snapshots", async (req, res) => {
    try {
      const snapshot = await storage.createLiquidationSnapshot(req.body);
      res.status(201).json(snapshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to create liquidation snapshot" });
    }
  });

  // Merchants API
  app.get("/api/merchants", async (req, res) => {
    try {
      const merchants = await storage.getMerchants();
      res.json(merchants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch merchants" });
    }
  });

  app.get("/api/merchants/:id", async (req, res) => {
    try {
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch merchant" });
    }
  });

  app.post("/api/merchants", async (req, res) => {
    try {
      const merchant = await storage.createMerchant({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to create merchant" });
    }
  });

  app.patch("/api/merchants/:id", async (req, res) => {
    try {
      const merchant = await storage.updateMerchant(req.params.id, req.body);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      res.status(500).json({ error: "Failed to update merchant" });
    }
  });

  app.delete("/api/merchants/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMerchant(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete merchant" });
    }
  });

  // Time Clock API
  app.get("/api/time-clock", async (req, res) => {
    try {
      const { collectorId, date } = req.query;
      const entries = await storage.getTimeClockEntries(
        collectorId as string | undefined,
        date as string | undefined
      );
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time clock entries" });
    }
  });

  app.get("/api/time-clock/active/:collectorId", async (req, res) => {
    try {
      const entry = await storage.getActiveTimeClockEntry(req.params.collectorId);
      res.json(entry || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active time clock entry" });
    }
  });

  app.post("/api/time-clock/clock-in", async (req, res) => {
    try {
      const { collectorId } = req.body;
      const existing = await storage.getActiveTimeClockEntry(collectorId);
      if (existing) {
        return res.status(400).json({ error: "Already clocked in" });
      }
      const entry = await storage.createTimeClockEntry({
        collectorId,
        clockIn: new Date().toISOString(),
      });
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to clock in" });
    }
  });

  app.post("/api/time-clock/clock-out", async (req, res) => {
    try {
      const { collectorId } = req.body;
      const entry = await storage.getActiveTimeClockEntry(collectorId);
      if (!entry) {
        return res.status(400).json({ error: "Not clocked in" });
      }
      const clockOut = new Date();
      const clockIn = new Date(entry.clockIn);
      const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const updated = await storage.updateTimeClockEntry(entry.id, {
        clockOut: clockOut.toISOString(),
        totalMinutes,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to clock out" });
    }
  });

  // Payments by date (for Payment Runner)
  app.get("/api/payments/by-date", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ error: "Date parameter required" });
      }
      const payments = await storage.getPaymentsByDate(date as string);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments by date" });
    }
  });

  // Get all payments
  app.get("/api/payments", async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Process a single payment
  app.post("/api/payments/:id/process", async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Simulate payment processing (in production, this would call NMI/USAePay)
      const success = Math.random() > 0.2; // 80% success rate for demo
      const declineReason = success ? null : "Insufficient funds";
      
      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: success ? "processed" : "failed",
        notes: success ? payment.notes : `DECLINED: ${declineReason}`,
      });

      // If failed, add decline reason to debtor notes
      if (!success) {
        const debtor = await storage.getDebtor(payment.debtorId);
        if (debtor) {
          await storage.createNote({
            debtorId: payment.debtorId,
            collectorId: payment.processedBy || "system",
            content: `Payment of $${(payment.amount / 100).toFixed(2)} DECLINED: ${declineReason}`,
            noteType: "payment",
            createdDate: new Date().toISOString().split("T")[0],
          });
        }
      }

      res.json({ ...updatedPayment, declineReason });
    } catch (error) {
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // Re-run a failed payment
  app.post("/api/payments/:id/rerun", async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Reset to pending first, then process
      await storage.updatePayment(req.params.id, { status: "pending" });

      // Simulate payment processing (in production, this would call NMI/USAePay)
      const success = Math.random() > 0.3; // 70% success rate for re-runs
      const declineReason = success ? null : "Card declined - retry failed";
      
      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: success ? "processed" : "failed",
        notes: success ? "Payment re-run successful" : `DECLINED: ${declineReason}`,
      });

      // If failed, add decline reason to debtor notes
      if (!success) {
        await storage.createNote({
          debtorId: payment.debtorId,
          collectorId: payment.processedBy || "system",
          content: `Payment re-run of $${(payment.amount / 100).toFixed(2)} DECLINED: ${declineReason}`,
          noteType: "payment",
          createdDate: new Date().toISOString().split("T")[0],
        });
      }

      res.json({ ...updatedPayment, declineReason });
    } catch (error) {
      res.status(500).json({ error: "Failed to re-run payment" });
    }
  });

  // Reverse a processed payment
  app.post("/api/payments/:id/reverse", async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const { reason } = req.body;

      // Reverse the payment
      const updatedPayment = await storage.updatePayment(req.params.id, {
        status: "refunded",
        notes: `REVERSED: ${reason || "No reason provided"}`,
      });

      // Cancel all future scheduled payments for this debtor
      const allPayments = await storage.getPaymentsForDebtor(payment.debtorId);
      const futurePayments = allPayments.filter(
        (p) => p.status === "pending" && new Date(p.paymentDate) > new Date()
      );
      
      for (const futurePayment of futurePayments) {
        await storage.updatePayment(futurePayment.id, {
          status: "cancelled",
          notes: `Cancelled due to payment reversal on ${new Date().toISOString().split("T")[0]}`,
        });
      }

      // Add note to debtor account
      await storage.createNote({
        debtorId: payment.debtorId,
        collectorId: payment.processedBy || "system",
        content: `Payment of $${(payment.amount / 100).toFixed(2)} REVERSED. Reason: ${reason || "No reason provided"}. ${futurePayments.length} future payment(s) cancelled.`,
        noteType: "payment",
        createdDate: new Date().toISOString().split("T")[0],
      });

      res.json({ ...updatedPayment, cancelledPayments: futurePayments.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to reverse payment" });
    }
  });

  // Import Batches API
  app.get("/api/import-batches", async (req, res) => {
    try {
      const batches = await storage.getImportBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import batches" });
    }
  });

  app.get("/api/import-batches/:id", async (req, res) => {
    try {
      const batch = await storage.getImportBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Import batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import batch" });
    }
  });

  app.post("/api/import-batches", async (req, res) => {
    try {
      const batch = await storage.createImportBatch({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create import batch" });
    }
  });

  app.patch("/api/import-batches/:id", async (req, res) => {
    try {
      const batch = await storage.updateImportBatch(req.params.id, req.body);
      if (!batch) {
        return res.status(404).json({ error: "Import batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update import batch" });
    }
  });

  // Import Mappings API
  app.get("/api/import-mappings", async (req, res) => {
    try {
      const { importType } = req.query;
      const mappings = await storage.getImportMappings(importType as string | undefined);
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import mappings" });
    }
  });

  app.post("/api/import-mappings", async (req, res) => {
    try {
      const mapping = await storage.createImportMapping({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(mapping);
    } catch (error) {
      res.status(500).json({ error: "Failed to create import mapping" });
    }
  });

  app.delete("/api/import-mappings/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteImportMapping(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Import mapping not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete import mapping" });
    }
  });

  // Import Data API - handles partial imports, upserts, and SSN-based linking
  app.post("/api/import/debtors", async (req, res) => {
    try {
      const { portfolioId, clientId, records, mappings } = req.body;
      
      if (!portfolioId || !clientId || !records || !mappings) {
        return res.status(400).json({ error: "Missing required fields: portfolioId, clientId, records, mappings" });
      }

      const results = {
        created: 0,
        updated: 0,
        linked: 0,
        errors: [] as string[],
      };

      const existingDebtors = await storage.getDebtors(portfolioId);
      const allDebtors = await storage.getDebtors();

      for (const record of records) {
        try {
          const mappedData: any = {};
          
          for (const [csvColumn, systemField] of Object.entries(mappings)) {
            if (systemField && systemField !== "skip" && record[csvColumn] !== undefined) {
              let value = record[csvColumn];
              
              if (systemField === "originalBalance" || systemField === "currentBalance") {
                value = Math.round(parseFloat(value.replace(/[$,]/g, '')) * 100) || 0;
              }
              
              mappedData[systemField] = value;
            }
          }

          if (!mappedData.accountNumber && !mappedData.ssn) {
            results.errors.push(`Row missing account number and SSN - skipped`);
            continue;
          }

          const existingInPortfolio = existingDebtors.find(
            (d) => (mappedData.accountNumber && d.accountNumber === mappedData.accountNumber) ||
                   (mappedData.ssn && d.ssn === mappedData.ssn)
          );

          if (existingInPortfolio) {
            await storage.updateDebtor(existingInPortfolio.id, mappedData);
            results.updated++;
            continue;
          }

          let linkedAccountId: string | null = null;
          if (mappedData.ssn) {
            const linkedDebtor = allDebtors.find(
              (d) => d.ssn === mappedData.ssn && d.portfolioId !== portfolioId
            );
            if (linkedDebtor) {
              linkedAccountId = linkedDebtor.id;
              results.linked++;
            }
          }

          const newDebtor = await storage.createDebtor({
            portfolioId,
            clientId,
            linkedAccountId,
            accountNumber: mappedData.accountNumber || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            firstName: mappedData.firstName || "Unknown",
            lastName: mappedData.lastName || "Unknown",
            email: mappedData.email || null,
            address: mappedData.address || null,
            city: mappedData.city || null,
            state: mappedData.state || null,
            zipCode: mappedData.zipCode || null,
            dateOfBirth: mappedData.dateOfBirth || null,
            ssn: mappedData.ssn || null,
            ssnLast4: mappedData.ssnLast4 || (mappedData.ssn ? mappedData.ssn.slice(-4) : null),
            originalBalance: mappedData.originalBalance || 0,
            currentBalance: mappedData.currentBalance || mappedData.originalBalance || 0,
            originalCreditor: mappedData.originalCreditor || null,
            clientName: mappedData.clientName || null,
            fileNumber: mappedData.fileNumber || null,
            status: mappedData.status || "open",
            lastContactDate: mappedData.lastContactDate || null,
            nextFollowUpDate: mappedData.nextFollowUpDate || null,
          });

          // Create phone contacts - handle legacy "phone" field and phone1-5
          const phoneFields = [
            { phone: mappedData.phone1 || mappedData.phone, label: mappedData.phone1Label },
            { phone: mappedData.phone2, label: mappedData.phone2Label },
            { phone: mappedData.phone3, label: mappedData.phone3Label },
            { phone: mappedData.phone4, label: mappedData.phone4Label },
            { phone: mappedData.phone5, label: mappedData.phone5Label },
          ];
          
          let phoneCount = 0;
          for (let i = 0; i < phoneFields.length; i++) {
            const { phone, label } = phoneFields[i];
            if (phone && phone.trim()) {
              await storage.createDebtorContact({
                debtorId: newDebtor.id,
                type: "phone",
                value: phone.trim(),
                label: label || (phoneCount === 0 ? "Primary" : `Phone ${phoneCount + 1}`),
                isPrimary: phoneCount === 0,
                isValid: true,
              });
              phoneCount++;
            }
          }

          // Create email contacts - handle legacy "email" field (in debtor record) and email1-3
          const emailFields = [
            { email: mappedData.email1, label: mappedData.email1Label },
            { email: mappedData.email2, label: mappedData.email2Label },
            { email: mappedData.email3, label: mappedData.email3Label },
          ];
          
          let emailCount = 0;
          for (let i = 0; i < emailFields.length; i++) {
            const { email, label } = emailFields[i];
            if (email && email.trim()) {
              await storage.createDebtorContact({
                debtorId: newDebtor.id,
                type: "email",
                value: email.trim(),
                label: label || (emailCount === 0 ? "Primary" : `Email ${emailCount + 1}`),
                isPrimary: emailCount === 0,
                isValid: true,
              });
              emailCount++;
            }
          }

          // Create employment record if employer info provided
          if (mappedData.employerName && mappedData.employerName.trim()) {
            await storage.createEmploymentRecord({
              debtorId: newDebtor.id,
              employerName: mappedData.employerName.trim(),
              employerPhone: mappedData.employerPhone || null,
              employerAddress: mappedData.employerAddress || null,
              position: mappedData.position || null,
              salary: mappedData.salary ? Math.round(parseFloat(mappedData.salary.replace(/[$,]/g, '')) * 100) : null,
              isCurrent: true,
            });
          }

          // Create references (up to 3)
          const refFields = [
            { name: mappedData.ref1Name, relationship: mappedData.ref1Relationship, phone: mappedData.ref1Phone, address: mappedData.ref1Address, city: mappedData.ref1City, state: mappedData.ref1State, zipCode: mappedData.ref1ZipCode, notes: mappedData.ref1Notes },
            { name: mappedData.ref2Name, relationship: mappedData.ref2Relationship, phone: mappedData.ref2Phone, address: mappedData.ref2Address, city: mappedData.ref2City, state: mappedData.ref2State, zipCode: mappedData.ref2ZipCode, notes: mappedData.ref2Notes },
            { name: mappedData.ref3Name, relationship: mappedData.ref3Relationship, phone: mappedData.ref3Phone, address: mappedData.ref3Address, city: mappedData.ref3City, state: mappedData.ref3State, zipCode: mappedData.ref3ZipCode, notes: mappedData.ref3Notes },
          ];
          
          for (const ref of refFields) {
            if (ref.name && ref.name.trim()) {
              await storage.createDebtorReference({
                debtorId: newDebtor.id,
                name: ref.name.trim(),
                relationship: ref.relationship || null,
                phone: ref.phone || null,
                address: ref.address || null,
                city: ref.city || null,
                state: ref.state || null,
                zipCode: ref.zipCode || null,
                notes: ref.notes || null,
                addedDate: new Date().toISOString().split("T")[0],
              });
            }
          }

          results.created++;
        } catch (err: any) {
          results.errors.push(err.message || "Unknown error processing record");
        }
      }

      const portfolio = await storage.getPortfolio(portfolioId);
      if (portfolio) {
        const updatedDebtors = await storage.getDebtors(portfolioId);
        const totalFaceValue = updatedDebtors.reduce((sum, d) => sum + d.originalBalance, 0);
        await storage.updatePortfolio(portfolioId, {
          totalAccounts: updatedDebtors.length,
          totalFaceValue,
        });
      }

      res.json({
        success: true,
        results,
        message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.linked} linked across portfolios`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import debtors" });
    }
  });

  // Import Contacts API - adds contacts to existing debtors
  app.post("/api/import/contacts", async (req, res) => {
    try {
      const { portfolioId, records, mappings } = req.body;
      
      if (!portfolioId || !records || !mappings) {
        return res.status(400).json({ error: "Missing required fields: portfolioId, records, mappings" });
      }

      const results = {
        added: 0,
        matched: 0,
        errors: [] as string[],
      };

      const debtors = await storage.getDebtors(portfolioId);

      for (const record of records) {
        try {
          const mappedData: any = {};
          
          for (const [csvColumn, systemField] of Object.entries(mappings)) {
            if (systemField && systemField !== "skip" && record[csvColumn] !== undefined) {
              mappedData[systemField] = record[csvColumn];
            }
          }

          let matchedDebtor = null;
          if (mappedData.accountNumber) {
            matchedDebtor = debtors.find((d) => d.accountNumber === mappedData.accountNumber);
          } else if (mappedData.ssn) {
            matchedDebtor = debtors.find((d) => d.ssn === mappedData.ssn);
          }

          if (!matchedDebtor) {
            results.errors.push(`No matching debtor found for record`);
            continue;
          }

          results.matched++;

          if (mappedData.phone) {
            await storage.createDebtorContact({
              debtorId: matchedDebtor.id,
              type: "phone",
              value: mappedData.phone,
              label: mappedData.phoneLabel || null,
              isPrimary: false,
              isValid: true,
            });
            results.added++;
          }

          if (mappedData.email) {
            await storage.createDebtorContact({
              debtorId: matchedDebtor.id,
              type: "email",
              value: mappedData.email,
              label: mappedData.emailLabel || null,
              isPrimary: false,
              isValid: true,
            });
            results.added++;
          }
        } catch (err: any) {
          results.errors.push(err.message || "Unknown error processing record");
        }
      }

      res.json({
        success: true,
        results,
        message: `Import complete: ${results.added} contacts added to ${results.matched} debtors`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import contacts" });
    }
  });

  // Drop Batches API
  app.get("/api/drop-batches", async (req, res) => {
    try {
      const batches = await storage.getDropBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop batches" });
    }
  });

  app.post("/api/drop-batches", async (req, res) => {
    try {
      const batch = await storage.createDropBatch({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create drop batch" });
    }
  });

  app.patch("/api/drop-batches/:id", async (req, res) => {
    try {
      const batch = await storage.updateDropBatch(req.params.id, req.body);
      if (!batch) {
        return res.status(404).json({ error: "Drop batch not found" });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to update drop batch" });
    }
  });

  // Drop Items API
  app.get("/api/drop-items", async (req, res) => {
    try {
      const { batchId, collectorId } = req.query;
      const items = await storage.getDropItems(
        batchId as string | undefined,
        collectorId as string | undefined
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop items" });
    }
  });

  app.post("/api/drop-items", async (req, res) => {
    try {
      const item = await storage.createDropItem({
        ...req.body,
        assignedDate: new Date().toISOString().split("T")[0],
      });
      
      // Also add to work queue
      await storage.createWorkQueueItem({
        collectorId: req.body.collectorId,
        debtorId: req.body.debtorId,
        assignedDate: new Date().toISOString().split("T")[0],
        priority: 0,
      });
      
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create drop item" });
    }
  });

  // Recall Batches API
  app.get("/api/recall-batches", async (req, res) => {
    try {
      const batches = await storage.getRecallBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recall batches" });
    }
  });

  app.post("/api/recall-batches", async (req, res) => {
    try {
      const batch = await storage.createRecallBatch({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to create recall batch" });
    }
  });

  // Recall Items API
  app.get("/api/recall-items/:batchId", async (req, res) => {
    try {
      const items = await storage.getRecallItems(req.params.batchId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recall items" });
    }
  });

  app.post("/api/recall-items", async (req, res) => {
    try {
      const item = await storage.createRecallItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create recall item" });
    }
  });

  app.patch("/api/recall-items/:id", async (req, res) => {
    try {
      const item = await storage.updateRecallItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Recall item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recall item" });
    }
  });

  // Consolidation Companies API
  app.get("/api/consolidation-companies", async (req, res) => {
    try {
      const companies = await storage.getConsolidationCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consolidation companies" });
    }
  });

  app.post("/api/consolidation-companies", async (req, res) => {
    try {
      const company = await storage.createConsolidationCompany({
        ...req.body,
        createdDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to create consolidation company" });
    }
  });

  app.patch("/api/consolidation-companies/:id", async (req, res) => {
    try {
      const company = await storage.updateConsolidationCompany(req.params.id, req.body);
      if (!company) {
        return res.status(404).json({ error: "Consolidation company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update consolidation company" });
    }
  });

  app.delete("/api/consolidation-companies/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteConsolidationCompany(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Consolidation company not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete consolidation company" });
    }
  });

  // Consolidation Cases API
  app.get("/api/consolidation-cases", async (req, res) => {
    try {
      const { debtorId, companyId } = req.query;
      const cases = await storage.getConsolidationCases(
        debtorId as string | undefined,
        companyId as string | undefined
      );
      res.json(cases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch consolidation cases" });
    }
  });

  app.post("/api/consolidation-cases", async (req, res) => {
    try {
      const caseData = await storage.createConsolidationCase({
        ...req.body,
        startDate: req.body.startDate || new Date().toISOString().split("T")[0],
      });
      res.status(201).json(caseData);
    } catch (error) {
      res.status(500).json({ error: "Failed to create consolidation case" });
    }
  });

  app.patch("/api/consolidation-cases/:id", async (req, res) => {
    try {
      const caseData = await storage.updateConsolidationCase(req.params.id, req.body);
      if (!caseData) {
        return res.status(404).json({ error: "Consolidation case not found" });
      }
      res.json(caseData);
    } catch (error) {
      res.status(500).json({ error: "Failed to update consolidation case" });
    }
  });

  // Work Queue API
  app.get("/api/work-queue/:collectorId", async (req, res) => {
    try {
      const { status } = req.query;
      const items = await storage.getWorkQueueItems(
        req.params.collectorId,
        status as string | undefined
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch work queue" });
    }
  });

  app.post("/api/work-queue", async (req, res) => {
    try {
      const item = await storage.createWorkQueueItem({
        ...req.body,
        assignedDate: new Date().toISOString().split("T")[0],
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add to work queue" });
    }
  });

  app.patch("/api/work-queue/:id", async (req, res) => {
    try {
      const item = await storage.updateWorkQueueItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update work queue item" });
    }
  });

  app.delete("/api/work-queue/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkQueueItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Work queue item not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete work queue item" });
    }
  });

  // Remittances API
  app.get("/api/remittances", async (req, res) => {
    try {
      const { status, portfolioId } = req.query;
      const remittances = await storage.getRemittances(
        status as string | undefined,
        portfolioId as string | undefined
      );
      res.json(remittances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remittances" });
    }
  });

  app.post("/api/remittances", async (req, res) => {
    try {
      const remittance = await storage.createRemittance({
        ...req.body,
        remittanceDate: req.body.remittanceDate || new Date().toISOString().split("T")[0],
      });
      res.status(201).json(remittance);
    } catch (error) {
      res.status(500).json({ error: "Failed to create remittance" });
    }
  });

  app.patch("/api/remittances/:id", async (req, res) => {
    try {
      const remittance = await storage.updateRemittance(req.params.id, req.body);
      if (!remittance) {
        return res.status(404).json({ error: "Remittance not found" });
      }
      res.json(remittance);
    } catch (error) {
      res.status(500).json({ error: "Failed to update remittance" });
    }
  });

  // Remittance Items API
  app.get("/api/remittance-items", async (req, res) => {
    try {
      const { remittanceId, status } = req.query;
      const items = await storage.getRemittanceItems(
        remittanceId as string | undefined,
        status as string | undefined
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch remittance items" });
    }
  });

  app.post("/api/remittance-items", async (req, res) => {
    try {
      const item = await storage.createRemittanceItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create remittance item" });
    }
  });

  app.patch("/api/remittance-items/:id", async (req, res) => {
    try {
      const item = await storage.updateRemittanceItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Remittance item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update remittance item" });
    }
  });

  return httpServer;
}
