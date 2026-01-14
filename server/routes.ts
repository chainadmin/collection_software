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

  return httpServer;
}
