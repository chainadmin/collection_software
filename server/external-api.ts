import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import crypto from "crypto";

interface AuthenticatedRequest extends Request {
  apiToken?: {
    id: string;
    name: string;
    permissions: string[] | null;
  };
}

async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Bearer token required" });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const apiToken = await storage.getApiTokenByToken(token);
    
    if (!apiToken) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }
    
    if (!apiToken.isActive) {
      return res.status(401).json({ error: "Unauthorized", message: "Token is inactive" });
    }
    
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Unauthorized", message: "Token has expired" });
    }
    
    await storage.updateApiTokenLastUsed(apiToken.id);
    
    req.apiToken = {
      id: apiToken.id,
      name: apiToken.name,
      permissions: apiToken.permissions,
    };
    
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}

export function registerExternalApiRoutes(app: Express) {
  
  // POST /api/v2/login - Generate or validate token
  app.post("/api/v2/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      const collector = await storage.getCollectorByUsername(username);
      
      if (!collector || collector.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = crypto.randomBytes(32).toString("hex");
      
      const apiToken = await storage.createApiToken({
        name: `Session token for ${username}`,
        token,
        isActive: true,
        permissions: ["all"],
        createdDate: new Date().toISOString().split("T")[0],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      res.json({
        success: true,
        token,
        expiresAt: apiToken.expiresAt,
        user: {
          id: collector.id,
          name: collector.name,
          role: collector.role,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // GET /api/v2/getportfoliolist - Get all portfolios
  app.get("/api/v2/getportfoliolist", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const portfolios = await storage.getPortfolios();
      res.json({
        success: true,
        data: portfolios.map((p) => ({
          portfolioId: p.id,
          name: p.name,
          clientId: p.clientId,
          purchaseDate: p.purchaseDate,
          totalAccounts: p.totalAccounts,
          totalFaceValue: p.totalFaceValue,
          status: p.status,
          creditorName: p.creditorName,
          debtType: p.debtType,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  // GET /api/v2/getaccountbysocial/:ssn - Get account by SSN
  app.get("/api/v2/getaccountbysocial/:ssn", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { ssn } = req.params;
      const debtors = await storage.getDebtors();
      const matches = debtors.filter((d) => d.ssn === ssn || d.ssnLast4 === ssn);
      
      if (matches.length === 0) {
        return res.status(404).json({ error: "No account found for SSN" });
      }
      
      res.json({
        success: true,
        data: matches.map((d) => formatDebtorForApi(d)),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // POST /api/v2/get_accounts_in_portfolio - Get accounts in a portfolio
  app.post("/api/v2/get_accounts_in_portfolio", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { portfolioId, limit, offset } = req.body;
      
      if (!portfolioId) {
        return res.status(400).json({ error: "portfolioId is required" });
      }
      
      const debtors = await storage.getDebtors();
      let filtered = debtors.filter((d) => d.portfolioId === portfolioId);
      
      const total = filtered.length;
      
      if (offset) {
        filtered = filtered.slice(offset);
      }
      if (limit) {
        filtered = filtered.slice(0, limit);
      }
      
      res.json({
        success: true,
        total,
        data: filtered.map((d) => formatDebtorForApi(d)),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  // GET /api/v2/getaccount/:filenumber - Get single account by file number
  app.get("/api/v2/getaccount/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      res.json({
        success: true,
        data: formatDebtorForApi(debtor),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  // GET /api/v2/getphones/:filenumber - Get phone numbers for account
  app.get("/api/v2/getphones/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const phones = contacts.filter((c) => c.type === "phone");
      
      res.json({
        success: true,
        data: phones.map((p) => ({
          id: p.id,
          phoneNumber: p.value,
          label: p.label,
          isPrimary: p.isPrimary,
          isValid: p.isValid,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch phones" });
    }
  });

  // GET /api/v2/getemails/:filenumber - Get emails for account
  app.get("/api/v2/getemails/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      const emails = contacts.filter((c) => c.type === "email");
      
      res.json({
        success: true,
        data: emails.map((e) => ({
          id: e.id,
          emailAddress: e.value,
          label: e.label,
          isPrimary: e.isPrimary,
          isValid: e.isValid,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // GET /api/v2/getnotes/:filenumber - Get notes for account
  app.get("/api/v2/getnotes/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const notes = await storage.getNotes(debtor.id);
      
      res.json({
        success: true,
        data: notes.map((n: any) => ({
          id: n.id,
          content: n.content,
          noteType: n.noteType,
          collectorId: n.collectorId,
          createdDate: n.createdDate,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // GET /api/v2/getpayments/:filenumber - Get payments for account
  app.get("/api/v2/getpayments/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const payments = await storage.getPayments(debtor.id);
      
      res.json({
        success: true,
        data: payments.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          status: p.status,
          referenceNumber: p.referenceNumber,
          notes: p.notes,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // GET /api/v2/getattempts/:filenumber - Get communication attempts for account
  app.get("/api/v2/getattempts/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      
      res.json({
        success: true,
        data: attempts.map((a) => ({
          id: a.id,
          attemptType: a.attemptType,
          direction: a.direction,
          phoneNumber: a.phoneNumber,
          emailAddress: a.emailAddress,
          outcome: a.outcome,
          duration: a.duration,
          notes: a.notes,
          createdDate: a.createdDate,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attempts" });
    }
  });

  // POST /api/v2/insertphone - Add phone to account
  app.post("/api/v2/insertphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, label, isPrimary, notes } = req.body;
      
      if (!fileNumber || !phoneNumber) {
        return res.status(400).json({ error: "fileNumber and phoneNumber are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contact = await storage.createDebtorContact({
        debtorId: debtor.id,
        type: "phone",
        value: phoneNumber,
        label: label || null,
        isPrimary: isPrimary || false,
      });
      
      res.json({
        success: true,
        data: {
          id: contact.id,
          phoneNumber: contact.value,
          label: contact.label,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert phone" });
    }
  });

  // PUT /api/v2/updatephone - Update phone
  app.put("/api/v2/updatephone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneId, phoneNumber, label, isPrimary, isBad, notes } = req.body;
      
      if (!phoneId) {
        return res.status(400).json({ error: "phoneId is required" });
      }
      
      const contact = await storage.updateDebtorContact(phoneId, {
        value: phoneNumber,
        label,
        isPrimary,
        isValid: isBad === undefined ? undefined : !isBad,
      });
      
      res.json({
        success: true,
        data: contact,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update phone" });
    }
  });

  // POST /api/v2/insertattempt - Insert communication attempt
  app.post("/api/v2/insertattempt", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, attemptType, direction, phoneNumber, emailAddress, outcome, duration, notes, externalId } = req.body;
      
      if (!fileNumber || !attemptType) {
        return res.status(400).json({ error: "fileNumber and attemptType are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType,
        direction: direction || "outbound",
        phoneNumber: phoneNumber || null,
        emailAddress: emailAddress || null,
        outcome: outcome || null,
        duration: duration || null,
        notes: notes || null,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      res.json({
        success: true,
        data: attempt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert attempt" });
    }
  });

  // POST /api/v2/InsertNoteline - Insert note
  app.post("/api/v2/InsertNoteline", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, content, noteType } = req.body;
      
      if (!fileNumber || !content) {
        return res.status(400).json({ error: "fileNumber and content are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const note = await storage.createNote({
        debtorId: debtor.id,
        collectorId: "system",
        content,
        noteType: noteType || "system",
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert note" });
    }
  });

  // PUT /api/v2/updatedbase - Update debtor fields
  app.put("/api/v2/updatedbase", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, ...updates } = req.body;
      
      if (!fileNumber) {
        return res.status(400).json({ error: "fileNumber is required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const allowedFields = ["email", "address", "city", "state", "zipCode", "status", "lastContactDate", "nextFollowUpDate"];
      const filteredUpdates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }
      
      const updated = await storage.updateDebtor(debtor.id, filteredUpdates);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // PUT /api/v2/updatepermissions - Update contact permissions (consent)
  app.put("/api/v2/updatepermissions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, canCall, canText, canEmail } = req.body;
      
      if (!fileNumber) {
        return res.status(400).json({ error: "fileNumber is required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const contacts = await storage.getDebtorContacts(debtor.id);
      
      for (const contact of contacts) {
        if (contact.type === "phone" && canCall !== undefined) {
          await storage.updateDebtorContact(contact.id, { isValid: canCall });
        }
        if (contact.type === "email" && canEmail !== undefined) {
          await storage.updateDebtorContact(contact.id, { isValid: canEmail });
        }
      }
      
      res.json({
        success: true,
        message: "Permissions updated",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // POST /api/v2/searchbyphone - Search accounts by phone number
  app.post("/api/v2/searchbyphone", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }
      
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const debtors = await storage.getDebtors();
      const results: any[] = [];
      
      for (const debtor of debtors) {
        const contacts = await storage.getDebtorContacts(debtor.id);
        const phoneMatch = contacts.find((c) => c.type === "phone" && c.value.replace(/\D/g, "").includes(cleanPhone));
        
        if (phoneMatch) {
          results.push({
            ...formatDebtorForApi(debtor),
            matchedPhone: phoneMatch.value,
          });
        }
      }
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to search by phone" });
    }
  });

  // POST /api/v2/send_text - Record outbound text (webhook endpoint for SMS software)
  app.post("/api/v2/send_text", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, phoneNumber, message, externalId } = req.body;
      
      if (!fileNumber || !phoneNumber || !message) {
        return res.status(400).json({ error: "fileNumber, phoneNumber, and message are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "text",
        direction: "outbound",
        phoneNumber,
        outcome: "sent",
        notes: message,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.createNote({
        debtorId: debtor.id,
        collectorId: "system",
        content: `SMS sent to ${phoneNumber}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
        noteType: "sms",
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          status: "sent",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record text" });
    }
  });

  // POST /api/v2/send_email_c2c - Record outbound email
  app.post("/api/v2/send_email_c2c", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, emailAddress, subject, body, externalId } = req.body;
      
      if (!fileNumber || !emailAddress) {
        return res.status(400).json({ error: "fileNumber and emailAddress are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempt = await storage.createCommunicationAttempt({
        debtorId: debtor.id,
        attemptType: "email",
        direction: "outbound",
        emailAddress,
        outcome: "sent",
        notes: subject || null,
        externalId: externalId || null,
        createdDate: new Date().toISOString(),
      });
      
      await storage.createNote({
        debtorId: debtor.id,
        collectorId: "system",
        content: `Email sent to ${emailAddress}: ${subject || "(no subject)"}`,
        noteType: "email",
        createdDate: new Date().toISOString().split("T")[0],
      });
      
      res.json({
        success: true,
        data: {
          attemptId: attempt.id,
          status: "sent",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to record email" });
    }
  });

  // POST /api/v2/insert_payments_external - Insert payment from external system
  app.post("/api/v2/insert_payments_external", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, amount, paymentMethod, paymentDate, referenceNumber, notes } = req.body;
      
      if (!fileNumber || !amount) {
        return res.status(400).json({ error: "fileNumber and amount are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const payment = await storage.createPayment({
        debtorId: debtor.id,
        amount: Math.round(amount * 100),
        paymentDate: paymentDate || new Date().toISOString().split("T")[0],
        paymentMethod: paymentMethod || "external",
        status: "pending",
        referenceNumber: referenceNumber || null,
        notes: notes || null,
      });
      
      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to insert payment" });
    }
  });

  // POST /api/v2/createCallback - Create a callback/follow-up
  app.post("/api/v2/createCallback", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileNumber, callbackDate, callbackTime, notes } = req.body;
      
      if (!fileNumber || !callbackDate) {
        return res.status(400).json({ error: "fileNumber and callbackDate are required" });
      }
      
      const debtor = await storage.getDebtorByFileNumber(fileNumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await storage.updateDebtor(debtor.id, {
        nextFollowUpDate: callbackDate,
      });
      
      if (notes) {
        await storage.createNote({
          debtorId: debtor.id,
          collectorId: "system",
          content: `Callback scheduled for ${callbackDate}${callbackTime ? " at " + callbackTime : ""}: ${notes}`,
          noteType: "callback",
          createdDate: new Date().toISOString().split("T")[0],
        });
      }
      
      res.json({
        success: true,
        message: "Callback created",
        callbackDate,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create callback" });
    }
  });

  // GET /api/v2/getemailstats/:filenumber - Get email stats for account
  app.get("/api/v2/getemailstats/:filenumber", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { filenumber } = req.params;
      const debtor = await storage.getDebtorByFileNumber(filenumber);
      
      if (!debtor) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const attempts = await storage.getCommunicationAttempts(debtor.id);
      const emailAttempts = attempts.filter((a) => a.attemptType === "email");
      
      res.json({
        success: true,
        data: {
          totalSent: emailAttempts.filter((a) => a.outcome === "sent").length,
          totalDelivered: emailAttempts.filter((a) => a.outcome === "delivered").length,
          totalOpened: emailAttempts.filter((a) => a.outcome === "opened").length,
          totalClicked: emailAttempts.filter((a) => a.outcome === "clicked").length,
          totalBounced: emailAttempts.filter((a) => a.outcome === "bounced").length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email stats" });
    }
  });
}

function formatDebtorForApi(debtor: any) {
  return {
    fileNumber: debtor.fileNumber,
    accountNumber: debtor.accountNumber,
    firstName: debtor.firstName,
    lastName: debtor.lastName,
    fullName: `${debtor.firstName} ${debtor.lastName}`,
    dateOfBirth: debtor.dateOfBirth,
    ssnLast4: debtor.ssnLast4,
    email: debtor.email,
    address: debtor.address,
    city: debtor.city,
    state: debtor.state,
    zipCode: debtor.zipCode,
    originalCreditor: debtor.originalCreditor,
    clientName: debtor.clientName,
    originalBalance: debtor.originalBalance,
    currentBalance: debtor.currentBalance,
    status: debtor.status,
    lastContactDate: debtor.lastContactDate,
    nextFollowUpDate: debtor.nextFollowUpDate,
    portfolioId: debtor.portfolioId,
    assignedCollectorId: debtor.assignedCollectorId,
  };
}
